import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { EntraRegistrationService } from '../graph/services/entra-registration.service.js';
import { CreateFolderDto } from './dto/create-folder.dto.js';
import { CreateListItemDto } from './dto/create-list-item.dto.js';
import { InviteDriveItemDto } from './dto/invite-drive-item.dto.js';
import { UpdateDriveItemDto } from './dto/update-drive-item.dto.js';
import { UpdateListItemDto } from './dto/update-list-item.dto.js';
import { UploadFileDto } from './dto/upload-file.dto.js';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class SharePointService {
  constructor(
    private readonly entraRegistrationService: EntraRegistrationService,
  ) {}

  private async getToken(): Promise<string> {
    const token = await this.entraRegistrationService.getAccessToken();
    if (!token) {
      throw new Error('Falha ao obter token de acesso do Entra ID.');
    }
    return token;
  }

  private async requestGraph<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: unknown,
    params?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getToken();
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
    return response.data as T;
  }

  // ─── Phase 2: Drive Items — Read ───────────────────────────────────────────

  async listDriveItems(driveId: string) {
    const data = await this.requestGraph<{ value: unknown[] }>(
      'GET',
      `/drives/${encodeURIComponent(driveId)}/root/children`,
    );
    return { success: true, data: data.value || [] };
  }

  async getDriveItem(driveId: string, itemId: string) {
    const data = await this.requestGraph<unknown>(
      'GET',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
    );
    return { success: true, data };
  }

  async listDriveItemChildren(driveId: string, itemId: string) {
    const data = await this.requestGraph<{ value: unknown[] }>(
      'GET',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children`,
    );
    return { success: true, data: data.value || [] };
  }

  async listDriveItemPermissions(driveId: string, itemId: string) {
    const data = await this.requestGraph<{ value: unknown[] }>(
      'GET',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/permissions`,
    );
    return { success: true, data: data.value || [] };
  }

  // ─── Phase 3: Drive Items — Write ──────────────────────────────────────────

  async createFolder(
    driveId: string,
    parentItemId: string,
    dto: CreateFolderDto,
  ) {
    const data = await this.requestGraph<unknown>(
      'POST',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}/children`,
      {
        name: dto.name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      },
    );
    return { success: true, data };
  }

  async uploadFile(
    driveId: string,
    parentItemId: string,
    fileName: string,
    dto: UploadFileDto,
  ) {
    const buffer = Buffer.from(dto.content, 'base64');
    const data = await this.requestGraph<unknown>(
      'PUT',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentItemId)}:/${encodeURIComponent(fileName)}:/content`,
      buffer,
      undefined,
      { 'Content-Type': dto.mimeType || 'application/octet-stream' },
    );
    return { success: true, data };
  }

  async updateDriveItem(
    driveId: string,
    itemId: string,
    dto: UpdateDriveItemDto,
  ) {
    const data = await this.requestGraph<unknown>(
      'PATCH',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
      dto,
    );
    return { success: true, data };
  }

  async deleteDriveItem(driveId: string, itemId: string) {
    try {
      await this.requestGraph<void>(
        'DELETE',
        `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status !== 404) {
        throw err;
      }
    }
    return { success: true, data: { driveId, itemId } };
  }

  // ─── Phase 4: Permissions ──────────────────────────────────────────────────

  async inviteDriveItem(
    driveId: string,
    itemId: string,
    dto: InviteDriveItemDto,
  ) {
    const data = await this.requestGraph<unknown>(
      'POST',
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/invite`,
      {
        requireSignIn: true,
        sendInvitation: true,
        roles: dto.roles,
        recipients: dto.emails.map((email) => ({ email })),
        message: dto.message || '',
      },
    );
    return { success: true, data };
  }

  async revokeDriveItemPermission(
    driveId: string,
    itemId: string,
    permissionId: string,
  ) {
    try {
      await this.requestGraph<void>(
        'DELETE',
        `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/permissions/${encodeURIComponent(permissionId)}`,
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status !== 404) {
        throw err;
      }
    }
    return { success: true, data: { driveId, itemId, permissionId } };
  }

  // ─── Phase 5: List Items CRUD ──────────────────────────────────────────────

  async listListItems(siteId: string, listId: string) {
    const data = await this.requestGraph<{ value: unknown[] }>(
      'GET',
      `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items?expand=fields`,
    );
    return { success: true, data: data.value || [] };
  }

  async getListItem(siteId: string, listId: string, itemId: string) {
    const data = await this.requestGraph<unknown>(
      'GET',
      `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}?expand=fields`,
    );
    return { success: true, data };
  }

  async createListItem(siteId: string, listId: string, dto: CreateListItemDto) {
    const data = await this.requestGraph<unknown>(
      'POST',
      `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items`,
      { fields: dto.fields },
    );
    return { success: true, data };
  }

  async updateListItem(
    siteId: string,
    listId: string,
    itemId: string,
    dto: UpdateListItemDto,
  ) {
    const data = await this.requestGraph<unknown>(
      'PATCH',
      `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}/fields`,
      dto.fields,
    );
    return { success: true, data };
  }

  async deleteListItem(siteId: string, listId: string, itemId: string) {
    try {
      await this.requestGraph<void>(
        'DELETE',
        `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`,
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status !== 404) {
        throw err;
      }
    }
    return { success: true, data: { siteId, listId, itemId } };
  }
}
