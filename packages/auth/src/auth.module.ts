import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApiAuthGuard } from './api-auth.guard.js';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard,
    },
  ],
})
export class AuthModule {}
