import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AddGroupMemberDto } from './dto/add-group-member.dto.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { AddTeamMemberDto } from './dto/add-team-member.dto.js';
import { AddChannelMemberDto } from './dto/add-channel-member.dto.js';
import { CreateTeamChannelDto } from './dto/create-team-channel.dto.js';
import { ProvisionTeamSiteDto } from './dto/provision-team-site.dto.js';
import { GraphService } from './graph.service.js';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('config')
  getConfig() {
    return this.graphService.getConfig();
  }

  @Get('auth/status')
  getAuthStatus() {
    return this.graphService.getAuthStatus();
  }

  @Get('sites')
  listSites(@Query('search') search?: string, @Query('top') top?: string) {
    return this.graphService.listSites(search, top);
  }

  @Get('sites/:siteId')
  getSite(@Param('siteId') siteId: string) {
    return this.graphService.getSite(siteId);
  }

  @Get('sites/:siteId/drives')
  listSiteDrives(@Param('siteId') siteId: string) {
    return this.graphService.listSiteDrives(siteId);
  }

  @Get('sites/:siteId/permissions')
  listSitePermissions(@Param('siteId') siteId: string) {
    return this.graphService.listSitePermissions(siteId);
  }

  @Get('sites/:siteId/libraries')
  listSiteLibraries(@Param('siteId') siteId: string) {
    return this.graphService.listSiteLibraries(siteId);
  }

  @Get('sites/:siteId/libraries/:listId')
  getLibrary(@Param('siteId') siteId: string, @Param('listId') listId: string) {
    return this.graphService.getLibrary(siteId, listId);
  }

  @Get('users')
  listUsers(@Query('search') search?: string, @Query('top') top?: string) {
    return this.graphService.listUsers(search, top);
  }

  @Get('groups')
  listGroups(@Query('search') search?: string, @Query('top') top?: string) {
    return this.graphService.listGroups(search, top);
  }

  @Get('groups/:groupId')
  getGroup(@Param('groupId') groupId: string) {
    return this.graphService.getGroup(groupId);
  }

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto) {
    return this.graphService.createGroup(dto);
  }

  @Get('groups/:groupId/owners')
  listGroupOwners(@Param('groupId') groupId: string) {
    return this.graphService.listGroupOwners(groupId);
  }

  @Post('groups/:groupId/owners')
  addGroupOwner(
    @Param('groupId') groupId: string,
    @Body() dto: { ownerId: string },
  ) {
    return this.graphService.addGroupOwner(groupId, dto.ownerId);
  }

  @Delete('groups/:groupId/owners/:ownerId')
  removeGroupOwner(
    @Param('groupId') groupId: string,
    @Param('ownerId') ownerId: string,
  ) {
    return this.graphService.removeGroupOwner(groupId, ownerId);
  }

  @Get('groups/:groupId/team')
  getGroupTeam(@Param('groupId') groupId: string) {
    return this.graphService.getGroupTeam(groupId);
  }

  @Put('groups/:groupId/team')
  createTeamFromGroup(@Param('groupId') groupId: string) {
    return this.graphService.createTeamFromGroup(groupId);
  }

  @Get('teams')
  listTeams(@Query('search') search?: string, @Query('top') top?: string) {
    return this.graphService.listTeams(search, top);
  }

  @Get('teams/:teamId')
  getTeam(@Param('teamId') teamId: string) {
    return this.graphService.getTeam(teamId);
  }

  @Get('teams/:teamId/channels')
  listTeamChannels(@Param('teamId') teamId: string) {
    return this.graphService.listTeamChannels(teamId);
  }

  @Post('teams/:teamId/channels')
  createTeamChannel(
    @Param('teamId') teamId: string,
    @Body() dto: CreateTeamChannelDto,
  ) {
    return this.graphService.createTeamChannel(teamId, dto);
  }

  @Get('teams/:teamId/channels/:channelId')
  getTeamChannel(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.graphService.getTeamChannel(teamId, channelId);
  }

  @Get('teams/:teamId/channels/:channelId/messages')
  listTeamChannelMessages(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
    @Query('top') top?: string,
  ) {
    return this.graphService.listTeamChannelMessages(teamId, channelId, top);
  }

  @Get('teams/:teamId/channels/:channelId/messages/:messageId/replies')
  listTeamChannelMessageReplies(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Query('top') top?: string,
  ) {
    return this.graphService.listTeamChannelMessageReplies(
      teamId,
      channelId,
      messageId,
      top,
    );
  }

  @Get('teams/:teamId/channels/:channelId/members')
  listChannelMembers(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.graphService.listChannelMembers(teamId, channelId);
  }

  @Post('teams/:teamId/channels/:channelId/members')
  addChannelMember(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
    @Body() dto: AddChannelMemberDto,
  ) {
    return this.graphService.addChannelMember(teamId, channelId, dto);
  }

  @Delete('teams/:teamId/channels/:channelId/members/:memberId')
  removeChannelMember(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.graphService.removeChannelMember(teamId, channelId, memberId);
  }

  @Get('teams/:teamId/channels/:channelId/files-folder')
  getTeamChannelFilesFolder(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.graphService.getTeamChannelFilesFolder(teamId, channelId);
  }

  @Get('teams/:teamId/channels/:channelId/files')
  listTeamChannelFiles(
    @Param('teamId') teamId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.graphService.listTeamChannelFiles(teamId, channelId);
  }

  @Get('teams/:teamId/members')
  listTeamMembers(@Param('teamId') teamId: string) {
    return this.graphService.listTeamMembers(teamId);
  }

  @Post('teams/:teamId/members')
  addTeamMember(
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.graphService.addTeamMember(teamId, dto);
  }

  @Delete('teams/:teamId/members/:memberId')
  removeTeamMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.graphService.removeTeamMember(teamId, memberId);
  }

  @Get('drives/:driveId/root/permissions')
  listDriveRootPermissions(@Param('driveId') driveId: string) {
    return this.graphService.listDriveRootPermissions(driveId);
  }

  @Get('groups/:groupId/members')
  listGroupMembers(@Param('groupId') groupId: string) {
    return this.graphService.listGroupMembers(groupId);
  }

  @Post('groups/:groupId/members')
  addGroupMember(
    @Param('groupId') groupId: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.graphService.addGroupMember(groupId, dto.memberId);
  }

  @Delete('groups/:groupId/members/:memberId')
  removeGroupMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.graphService.removeGroupMember(groupId, memberId);
  }

  @Post('provisioning/team-site')
  provisionTeamSite(@Body() dto: ProvisionTeamSiteDto) {
    return this.graphService.provisionTeamSite(dto);
  }
}
