import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SyncApiModule } from './sync-api.module';

async function bootstrap() {
  const app = await NestFactory.create(SyncApiModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3004;
  await app.listen(port);
}
bootstrap();
