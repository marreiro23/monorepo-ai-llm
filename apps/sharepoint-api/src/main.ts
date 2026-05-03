import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SharepointApiModule } from './sharepoint-api.module';

async function bootstrap() {
  const app = await NestFactory.create(SharepointApiModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3003;
  await app.listen(port);
}
bootstrap();
