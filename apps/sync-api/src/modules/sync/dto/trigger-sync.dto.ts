import { IsIn, IsOptional, IsString } from 'class-validator';

export class TriggerSyncDto {
  @IsIn([
    'sites',
    'drives',
    'users',
    'groups',
    'teams',
    'team-channels',
    'team-channel-messages',
    'mailboxes',
    'onedrives',
  ])
  type!:
    | 'sites'
    | 'drives'
    | 'users'
    | 'groups'
    | 'teams'
    | 'team-channels'
    | 'team-channel-messages'
    | 'mailboxes'
    | 'onedrives';

  /** Contexto: siteId para drives, userId para onedrives, teamId para team-channels ou teamId:channelId para mensagens. */
  @IsOptional()
  @IsString()
  context?: string;
}
