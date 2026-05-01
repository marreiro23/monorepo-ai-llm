import { Injectable } from '@nestjs/common';

@Injectable()
export class SharepointApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
