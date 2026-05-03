import { Module } from '@nestjs/common';
import { GraphModule } from '../graph/graph.module.js';
import { SharePointController } from './sharepoint.controller.js';
import { SharePointService } from './sharepoint.service.js';

@Module({
  imports: [GraphModule],
  controllers: [SharePointController],
  providers: [SharePointService],
})
export class SharePointModule {}
