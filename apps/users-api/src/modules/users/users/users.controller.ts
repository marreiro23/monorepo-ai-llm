import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type {
  UserByIdResponseContract,
  UserDeleteResponseContract,
  UserMutationResponseContract,
  UsersListResponseContract
} from '@api-llm-embedded/shared';
import { UsersService } from './users.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() payload: CreateUserDto): Promise<UserMutationResponseContract> {
    return this.usersService.createUser(payload);
  }

  @Get()
  findAll(): Promise<UsersListResponseContract> {
    return this.usersService.listUsers();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserByIdResponseContract> {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateUserDto): Promise<UserMutationResponseContract | UserByIdResponseContract> {
    return this.usersService.updateUser(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<UserDeleteResponseContract> {
    return this.usersService.deleteUser(id);
  }
}
