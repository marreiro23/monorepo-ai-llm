import { NestFactory } from '@nestjs/core';
import { SharepointApiModule } from './sharepoint-api.module';


async function bootstrap() {
  const app = await NestFactory.create(SharepointApiModule);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3003);
}
bootstrap();
