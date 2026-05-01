import { Controller, Get } from '@nestjs/common';
import { SharepointApiService } from './sharepoint-api.service';

@Controller()
export class SharepointApiController {
  constructor(private readonly sharepointApiService: SharepointApiService) {}

  @Get()
  getHello(): string {
    return this.sharepointApiService.getHello();
  }
}
