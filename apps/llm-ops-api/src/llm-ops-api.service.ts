import { Injectable } from '@nestjs/common';

@Injectable()
export class LlmOpsApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
