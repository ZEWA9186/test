import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from './user.entity';
//TODO Тут можн чуть подумать
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(username: string, password: string, role: string): Promise<Partial<User>> {
    const cleanUsername = username?.trim();

    if (!cleanUsername || !password || !role) {
      throw new BadRequestException('Имя пользователя, пароль и роль обязательны');
    }

    const existingUser = await this.userRepository.findOne({
      where: { username: cleanUsername },
    });

    if (existingUser) {
      throw new ConflictException('Пользователь с таким именем уже существует');
    }

    if ((await this.userRepository.count()) >= 13) {
      throw new BadRequestException('Все пользователи уже назначены');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      username: cleanUsername,
      password: hashedPassword,
      role,
    });

    const savedUser = await this.userRepository.save(user);

    return this.toPublicUser(savedUser);
  }

  async authUser(username: string, password: string, key: string): Promise<Partial<User>> {
    if (!username || !password) {
      throw new BadRequestException('Имя и пароль обязательны');
    }

    const user = await this.userRepository.findOne({
      where: { username: username.trim() },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    const isPasswordMatching = await bcrypt.compare(password, user.password);

    if (!isPasswordMatching) {
      throw new ConflictException('Неверный пароль');
    }
    if (key !== user.key) {
      if (user.isActive) {
        throw new BadRequestException(`Пользователь ${user.username} уже активен`);
      }
    }
    user.key = Date.now().toString();
    user.isActive = true;
    await this.userRepository.save(user);

    return this.toPublicUser(user);
  }

  async logOut(id: number): Promise<void> {
    await this.userRepository.update({ id }, { isActive: false });
  }

  async findAll(page: number, limit: number): Promise<{ data: Partial<User>[]; total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: users.map((user) => this.toPublicUser(user)),
      total,
    };
  }

  async findOne(id: number): Promise<Partial<User>> {
    const user = await this.findUserEntity(id);

    return this.toPublicUser(user);
  }

  async findByUsername(username: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с именем ${username} не найден`);
    }

    return this.toPublicUser(user);
  }

  async findOperatorUsernames() {
    const users = await this.userRepository.find({
      where: {
        role: 'operator',
      },
    });
    return users.map((user) => ({
      username: user.username,
      id: user.id,
    }));
  }

  async update(id: number, userData: Partial<User>): Promise<Partial<User>> {
    const user = await this.findUserEntity(id);

    // Обновляем имя, только если поле передано.
    if (userData.username !== undefined) {
      const username = userData.username.trim();

      if (!username) {
        throw new BadRequestException('Имя пользователя не может быть пустым');
      }

      if (username !== user.username) {
        const existingUser = await this.userRepository.findOne({
          where: { username },
        });

        if (existingUser && existingUser.id !== id) {
          throw new ConflictException('Пользователь с таким именем уже существует');
        }

        user.username = username;
      }
    }

    // Пустой или отсутствующий пароль означает, что менять его не нужно.
    if (typeof userData.password === 'string' && userData.password.length > 0) {
      user.password = await bcrypt.hash(userData.password, 10);
    }

    // Обновляем роль, если она передана.
    if (userData.role !== undefined) {
      user.role = userData.role;
    }

    if (userData.isActive !== undefined) {
      user.isActive = userData.isActive;
    }

    const updatedUser = await this.userRepository.save(user);

    return this.toPublicUser(updatedUser);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findUserEntity(id);

    await this.userRepository.remove(user);
  }

  private async findUserEntity(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${id} не найден`);
    }

    return user;
  }

  private toPublicUser(user: User): Partial<User> {
    const { password: _password, ...result } = user;

    return result;
  }
}
