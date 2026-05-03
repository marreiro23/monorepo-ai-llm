import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { EntraRegistrationService } from './services/entra-registration.service.js';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function sanitizeTop(
  value: string | number | undefined,
  fallbackValue = 25,
  maxValue = 200,
): number {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
  return Math.min(parsed, maxValue);
}

@Injectable()
export class GraphService {
  constructor(
    private readonly entraRegistrationService: EntraRegistrationService,
  ) {}

  protected async requestGraph(
    path: string,
    params?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<any> {
    return this.requestGraphWithMethod('GET', path, undefined, params, headers);
  }

  protected async requestGraphWithMethod(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: unknown,
    params?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<any> {
    const token = await this.entraRegistrationService.getAccessToken();
    const response = await axios({
      method,
      url: `${GRAPH_BASE_URL}${path}`,
      data,
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
    });

    return response.data;
  }

  getConfig() {
    return this.entraRegistrationService.getConfig();
  }

  async getAuthStatus() {
    await this.entraRegistrationService.authenticate();
    return this.getConfig();
  }

  async listSites(search?: string, top?: string | number) {
    const response = await this.requestGraph('/sites', {
      search: search || '*',
      $top: sanitizeTop(top, 25, 50),
    });

    return {
      success: true,
      data: response.value || [],
    };
  }

  async getSite(siteId: string) {
    const response = await this.requestGraph(
      `/sites/${encodeURIComponent(siteId)}`,
    );

    return {
      success: true,
      data: response,
    };
  }

  async getGroup(groupId: string) {
    const response = await this.requestGraph(
      `/groups/${encodeURIComponent(groupId)}`,
    );
    return {
      success: true,
      data: response,
    };
  }

  async createGroup(payload: {
    displayName: string;
    mailNickname: string;
    description: string;
    visibility?: 'Public' | 'Private';
    mailEnabled?: boolean;
    securityEnabled?: boolean;
  }) {
    const response = await this.requestGraphWithMethod('POST', '/groups', {
      displayName: payload.displayName,
      mailNickname: payload.mailNickname,
      description: payload.description,
      groupTypes: ['Unified'],
      mailEnabled: payload.mailEnabled ?? true,
      securityEnabled: payload.securityEnabled ?? false,
      visibility: payload.visibility ?? 'Private',
    });

    return {
      success: true,
      data: response,
    };
  }

  async getGroupTeam(groupId: string) {
    const response = await this.requestGraph(
      `/groups/${encodeURIComponent(groupId)}/team`,
    );
    return {
      success: true,
      data: response,
    };
  }

  async createTeamFromGroup(groupId: string) {
    const response = await this.requestGraphWithMethod(
      'PUT',
      `/groups/${encodeURIComponent(groupId)}/team`,
      {
        'template@odata.bind':
          "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
        'group@odata.bind': `https://graph.microsoft.com/v1.0/groups('${groupId}')`,
      },
    );

    return {
      success: true,
      data: response,
    };
  }

  async listSiteDrives(siteId: string) {
    const response = await this.requestGraph(
      `/sites/${encodeURIComponent(siteId)}/drives`,
    );

    return {
      success: true,
      data: response.value || [],
    };
  }

  async listSitePermissions(siteId: string) {
    const response = await this.requestGraph(
      `/sites/${encodeURIComponent(siteId)}/permissions`,
    );

    return {
      success: true,
      data: response.value || [],
    };
  }

  async listSiteLibraries(siteId: string) {
    const response = await this.requestGraph(
      `/sites/${encodeURIComponent(siteId)}/lists`,
      {
        $expand: 'drive',
      },
    );

    const libraries = (response.value || [])
      .filter(
        (item: any) =>
          item?.list?.template === 'documentLibrary' || item?.drive,
      )
      .map((item: any) => ({
        id: item.id,
        name: item.name || item.displayName || '',
        displayName: item.displayName || item.name || '',
        description: item.description || '',
        webUrl: item.webUrl || '',
        createdDateTime: item.createdDateTime || null,
        lastModifiedDateTime: item.lastModifiedDateTime || null,
        template: item?.list?.template || '',
        drive: item.drive
          ? {
              id: item.drive.id,
              name: item.drive.name || '',
              description: item.drive.description || '',
              driveType: item.drive.driveType || '',
              webUrl: item.drive.webUrl || '',
            }
          : null,
      }));

    return {
      success: true,
      data: libraries,
    };
  }

  async getLibrary(siteId: string, listId: string) {
    const library = await this.requestGraph(
      `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}`,
      {
        $expand: 'drive',
      },
    );

    return {
      success: true,
      data: {
        id: library.id,
        name: library.name || library.displayName || '',
        displayName: library.displayName || library.name || '',
        description: library.description || '',
        webUrl: library.webUrl || '',
        createdDateTime: library.createdDateTime || null,
        lastModifiedDateTime: library.lastModifiedDateTime || null,
        template: library?.list?.template || '',
        drive: library.drive
          ? {
              id: library.drive.id,
              name: library.drive.name || '',
              description: library.drive.description || '',
              driveType: library.drive.driveType || '',
              webUrl: library.drive.webUrl || '',
            }
          : null,
      },
    };
  }

  async listUsers(search?: string, top?: string | number) {
    const params: Record<string, unknown> = {
      $top: sanitizeTop(top, 25, 50),
      $select: 'id,displayName,mail,userPrincipalName,jobTitle,accountEnabled',
    };

    if (search) {
      params.$search = `"displayName:${search}" OR "mail:${search}" OR "userPrincipalName:${search}"`;
      params.$count = true;
    }

    const response = await this.requestGraph(
      '/users',
      params,
      search ? { ConsistencyLevel: 'eventual' } : undefined,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async listGroups(search?: string, top?: string | number) {
    const params: Record<string, unknown> = {
      $top: sanitizeTop(top, 25, 50),
      $select:
        'id,displayName,description,mail,mailNickname,visibility,createdDateTime,securityEnabled,mailEnabled,groupTypes',
    };

    if (search) {
      params.$search = `"displayName:${search}"`;
      params.$count = true;
    }

    const response = await this.requestGraph(
      '/groups',
      params,
      search ? { ConsistencyLevel: 'eventual' } : undefined,
    );

    return {
      success: true,
      data: response.value || [],
    };
  }

  async listDriveRootPermissions(driveId: string) {
    const response = await this.requestGraph(
      `/drives/${encodeURIComponent(driveId)}/root/permissions`,
    );

    return {
      success: true,
      data: response.value || [],
    };
  }

  async listTeams(search?: string, top?: string | number) {
    const params: Record<string, unknown> = {
      $top: sanitizeTop(top, 25, 50),
      $select: 'id,displayName,description,visibility',
    };

    if (search) {
      params.$search = `"displayName:${search}"`;
      params.$count = true;
    }

    const response = await this.requestGraph(
      '/teams',
      params,
      search ? { ConsistencyLevel: 'eventual' } : undefined,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async getUserDrive(userId: string) {
    const response = await this.requestGraph(
      `/users/${encodeURIComponent(userId)}/drive`,
      {
        $select: 'id,name,driveType,webUrl,owner,quota',
      },
    );

    return {
      success: true,
      data: response,
    };
  }

  async getTeam(teamId: string) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}`,
    );
    return { success: true, data: response };
  }

  async listTeamChannels(teamId: string) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/channels`,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async createTeamChannel(
    teamId: string,
    payload: {
      displayName: string;
      description?: string;
      membershipType?: string;
    },
  ) {
    const response = await this.requestGraphWithMethod(
      'POST',
      `/teams/${encodeURIComponent(teamId)}/channels`,
      {
        displayName: payload.displayName,
        description: payload.description ?? '',
        membershipType: payload.membershipType ?? 'standard',
      },
    );
    return { success: true, data: response };
  }

  async getTeamChannel(teamId: string, channelId: string) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}`,
    );
    return { success: true, data: response };
  }

  private async assertChannelSupportsMembershipMutation(
    teamId: string,
    channelId: string,
  ) {
    const channelResponse = await this.getTeamChannel(teamId, channelId);
    const membershipType = (channelResponse.data as { membershipType?: string })
      ?.membershipType;

    if (membershipType === 'standard') {
      throw new BadRequestException(
        'Canal standard nao suporta add/remove de membros via Microsoft Graph. Use membros do team.',
      );
    }
  }

  async listTeamChannelMessages(
    teamId: string,
    channelId: string,
    top?: string | number,
  ) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`,
      { $top: sanitizeTop(top, 25, 50) },
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async listTeamChannelMessageReplies(
    teamId: string,
    channelId: string,
    messageId: string,
    top?: string | number,
  ) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/replies`,
      { $top: sanitizeTop(top, 25, 50) },
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async getTeamChannelFilesFolder(teamId: string, channelId: string) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/filesFolder`,
    );
    return { success: true, data: response };
  }

  async listTeamChannelFiles(teamId: string, channelId: string) {
    const filesFolder = await this.getTeamChannelFilesFolder(teamId, channelId);
    const folderData = filesFolder.data as {
      parentReference?: { driveId?: string };
      id?: string;
    };
    const driveId = folderData?.parentReference?.driveId;
    const itemId = folderData?.id;

    if (!driveId || !itemId) {
      return {
        success: false,
        message: 'Canal sem pasta de arquivos resolvível no Microsoft Graph.',
      };
    }

    const response = await this.requestGraph(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children`,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async listTeamMembers(teamId: string) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/members`,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async addTeamMember(
    teamId: string,
    payload: { userId: string; roles?: string[] },
  ) {
    const response = await this.requestGraphWithMethod(
      'POST',
      `/teams/${encodeURIComponent(teamId)}/members`,
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${payload.userId}')`,
        roles: payload.roles ?? [],
      },
    );
    return { success: true, data: response };
  }

  async removeTeamMember(teamId: string, memberId: string) {
    await this.requestGraphWithMethod(
      'DELETE',
      `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`,
    );
    return { success: true, data: { teamId, conversationMemberId: memberId } };
  }

  async listChannelMembers(teamId: string, channelId: string) {
    const response = await this.requestGraph(
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/members`,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async addChannelMember(
    teamId: string,
    channelId: string,
    payload: { userId: string; roles?: string[] },
  ) {
    await this.assertChannelSupportsMembershipMutation(teamId, channelId);
    const response = await this.requestGraphWithMethod(
      'POST',
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/members`,
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${payload.userId}')`,
        roles: payload.roles ?? [],
      },
    );
    return { success: true, data: response };
  }

  async removeChannelMember(
    teamId: string,
    channelId: string,
    conversationMemberId: string,
  ) {
    await this.assertChannelSupportsMembershipMutation(teamId, channelId);
    await this.requestGraphWithMethod(
      'DELETE',
      `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/members/${encodeURIComponent(conversationMemberId)}`,
    );
    return { success: true, data: { teamId, channelId, conversationMemberId } };
  }

  async listGroupMembers(groupId: string) {
    const response = await this.requestGraph(
      `/groups/${encodeURIComponent(groupId)}/members`,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async addGroupMember(groupId: string, memberId: string) {
    const response = await this.requestGraphWithMethod(
      'POST',
      `/groups/${encodeURIComponent(groupId)}/members/$ref`,
      {
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${memberId}`,
      },
    );
    return { success: true, data: response };
  }

  async removeGroupMember(groupId: string, memberId: string) {
    await this.requestGraphWithMethod(
      'DELETE',
      `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}/$ref`,
    );
    return { success: true, data: { groupId, memberId } };
  }

  async listGroupOwners(groupId: string) {
    const response = await this.requestGraph(
      `/groups/${encodeURIComponent(groupId)}/owners`,
    );
    return {
      success: true,
      data: response.value || [],
    };
  }

  async addGroupOwner(groupId: string, ownerId: string) {
    const response = await this.requestGraphWithMethod(
      'POST',
      `/groups/${encodeURIComponent(groupId)}/owners/$ref`,
      {
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${ownerId}`,
      },
    );
    return { success: true, data: response };
  }

  async removeGroupOwner(groupId: string, ownerId: string) {
    await this.requestGraphWithMethod(
      'DELETE',
      `/groups/${encodeURIComponent(groupId)}/owners/${encodeURIComponent(ownerId)}/$ref`,
    );
    return { success: true, data: { groupId, ownerId } };
  }

  async provisionTeamSite(payload: {
    displayName: string;
    mailNickname: string;
    description: string;
    visibility?: 'Public' | 'Private';
    ownerUserIds?: string[];
    memberUserIds?: string[];
  }) {
    const createdGroup = await this.createGroup(payload);
    const group = createdGroup.data as { id: string };

    for (const ownerId of payload.ownerUserIds ?? []) {
      await this.addGroupOwner(group.id, ownerId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    for (const memberId of payload.memberUserIds ?? []) {
      await this.addGroupMember(group.id, memberId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const createdTeam = await this.createTeamFromGroup(group.id);

    return {
      success: true,
      data: {
        group: createdGroup.data,
        team: createdTeam.data,
        siteHint: `https://{tenant}.sharepoint.com/sites/${payload.mailNickname}`,
      },
    };
  }
}
