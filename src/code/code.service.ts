import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { codeLogger } from '../logger-winston/winston.config';
import { CodeEntity } from './entities/code.entity';

@Injectable()
export class CodeService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private getManager(manager?: EntityManager): EntityManager {
    return manager ?? this.dataSource.manager;
  }

  async validateAndSaveCode(code: string, manager?: EntityManager): Promise<void> {
    if (!code) {
      throw new BadRequestException('Код не считан');
    }

    try {
      await this.getManager(manager).query('INSERT INTO "code_entity" ("code") VALUES ($1)', [
        code,
      ]);
    } catch (error: any) {
      if (error?.code === '23505') {
        codeLogger.warn(`Попытка дублирования кода: ${code}`);
        throw new ConflictException('Код уже существует в базе');
      }

      codeLogger.error(`Ошибка при сохранении кода: ${error?.message || error}`);
      throw new InternalServerErrorException('Ошибка при сохранении кода');
    }
  }

  async batchValidateAndSaveCode(codes: string[], manager?: EntityManager): Promise<void> {
    if (!codes?.length) {
      throw new BadRequestException('Передан пустой массив кодов');
    }

    if (new Set(codes).size !== codes.length) {
      codeLogger.warn('В переданном массиве есть дубликаты');
      throw new BadRequestException('В переданном массиве есть дубликаты');
    }

    try {
      await this.getManager(manager).query(
        'INSERT INTO "code_entity" ("code") SELECT unnest($1::text[])',
        [codes],
      );
    } catch (error: any) {
      if (error?.code === '23505') {
        codeLogger.warn('Один или несколько кодов уже есть в базе');
        throw new ConflictException('Один или несколько кодов уже есть в базе');
      }

      codeLogger.error(`Ошибка при сохранении кодов: ${error?.message || error}`);
      throw new InternalServerErrorException('Ошибка при сохранении кодов');
    }
  }

  async getCodes(codes: string[], manager?: EntityManager): Promise<string[]> {
    if (!codes?.length) {
      return [];
    }

    try {
      const data: CodeEntity[] = await this.getManager(manager).query(
        'SELECT code FROM "code_entity" WHERE code = ANY($1)',
        [codes],
      );

      return data.map((el) => el.code);
    } catch (error: any) {
      codeLogger.error(`Ошибка при получении кодов: ${error?.message || error}`);
      throw new InternalServerErrorException('Ошибка при получении кодов');
    }
  }

  async deleteCode(code: string, manager?: EntityManager): Promise<void> {
    try {
      await this.getManager(manager).query('DELETE FROM "code_entity" WHERE "code" = $1', [code]);

      codeLogger.info('Код удалён');
    } catch (error: any) {
      codeLogger.error(`Ошибка при удалении кода: ${error?.message || error}`);
      throw new InternalServerErrorException('Ошибка при удалении кода');
    }
  }

  async batchDeleteCodes(codes: string[], manager?: EntityManager): Promise<void> {
    if (!codes?.length) {
      return;
    }

    try {
      await this.getManager(manager).query('DELETE FROM "code_entity" WHERE "code" = ANY($1)', [
        codes,
      ]);

      codeLogger.info('Коды удалены');
    } catch (error: any) {
      codeLogger.error(`Ошибка при удалении кодов: ${error?.message || error}`);
      throw new InternalServerErrorException('Ошибка при удалении кодов');
    }
  }
}
