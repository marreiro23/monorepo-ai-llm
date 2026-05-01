import { NestFactory } from '@nestjs/core';
import { SyncApiModule } from './sync-api.module';

async function bootstrap() {
  const app = await NestFactory.create(SyncApiModule);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3004);
}
bootstrap();
