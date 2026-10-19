// user.controller.ts
import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  async create(
    @Body() createUserDto: { username: string; password: string; role: string },
  ): Promise<Partial<User>> {
    const { username, password, role } = createUserDto;
    return this.userService.createUser(username, password, role);
  }

  @Post('auth')
  async auth(@Body() authUserDto: { username: string; password: string }): Promise<Partial<User>> {
    const { username, password } = authUserDto;
    console.log(username, password);
    return this.userService.authUser(username, password);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 13,
  ): Promise<{ data: Partial<User>[]; total: number }> {
    return this.userService.findAll(page, limit);
  }

  @Get('operators')
  async getOperators() {
    return await this.userService.findOperatorUsernames();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Partial<User>> {
    return this.userService.findOne(id);
  }

  @Put('log-out/:id')
  async logOut(@Param('id') id: number): Promise<void> {
    await this.userService.logOut(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateUserDto: Partial<User>,
  ): Promise<Partial<User>> {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return this.userService.remove(id);
  }
}
