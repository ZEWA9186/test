import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { TaskCodesEntity } from './entities/task-codes.entity';
import { TaskValidationResult } from './dto/task-validation-dto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { CodeEntity } from '../code/entities/code.entity';
import { logger1S } from '../logger-winston/winston.config';

@Injectable()
export class CodeValidationService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    @InjectRepository(TaskCodesEntity)
    private readonly taskCodesEntityRepository: Repository<TaskCodesEntity>,
  ) {}

  async validate(codes: string[], gtin: string): Promise<TaskValidationResult> {
    const baseCheck = await this.defaultCheck(codes, gtin);
    if (baseCheck.errors.length > 0) {
      return baseCheck;
    }

    const errors: string[] = [];
    const items: string[] = [];

    const uniqueCodes = baseCheck.codes ?? codes;
    if (uniqueCodes.length !== codes.length) {
      errors.push('Коды маркировки содержат повторяющиеся элементы');
      items.push('codes');
    }
    // 3. Проверка в первой базе (через сервис)
    const existingCodes: CodeEntity[] = await this.dataSource.query(
      'SELECT code FROM "code_entity" WHERE code = ANY($1)',
      [uniqueCodes],
    );

    if (existingCodes.length > 0) {
      errors.push('Обнаружены дубликаты в базе данных');
      items.push('codes');
      logger1S.warn('[VALIDATION] Обнаружены дубликаты codeEntity');
    }

    // 4. Проверка во второй базе (в task_codes)
    const existingTaskCodes = await this.taskCodesEntityRepository.find({
      where: { code: In(uniqueCodes) },
      select: ['code'],
    });

    if (existingTaskCodes.length > 0) {
      errors.push('Обнаружены дубликаты в базе данных');
      items.push('codes');
      logger1S.warn('[VALIDATION] Обнаружены дубликаты taskCodes');
    }

    return { errors, items };
  }

  async cleanAndFilterCodes(
    codes: string[],
    gtin: string,
  ): Promise<TaskValidationResult> {
    // 1. Прогоняем через те же базовые проверки
    const baseCheck = await this.defaultCheck(codes, gtin);
    if (baseCheck.errors.length > 0) {
      return baseCheck;
    }

    const uniqueCodes = baseCheck.codes ?? Array.from(new Set(codes));

    // 2. Тянем данные из первой базы (через сервис)
    const codesFromFirstBase: string[] = (
      await this.dataSource.query(
        'SELECT code FROM "code_entity" WHERE code = ANY($1)',
        [uniqueCodes],
      )
    ).map((code: CodeEntity) => code.code);

    // 3. Тянем данные из второй базы (из task_codes)
    const codesFromTaskRepo: string[] = (
      await this.taskCodesEntityRepository.find({
        where: { code: In(uniqueCodes) },
        select: ['code'],
      })
    ).map((item) => item.code);

    // 4. Собираем всё найденное в черный список
    const blackList = new Set([...codesFromFirstBase, ...codesFromTaskRepo]);

    // 5. Оставляем только те коды, которых нет ни в одной из баз
    const validCodes = uniqueCodes.filter((code) => !blackList.has(code));

    return {
      codes: validCodes,
      errors: [],
      items: [],
    };
  }

  private async defaultCheck(
    codes: string[],
    gtin: string,
  ): Promise<TaskValidationResult> {
    const items: string[] = [];
    const errors: string[] = [];

    if (!Array.isArray(codes) || codes.length === 0) {
      errors.push('Массив кодов не должен быть пустым');
      items.push('codes');
      return { errors, items };
    }

    const expectedPrefix = `01${gtin}`;
    if (
      codes.some((c) => typeof c !== 'string' || !c.startsWith(expectedPrefix))
    ) {
      errors.push(
        'Коды маркировки содержат значения, не соответствующие GTIN задания',
      );
      items.push('codes');
      return { errors, items };
    }

    const uniqueCodes: string[] = Array.from(new Set(codes));

    return {
      codes: uniqueCodes,
      errors,
      items,
    };
  }
}
