import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminService {
  getStatus() {
    return {
      domain: 'admin',
      status: 'planned',
      success: true
    };
  }
}