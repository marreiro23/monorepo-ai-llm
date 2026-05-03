import { Test, TestingModule } from '@nestjs/testing';
import { SharepointApiController } from './sharepoint-api.controller';
import { SharepointApiService } from './sharepoint-api.service';

describe('SharepointApiController', () => {
  let sharepointApiController: SharepointApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SharepointApiController],
      providers: [SharepointApiService],
    }).compile();

    sharepointApiController = app.get<SharepointApiController>(
      SharepointApiController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(sharepointApiController.getHello()).toBe('Hello World!');
    });
  });
});
