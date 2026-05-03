import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LlmOpsApiModule } from './llm-ops-api.module';

async function bootstrap() {
  const app = await NestFactory.create(LlmOpsApiModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3002;
  await app.listen(port);
}
void bootstrap();
