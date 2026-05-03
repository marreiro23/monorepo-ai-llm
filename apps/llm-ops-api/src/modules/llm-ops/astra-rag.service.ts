import { Collection } from '@datastax/astra-db-ts';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  createAstraDbConnection,
  readAstraDbConnectionConfig,
} from '../../infra/database/astradb/astra-client.js';
import {
  assertAstraDocumentShape,
  assertIndexedStringLimit,
  buildLexicalField,
  buildLexicalCandidates,
  normalizeIndexedString,
  summarizeAstraError,
} from './astra-dataapi.guardrails.js';

type AstraKnowledgeDocument = {
  _id: string;
  agentId?: string | null;
  title: string;
  content: string;
  source?: string | null;
  tags?: string[];
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  $lexical?: string;
};

type AstraInteractionDocument = {
  _id: string;
  agentId?: string | null;
  promptVersionId?: string | null;
  topicFlowVersionId?: string | null;
  invocationSource?: string | null;
  correlationId?: string | null;
  sessionFingerprint?: string | null;
  message?: string | null;
  answer?: string | null;
  retrievedContext?: string[];
  recordedAt: string;
  $lexical?: string;
};

export type AstraKnowledgeDocumentInput = {
  title: string;
  content: string;
  agentId?: string | null;
  source?: string | null;
  tags?: string[];
  isActive?: boolean;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AstraRagService {
  private readonly logger = new Logger(AstraRagService.name);
  private readonly interactionQueue: Record<string, unknown>[] = [];
  private interactionWorkerRunning = false;
  private readonly maxInteractionQueueSize = 100;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('ASTRA_DB_ENABLED') === 'true';
  }

  async retrieveContext(
    message: string,
    agentId?: string | null,
    limit = 4,
  ): Promise<string[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const collection = this.getKnowledgeCollection();
      const lexicalCandidates = buildLexicalCandidates(message);
      const documents: AstraKnowledgeDocument[] = [];
      const seenIds = new Set<string>();

      if (lexicalCandidates.length === 0) {
        const fallbackDocument = await collection.findOne({});
        if (fallbackDocument) {
          documents.push(fallbackDocument);
        }
      } else {
        for (const candidate of lexicalCandidates) {
          const document = await this.findLexicalDocument(
            collection,
            candidate,
          );

          if (!document || seenIds.has(document._id)) {
            continue;
          }

          seenIds.add(document._id);
          documents.push(document);

          if (documents.length >= limit) {
            break;
          }
        }
      }

      return documents
        .filter((document) => {
          if (document.isActive === false) {
            return false;
          }

          if (agentId && document.agentId && document.agentId !== agentId) {
            return false;
          }

          return true;
        })
        .map((document) => this.toContextSnippet(document))
        .filter((item): item is string => item !== null)
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `AstraDB retrieval failed: ${summarizeAstraError(error)}`,
      );
      throw new BadGatewayException('AstraDB retrieval failed');
    }
  }

  private async findLexicalDocument(
    collection: Collection<AstraKnowledgeDocument>,
    candidate: string,
  ): Promise<AstraKnowledgeDocument | null> {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await collection.findOne(
          { $lexical: { $match: candidate } },
          { sort: { $lexical: candidate } },
        );
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        const summary = summarizeAstraError(error);

        if (isLastAttempt) {
          this.logger.warn(
            `AstraDB lexical candidate skipped after retry: ${summary}`,
          );
          return null;
        }

        this.logger.warn(`AstraDB lexical candidate retrying: ${summary}`);
        await this.sleep(500);
      }
    }

    return null;
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  async ingestKnowledgeDocuments(
    documents: AstraKnowledgeDocumentInput[],
  ): Promise<string[]> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('AstraDB integration is disabled');
    }

    try {
      const collection = this.getKnowledgeCollection();
      const insertedIds: string[] = [];

      for (const document of documents) {
        const documentId = randomUUID();
        const preparedDocument = this.prepareKnowledgeDocument(
          documentId,
          document,
        );

        await collection.insertOne(preparedDocument);
        insertedIds.push(documentId);
      }

      return insertedIds;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `AstraDB knowledge-base ingestion failed: ${summarizeAstraError(error)}`,
      );
      throw new BadGatewayException('AstraDB knowledge-base ingestion failed');
    }
  }

  recordInteraction(payload: Record<string, unknown>): void {
    if (!this.isEnabled()) {
      return;
    }

    if (this.interactionQueue.length >= this.maxInteractionQueueSize) {
      this.logger.warn('AstraDB interaction logging skipped: queue is full');
      return;
    }

    this.interactionQueue.push(payload);
    void this.drainInteractionQueue();
  }

  private async drainInteractionQueue(): Promise<void> {
    if (this.interactionWorkerRunning) {
      return;
    }

    this.interactionWorkerRunning = true;
    try {
      while (this.interactionQueue.length > 0) {
        const payload = this.interactionQueue.shift();
        if (!payload) {
          continue;
        }

        try {
          const collection = this.getInteractionCollection();
          await collection.insertOne(this.prepareInteractionDocument(payload));
        } catch (error) {
          this.logger.warn(
            `AstraDB interaction logging skipped: ${summarizeAstraError(error)}`,
          );
        }
      }
    } finally {
      this.interactionWorkerRunning = false;
    }
  }

  private prepareKnowledgeDocument(
    documentId: string,
    document: AstraKnowledgeDocumentInput,
  ): AstraKnowledgeDocument {
    const title = normalizeIndexedString(document.title);
    const content = normalizeIndexedString(document.content);
    const source = document.source
      ? normalizeIndexedString(document.source)
      : null;
    const lexical = buildLexicalField(title, content);

    assertIndexedStringLimit(title, 'title');
    assertIndexedStringLimit(content, 'content');
    if (source) {
      assertIndexedStringLimit(source, 'source');
    }

    const payload: AstraKnowledgeDocument = {
      _id: documentId,
      agentId: document.agentId ?? null,
      title,
      content,
      source,
      tags: (document.tags ?? []).slice(0, 32),
      isActive: document.isActive ?? true,
      metadata: document.metadata ?? {},
      $lexical: lexical,
    };

    assertAstraDocumentShape(payload, 'knowledge document');
    return payload;
  }

  private prepareInteractionDocument(
    payload: Record<string, unknown>,
  ): AstraInteractionDocument {
    const preparedDocument: AstraInteractionDocument = {
      _id: randomUUID(),
      agentId:
        typeof payload.agentId === 'string'
          ? normalizeIndexedString(payload.agentId)
          : null,
      promptVersionId:
        typeof payload.promptVersionId === 'string'
          ? normalizeIndexedString(payload.promptVersionId)
          : null,
      topicFlowVersionId:
        typeof payload.topicFlowVersionId === 'string'
          ? normalizeIndexedString(payload.topicFlowVersionId)
          : null,
      invocationSource:
        typeof payload.invocationSource === 'string'
          ? normalizeIndexedString(payload.invocationSource)
          : null,
      correlationId:
        typeof payload.correlationId === 'string'
          ? normalizeIndexedString(payload.correlationId)
          : null,
      sessionFingerprint:
        typeof payload.sessionFingerprint === 'string'
          ? normalizeIndexedString(payload.sessionFingerprint)
          : null,
      message:
        typeof payload.message === 'string'
          ? normalizeIndexedString(payload.message)
          : null,
      answer:
        typeof payload.answer === 'string'
          ? normalizeIndexedString(payload.answer)
          : null,
      retrievedContext: Array.isArray(payload.retrievedContext)
        ? payload.retrievedContext
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 20)
            .map((item) => normalizeIndexedString(item))
        : [],
      recordedAt: new Date().toISOString(),
      $lexical: buildLexicalField(
        typeof payload.message === 'string' ? payload.message : null,
        typeof payload.answer === 'string' ? payload.answer : null,
        typeof payload.sessionFingerprint === 'string'
          ? payload.sessionFingerprint
          : null,
      ),
    };

    assertAstraDocumentShape(preparedDocument, 'interaction document');
    return preparedDocument;
  }

  private getKnowledgeCollection(): Collection<AstraKnowledgeDocument> {
    return this.getDb().collection<AstraKnowledgeDocument>(
      this.readRequiredConfig('ASTRA_COLLECTION_KNOWLEDGE_BASE'),
    );
  }

  private getInteractionCollection(): Collection<AstraInteractionDocument> {
    return this.getDb().collection<AstraInteractionDocument>(
      this.readRequiredConfig('ASTRA_COLLECTION_INTERACTIONS'),
    );
  }

  private getDb() {
    const { db } = createAstraDbConnection(
      readAstraDbConnectionConfig({
        endpoint: this.readRequiredConfig('ASTRA_DB_API_ENDPOINT'),
        token: this.readRequiredConfig('ASTRA_DB_APPLICATION_TOKEN'),
        keyspace: this.configService.get<string>('ASTRA_DB_KEYSPACE'),
      }),
    );

    return db;
  }

  private toContextSnippet(document: AstraKnowledgeDocument): string | null {
    const title = document.title?.trim() || null;
    const content = document.content?.trim() || null;
    const source = document.source?.trim() || null;

    if (!content) {
      return null;
    }

    return [title, content, source ? `fonte:${source}` : null]
      .filter((item): item is string => Boolean(item))
      .join(' | ');
  }

  private readRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        `Missing AstraDB configuration: ${key}`,
      );
    }

    return value;
  }
}
