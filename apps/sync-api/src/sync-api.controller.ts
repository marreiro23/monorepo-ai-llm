import { Controller, Get } from '@nestjs/common';
import { SyncApiService } from './sync-api.service';

@Controller()
export class SyncApiController {
  constructor(private readonly syncApiService: SyncApiService) {}

  @Get()
  getHello(): string {
    return this.syncApiService.getHello();
  }
}
