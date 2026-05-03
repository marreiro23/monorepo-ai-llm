import { Controller, Get } from '@nestjs/common';
import { Public } from '@api-llm-embedded/auth';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return { status: 'ok' };
  }
}
