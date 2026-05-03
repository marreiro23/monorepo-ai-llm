import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GitMcpService } from './git-mcp.service';
import type {
  GitPushRequest,
  PullRequestCreateRequest,
} from './git-mcp.service';

@Controller('mcp/git')
export class GitMcpController {
  constructor(private readonly gitMcpService: GitMcpService) {}

  @Get('status')
  getStatus() {
    return this.gitMcpService.status();
  }

  @Post('commit')
  commit(@Body() body: { message?: string; addAll?: boolean }) {
    return this.gitMcpService.commit(body.message ?? '', Boolean(body.addAll));
  }

  @Post('push')
  push(@Body() body: GitPushRequest) {
    return this.gitMcpService.push(body ?? {});
  }

  @Get('pr/status')
  pullRequestStatus(@Query('branch') branch?: string) {
    return this.gitMcpService.pullRequestStatus(branch?.trim() || undefined);
  }

  @Post('pr/create')
  createPullRequest(@Body() body: PullRequestCreateRequest) {
    return this.gitMcpService.createPullRequest(body ?? {});
  }
}
