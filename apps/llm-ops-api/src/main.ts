import { NestFactory } from '@nestjs/core';
import { LlmOpsApiModule } from './llm-ops-api.module';

async function bootstrap() {
  const app = await NestFactory.create(LlmOpsApiModule);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3002);
}
bootstrap();
