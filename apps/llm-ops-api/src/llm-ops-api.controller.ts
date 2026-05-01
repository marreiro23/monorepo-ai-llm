import { Controller, Get } from '@nestjs/common';
import { LlmOpsApiService } from './llm-ops-api.service';

@Controller()
export class LlmOpsApiController {
  constructor(private readonly llmOpsApiService: LlmOpsApiService) {}

  @Get()
  getHello(): string {
    return this.llmOpsApiService.getHello();
  }
}
