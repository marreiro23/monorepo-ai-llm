import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller.js';
import { GraphService } from './graph.service.js';
import { EntraRegistrationService } from './services/entra-registration.service.js';

@Module({
  controllers: [GraphController],
  providers: [GraphService, EntraRegistrationService],
  exports: [EntraRegistrationService, GraphService],
})
export class GraphModule {}
