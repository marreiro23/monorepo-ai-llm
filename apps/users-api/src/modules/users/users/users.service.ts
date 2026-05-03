import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ErrorResponseContract,
  UserByIdResponseContract,
  UserContract,
  UserDeleteResponseContract,
  UserMutationResponseContract,
  UsersListResponseContract
} from '@api-llm-embedded/shared';
import { UserEntity } from './entities/user.entity.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>) {}

  private toUserContract(user: UserEntity): UserContract {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async createUser(payload: CreateUserDto): Promise<UserMutationResponseContract> {
    const user = this.usersRepository.create(payload);
    const savedUser = await this.usersRepository.save(user);

    return {
      success: true,
      data: this.toUserContract(savedUser)
    };
  }

  async listUsers(): Promise<UsersListResponseContract> {
    const users = await this.usersRepository.find({
      order: {
        createdAt: 'DESC'
      }
    });

    return {
      success: true,
      data: users.map((item) => this.toUserContract(item))
    };
  }

  async getUserById(id: string): Promise<UserByIdResponseContract> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      const error: ErrorResponseContract = {
        success: false,
        message: 'User not found'
      };

      return error;
    }

    return {
      success: true,
      data: this.toUserContract(user)
    };
  }

  async updateUser(id: string, payload: UpdateUserDto): Promise<UserMutationResponseContract | UserByIdResponseContract> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      const error: ErrorResponseContract = {
        success: false,
        message: 'User not found'
      };

      return error;
    }

    const updatedUser = this.usersRepository.merge(user, payload);
    const savedUser = await this.usersRepository.save(updatedUser);

    return {
      success: true,
      data: this.toUserContract(savedUser)
    };
  }

  async deleteUser(id: string): Promise<UserDeleteResponseContract> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      const error: ErrorResponseContract = {
        success: false,
        message: 'User not found'
      };

      return error;
    }

    await this.usersRepository.remove(user);

    return {
      success: true,
      data: { id }
    };
  }
}
