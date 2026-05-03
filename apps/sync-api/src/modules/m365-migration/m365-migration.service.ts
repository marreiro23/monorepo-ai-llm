import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntraRegistrationService } from '../graph/services/entra-registration.service.js';
import { GraphService } from '../graph/graph.service.js';
import { MigrationEventEntity } from './entities/migration-event.entity.js';
import { MigrationJobEntity } from './entities/migration-job.entity.js';
import { MigrationMailboxMappingEntity } from './entities/migration-mailbox-mapping.entity.js';
import { MigrationMailboxEntity } from './entities/migration-mailbox.entity.js';
import {
  MigrationReadinessCheckEntity,
  MigrationReadinessStatus,
} from './entities/migration-readiness-check.entity.js';
import {
  MigrationTenantEntity,
  MigrationTenantRole,
  MigrationTenantStatus,
} from './entities/migration-tenant.entity.js';

const REQUIRED_MAIL_ROLES = ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'];

type TokenPayload = {
  aud?: string;
  appid?: string;
  tid?: string;
  roles?: string[];
  scp?: string;
};

type ReadinessCheck = {
  checkKey: string;
  status: MigrationReadinessStatus;
  message: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class M365MigrationService {
  constructor(
    @InjectRepository(MigrationTenantEntity)
    private readonly tenantRepo: Repository<MigrationTenantEntity>,
    @InjectRepository(MigrationMailboxEntity)
    private readonly mailboxRepo: Repository<MigrationMailboxEntity>,
    @InjectRepository(MigrationMailboxMappingEntity)
    private readonly mappingRepo: Repository<MigrationMailboxMappingEntity>,
    @InjectRepository(MigrationReadinessCheckEntity)
    private readonly readinessRepo: Repository<MigrationReadinessCheckEntity>,
    @InjectRepository(MigrationJobEntity)
    private readonly jobRepo: Repository<MigrationJobEntity>,
    @InjectRepository(MigrationEventEntity)
    private readonly eventRepo: Repository<MigrationEventEntity>,
    private readonly entraRegistrationService: EntraRegistrationService,
    private readonly graphService: GraphService,
    private readonly configService: ConfigService,
  ) {}

  async checkReadiness(tenantRole: MigrationTenantRole) {
    this.assertTenantRole(tenantRole);

    const checks =
      tenantRole === 'source'
        ? await this.buildCurrentTenantReadiness()
        : this.buildTargetTenantReadiness();

    const status: MigrationTenantStatus = checks.some(
      (check) => check.status === 'failed',
    )
      ? 'failed'
      : 'validated';
    const tenant = await this.upsertTenantStatus(tenantRole, status, checks);

    await this.saveReadinessChecks(tenantRole, checks);
    return { success: true, data: { tenant, checks } };
  }

  async discoverMailboxes(tenantRole: MigrationTenantRole) {
    this.assertTenantRole(tenantRole);

    if (tenantRole !== 'source') {
      throw new BadRequestException(
        'Discovery do tenant target ainda depende de credenciais TARGET_* dedicadas.',
      );
    }

    const readiness = await this.checkReadiness(tenantRole);
    const failed = readiness.data.checks.filter(
      (check) => check.status === 'failed',
    );
    if (failed.length > 0) {
      throw new BadRequestException(
        'Readiness falhou; discovery bloqueado para evitar base de migracao inconsistente.',
      );
    }

    const result = await this.graphService.listUsers(undefined, 50);
    const items = (result.data as Record<string, unknown>[]).filter(
      (item) =>
        String(item['mail'] || item['userPrincipalName'] || '').trim().length >
        0,
    );

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'mailbox');
      await this.mailboxRepo.upsert(
        {
          tenantRole,
          remoteId,
          displayName: String(item['displayName'] || ''),
          mail: String(item['mail'] || ''),
          userPrincipalName: String(item['userPrincipalName'] || ''),
          mailboxKind: 'user',
          readinessStatus: 'discovered',
          rawData: item as any,
        },
        {
          conflictPaths: ['tenantRole', 'remoteId'],
          skipUpdateIfNoValuesChanged: false,
        },
      );
    }

    await this.eventRepo.save(
      this.eventRepo.create({
        type: 'mailbox_discovery',
        severity: 'info',
        message: `Discovery ${tenantRole} carregou ${items.length} mailboxes metadata.`,
        details: { tenantRole, itemCount: items.length },
      }),
    );

    return { success: true, data: { tenantRole, itemCount: items.length } };
  }

  async listMailboxes() {
    const mailboxes = await this.mailboxRepo.find({
      order: { updatedAt: 'DESC' },
    });
    return { success: true, data: mailboxes };
  }

  async listMappings() {
    const mappings = await this.mappingRepo.find({
      order: { updatedAt: 'DESC' },
    });
    return { success: true, data: mappings };
  }

  async validateMappings() {
    const sourceMailboxes = await this.mailboxRepo.find({
      where: { tenantRole: 'source' },
    });
    const targetMailboxes = await this.mailboxRepo.find({
      where: { tenantRole: 'target' },
    });
    const targetByAddress = new Map<string, MigrationMailboxEntity>();

    for (const target of targetMailboxes) {
      for (const address of [target.mail, target.userPrincipalName]) {
        if (address) targetByAddress.set(address.toLowerCase(), target);
      }
    }

    let valid = 0;
    let blocked = 0;

    for (const source of sourceMailboxes) {
      const sourceAddress = (
        source.mail ||
        source.userPrincipalName ||
        ''
      ).toLowerCase();
      if (!sourceAddress) continue;

      const target = targetByAddress.get(sourceAddress);
      const validationErrors = target
        ? []
        : ['Target MailUser/mailbox correspondente nao encontrado.'];

      await this.mappingRepo.upsert(
        {
          sourceMailboxId: source.id,
          targetMailboxId: target?.id,
          sourceAddress,
          targetAddress: target?.mail || target?.userPrincipalName,
          status: target ? 'valid' : 'blocked',
          validationErrors,
        },
        {
          conflictPaths: ['sourceMailboxId'],
          skipUpdateIfNoValuesChanged: false,
        },
      );

      if (target) valid += 1;
      else blocked += 1;
    }

    return { success: true, data: { valid, blocked } };
  }

  async createDryRunJob() {
    const mappings = await this.mappingRepo.find();
    const blocked = mappings.filter((mapping) => mapping.status !== 'valid');
    const failedReadiness = await this.readinessRepo.count({
      where: { status: 'failed' },
    });
    const enableExchangeMigration =
      this.configService.get<string>('M365_ENABLE_EXCHANGE_MIGRATION') ===
      'true';

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        mode: 'dry-run',
        status:
          blocked.length > 0 || failedReadiness > 0 || enableExchangeMigration
            ? 'blocked'
            : 'planned',
        mappingCount: mappings.length,
        blockedReason:
          blocked.length > 0
            ? `${blocked.length} mappings bloqueados.`
            : failedReadiness > 0
              ? `${failedReadiness} readiness checks falharam.`
              : enableExchangeMigration
                ? 'Dry-run nao executa migracao real; use endpoint dedicado futuro com readiness completo.'
                : undefined,
        rawPlan: {
          migrationMode:
            this.configService.get<string>('M365_MIGRATION_MODE') ||
            'inventory-only',
          exchangeMigrationEnabled: enableExchangeMigration,
          validMappings: mappings.length - blocked.length,
          blockedMappings: blocked.length,
          failedReadinessChecks: failedReadiness,
        },
      }),
    );

    await this.eventRepo.save(
      this.eventRepo.create({
        jobId: job.id,
        type: 'dry_run_created',
        severity: blocked.length > 0 ? 'warning' : 'info',
        message: `Dry-run criado com ${mappings.length} mappings e ${blocked.length} bloqueios.`,
        details: job.rawPlan,
      }),
    );

    return { success: true, data: job };
  }

  private async buildCurrentTenantReadiness(): Promise<ReadinessCheck[]> {
    const config = this.entraRegistrationService.getConfig();
    const token = await this.entraRegistrationService.getAccessToken();
    if (!token) {
      throw new BadRequestException(
        'Falha ao obter token Graph para readiness source.',
      );
    }
    const payload = this.decodeJwtPayload(token);
    const roles = payload.roles ?? [];
    const missingMailRoles = REQUIRED_MAIL_ROLES.filter(
      (role) => !roles.includes(role),
    );

    return [
      {
        checkKey: 'graph_application_token',
        status: payload.scp ? 'failed' : 'passed',
        message: payload.scp
          ? 'Token atual parece delegado; migracao precisa de application permissions.'
          : 'Token application permissions validado.',
      },
      {
        checkKey: 'source_tenant_identity',
        status: payload.tid && payload.appid ? 'passed' : 'failed',
        message:
          payload.tid && payload.appid
            ? 'Tenant/app source identificados no token.'
            : 'Token nao contem tid/appid suficientes.',
        details: {
          tenantId: payload.tid,
          appId: payload.appid,
          audience: payload.aud,
        },
      },
      {
        checkKey: 'graph_mail_permissions',
        status: missingMailRoles.length === 0 ? 'passed' : 'failed',
        message:
          missingMailRoles.length === 0
            ? 'Permissoes Graph Mail minimas presentes.'
            : `Faltam permissoes Graph Mail: ${missingMailRoles.join(', ')}.`,
        details: {
          required: REQUIRED_MAIL_ROLES,
          present: roles.filter(
            (role) => role.startsWith('Mail') || role.startsWith('Mailbox'),
          ),
        },
      },
      {
        checkKey: 'exchange_migration_feature_flag',
        status:
          this.configService.get<string>('M365_ENABLE_EXCHANGE_MIGRATION') ===
          'true'
            ? 'warning'
            : 'passed',
        message:
          this.configService.get<string>('M365_ENABLE_EXCHANGE_MIGRATION') ===
          'true'
            ? 'Feature flag de migracao Exchange esta ligada, mas este modulo ainda so executa dry-run.'
            : 'Migracao real Exchange permanece bloqueada por feature flag.',
      },
      {
        checkKey: 'auth_material',
        status:
          config.tenantIdConfigured && config.clientIdConfigured
            ? 'passed'
            : 'failed',
        message: 'Configuracao Entra source avaliada sem expor segredos.',
        details: {
          authMethod: config.authMethod,
          tenantIdConfigured: config.tenantIdConfigured,
          clientIdConfigured: config.clientIdConfigured,
          certificateThumbprintConfigured:
            config.certificateThumbprintConfigured,
        },
      },
    ];
  }

  private buildTargetTenantReadiness(): ReadinessCheck[] {
    const configured = Boolean(
      this.configService.get<string>('TARGET_TENANT_ID') &&
      this.configService.get<string>('TARGET_CLIENT_ID'),
    );
    return [
      {
        checkKey: 'target_tenant_config',
        status: configured ? 'warning' : 'failed',
        message: configured
          ? 'TARGET_TENANT_ID/TARGET_CLIENT_ID configurados; falta validar token target dedicado.'
          : 'TARGET_TENANT_ID/TARGET_CLIENT_ID ainda nao configurados.',
      },
      {
        checkKey: 'target_mailuser_preparation',
        status: 'failed',
        message:
          'Ainda falta validar MailUsers target, ExchangeGuid, licenciamento e ausencia de OneDrive/mailbox pre-provisionado.',
      },
      {
        checkKey: 'exchange_online_cross_tenant',
        status: 'failed',
        message:
          'Ainda falta validar OrganizationRelationship, MigrationEndpoint e permissao Exchange Online nos dois tenants.',
      },
    ];
  }

  private async upsertTenantStatus(
    tenantRole: MigrationTenantRole,
    status: MigrationTenantStatus,
    checks: ReadinessCheck[],
  ) {
    const currentConfig = this.entraRegistrationService.getConfig();
    const tenantData =
      tenantRole === 'source'
        ? {
            role: tenantRole,
            tenantId:
              this.configService.get<string>('SOURCE_TENANT_ID') ||
              this.configService.get<string>('TENANT_ID'),
            clientId:
              this.configService.get<string>('SOURCE_CLIENT_ID') ||
              this.configService.get<string>('CLIENT_ID'),
            authMethod: currentConfig.authMethod,
            certificateThumbprint:
              this.configService.get<string>('SOURCE_CERT_THUMBPRINT') ||
              this.configService.get<string>('CERT_THUMBPRINT'),
            status,
            lastValidatedAt: new Date(),
            rawStatus: {
              checks: checks.map(({ checkKey, status }) => ({
                checkKey,
                status,
              })),
            },
          }
        : {
            role: tenantRole,
            tenantId: this.configService.get<string>('TARGET_TENANT_ID'),
            clientId: this.configService.get<string>('TARGET_CLIENT_ID'),
            authMethod: this.configService.get<string>(
              'TARGET_CERT_PRIVATE_KEY_PATH',
            )
              ? 'client-certificate'
              : undefined,
            certificateThumbprint: this.configService.get<string>(
              'TARGET_CERT_THUMBPRINT',
            ),
            status,
            lastValidatedAt: new Date(),
            rawStatus: {
              checks: checks.map(({ checkKey, status }) => ({
                checkKey,
                status,
              })),
            },
          };

    await this.tenantRepo.upsert(tenantData, {
      conflictPaths: ['role'],
      skipUpdateIfNoValuesChanged: false,
    });
    return this.tenantRepo.findOneByOrFail({ role: tenantRole });
  }

  private async saveReadinessChecks(
    tenantRole: MigrationTenantRole,
    checks: ReadinessCheck[],
  ) {
    for (const check of checks) {
      await this.readinessRepo.save(
        this.readinessRepo.create({ tenantRole, ...check }),
      );
    }
  }

  private decodeJwtPayload(token: string): TokenPayload {
    const [, payload] = token.split('.');
    if (!payload) return {};

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(decoded) as TokenPayload;
  }

  private assertTenantRole(tenantRole: MigrationTenantRole) {
    if (tenantRole !== 'source' && tenantRole !== 'target') {
      throw new BadRequestException(
        'tenantRole deve ser "source" ou "target".',
      );
    }
  }

  private requireRemoteId(
    item: Record<string, unknown>,
    entityName: string,
  ): string {
    const remoteId = String(item['id'] || '').trim();
    if (!remoteId) {
      throw new BadRequestException(
        `Graph retornou ${entityName} sem id; operacao abortada para evitar sobrescrita de dados.`,
      );
    }
    return remoteId;
  }
}
