import { Test, TestingModule } from '@nestjs/testing';
import { SyncApiController } from './sync-api.controller';
import { SyncApiService } from './sync-api.service';

describe('SyncApiController', () => {
  let syncApiController: SyncApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SyncApiController],
      providers: [SyncApiService],
    }).compile();

    syncApiController = app.get<SyncApiController>(SyncApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(syncApiController.getHello()).toBe('Hello World!');
    });
  });
});
