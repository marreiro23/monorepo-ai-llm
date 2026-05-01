import { Test, TestingModule } from '@nestjs/testing';
import { LlmOpsApiController } from './llm-ops-api.controller';
import { LlmOpsApiService } from './llm-ops-api.service';

describe('LlmOpsApiController', () => {
  let llmOpsApiController: LlmOpsApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [LlmOpsApiController],
      providers: [LlmOpsApiService],
    }).compile();

    llmOpsApiController = app.get<LlmOpsApiController>(LlmOpsApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(llmOpsApiController.getHello()).toBe('Hello World!');
    });
  });
});
