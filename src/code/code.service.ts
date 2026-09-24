import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CodeEntity } from './entities/code.entity';
import { codeLogger } from '../logger-winston/winston.config';

@Injectable()
export class CodeService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    @InjectRepository(CodeEntity)
    private readonly codeRepository: Repository<CodeEntity>,
  ) {}

  async validateAndSaveCode(code: string) {

    if (!code) {
      throw new BadRequestException('Код не может быть пустым');
    }

    try {
      // await this.codeRepository.insert({ code });
      await this.dataSource.query(
        'INSERT INTO "code_entity" ("code") VALUES ($1)',
        [code],
      );

      return { message: 'Код успешно сохранён' };
    } catch (err: any) {
      if (err?.code === '23505') {
        codeLogger.warn(`Попытка дублирования кода: ${code}`);
        throw new ConflictException('Код уже существует в базе');
      }

      codeLogger.error(
        `Ошибка при сохранении кода: ${err?.message || err}`,
      );
      throw new InternalServerErrorException('Ошибка при сохранении кода');
    }
  }

  async batchValidateAndSaveCode(codes: string[]) {
    if (!codes || !codes.length) {
      throw new BadRequestException('Передан пустой массив кодов');
    }

    if (new Set(codes).size !== codes.length) {
      codeLogger.warn('В переданном массиве есть дубликаты');
      throw new BadRequestException('В переданном массиве есть дубликаты');
    }

    try {
      await this.codeRepository.insert(codes.map((code) => ({ code })));

      return { message: 'Коды успешно сохранены' };
    } catch (error: any) {
      if (error?.code === '23505') {
        codeLogger.warn('Один или несколько кодов уже есть в базе');
        throw new ConflictException('Один или несколько кодов уже есть в базе');
      }

      codeLogger.error(
        `Ошибка при сохранении кодов: ${error?.message || error}`,
      );
      throw new InternalServerErrorException('Ошибка при сохранении кодов');
    }
  }

  async getCodes(codes: string[]) {
    const data: CodeEntity[] = await this.codeRepository.query(
      'SELECT code FROM "code_entity" WHERE code = ANY($1)',
      [codes],
    );
    return data.map((el: CodeEntity) => el.code);
  }

  async deleteCode(code: string) {
    try {
      await this.codeRepository.delete({ code });
      codeLogger.info('Удаление кода');

      return { message: 'Код успешно удалён' };
    } catch (error: any) {
      codeLogger.error(error.message || error);
      throw new InternalServerErrorException();
    }
  }

  async batchDeleteCodes(codes: string[]) {
    if (!codes || !codes.length) {
      return {message: 'Кодов не было'};
    }
    try {
      await this.codeRepository.delete(codes);
      codeLogger.info('Коды удалены');
      return {message: 'Коды успешно удалены'}
    }catch (error: any) {
      codeLogger.error(error.message || error);
      throw new InternalServerErrorException();
    }
  }
}
