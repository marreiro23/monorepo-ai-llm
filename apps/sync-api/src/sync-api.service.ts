import { Injectable } from '@nestjs/common';

@Injectable()
export class SyncApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
