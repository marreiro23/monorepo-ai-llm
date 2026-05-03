import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CreateFolderDto } from './dto/create-folder.dto.js';
import { CreateListItemDto } from './dto/create-list-item.dto.js';
import { InviteDriveItemDto } from './dto/invite-drive-item.dto.js';
import { UpdateDriveItemDto } from './dto/update-drive-item.dto.js';
import { UpdateListItemDto } from './dto/update-list-item.dto.js';
import { UploadFileDto } from './dto/upload-file.dto.js';
import { SharePointService } from './sharepoint.service.js';

@Controller('sharepoint')
export class SharePointController {
  constructor(private readonly sharePointService: SharePointService) {}

  // ─── Drive Items: Read ─────────────────────────────────────────────────────

  @Get('drives/:driveId/items')
  listDriveItems(@Param('driveId') driveId: string) {
    return this.sharePointService.listDriveItems(driveId);
  }

  @Get('drives/:driveId/items/:itemId')
  getDriveItem(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sharePointService.getDriveItem(driveId, itemId);
  }

  @Get('drives/:driveId/items/:itemId/children')
  listDriveItemChildren(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sharePointService.listDriveItemChildren(driveId, itemId);
  }

  @Get('drives/:driveId/items/:itemId/permissions')
  listDriveItemPermissions(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sharePointService.listDriveItemPermissions(driveId, itemId);
  }

  // ─── Drive Items: Write ────────────────────────────────────────────────────

  @Post('drives/:driveId/items/:parentItemId/children')
  createFolder(
    @Param('driveId') driveId: string,
    @Param('parentItemId') parentItemId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.sharePointService.createFolder(driveId, parentItemId, dto);
  }

  @Put('drives/:driveId/items/:parentItemId/:fileName')
  uploadFile(
    @Param('driveId') driveId: string,
    @Param('parentItemId') parentItemId: string,
    @Param('fileName') fileName: string,
    @Body() dto: UploadFileDto,
  ) {
    return this.sharePointService.uploadFile(
      driveId,
      parentItemId,
      fileName,
      dto,
    );
  }

  @Patch('drives/:driveId/items/:itemId')
  updateDriveItem(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateDriveItemDto,
  ) {
    return this.sharePointService.updateDriveItem(driveId, itemId, dto);
  }

  @Delete('drives/:driveId/items/:itemId')
  deleteDriveItem(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sharePointService.deleteDriveItem(driveId, itemId);
  }

  // ─── Permissions ───────────────────────────────────────────────────────────

  @Post('drives/:driveId/items/:itemId/invite')
  inviteDriveItem(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
    @Body() dto: InviteDriveItemDto,
  ) {
    return this.sharePointService.inviteDriveItem(driveId, itemId, dto);
  }

  @Delete('drives/:driveId/items/:itemId/permissions/:permissionId')
  revokeDriveItemPermission(
    @Param('driveId') driveId: string,
    @Param('itemId') itemId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.sharePointService.revokeDriveItemPermission(
      driveId,
      itemId,
      permissionId,
    );
  }

  // ─── List Items CRUD ───────────────────────────────────────────────────────

  @Get('sites/:siteId/lists/:listId/items')
  listListItems(
    @Param('siteId') siteId: string,
    @Param('listId') listId: string,
  ) {
    return this.sharePointService.listListItems(siteId, listId);
  }

  @Get('sites/:siteId/lists/:listId/items/:itemId')
  getListItem(
    @Param('siteId') siteId: string,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sharePointService.getListItem(siteId, listId, itemId);
  }

  @Post('sites/:siteId/lists/:listId/items')
  createListItem(
    @Param('siteId') siteId: string,
    @Param('listId') listId: string,
    @Body() dto: CreateListItemDto,
  ) {
    return this.sharePointService.createListItem(siteId, listId, dto);
  }

  @Patch('sites/:siteId/lists/:listId/items/:itemId')
  updateListItem(
    @Param('siteId') siteId: string,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateListItemDto,
  ) {
    return this.sharePointService.updateListItem(siteId, listId, itemId, dto);
  }

  @Delete('sites/:siteId/lists/:listId/items/:itemId')
  deleteListItem(
    @Param('siteId') siteId: string,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sharePointService.deleteListItem(siteId, listId, itemId);
  }
}
