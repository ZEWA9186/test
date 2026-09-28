import { Injectable } from '@nestjs/common';
import { CodeService } from '../code/code.service';
import { In, Repository } from 'typeorm';
import { Injector } from '@nestjs/core/injector/injector';
import { TaskCodes } from './entities/task-codes';

@Injectable()
export class CodeValidationService {
  constructor(
    private readonly codeService: CodeService,
    private readonly codeRepository: Repository<TaskCodes>,
  ) {}

  async validate(
    codes: unknown,
    gtin: string,
  ): Promise<{ errors: string[]; items: string[] }> {
    const errors: string[] = [];
    const items: string[] = [];

    // 1. Проверка на массив
    if (!Array.isArray(codes)) {
      errors.push('Коды маркировки должны быть массивом');
      items.push('codes');
      return { errors, items };
    }

    // 2. Проверка на пустоту
    if (codes.length === 0) {
      errors.push('Массив кодов не должен быть пустым');
      items.push('codes');
      return { errors, items };
    }

    // 3. Дубликаты внутри входящего массива
    if (new Set(codes).size !== codes.length) {
      errors.push('Коды маркировки содержат повторяющиеся элементы');
      items.push('codes');
    }

    // 4. Проверка по префиксу GTIN
    const expectedPrefix = gtin ? `01${gtin}` : null;
    if (
      expectedPrefix &&
      codes.some((c) => typeof c !== 'string' || !c.startsWith(expectedPrefix))
    ) {
      errors.push(
        'Коды маркировки содержат значения, не соответствующие GTIN задания',
      );
      items.push('codes');
    }

    // 5. Проверка в базе через твой сервис
    const existingCodes = await this.codeService.getCodes(codes);

    if (existingCodes.length > 0) {
      errors.push('Обнаружены дубликаты в базе данных');
      items.push('codes');
    }

    // 6. Проверка по таблице task_codes через репозиторий
    const existingTaskCodes = await this.codeRepository.find({
      where: { code: In(codes) },
      select: ['code'], // вытягиваем только сами коды для оптимизации
    });

    if (existingTaskCodes.length > 0) {
      errors.push('Обнаружены дубликаты в базе данных');
      items.push('codes');
    }

    return { errors, items };
  }
  async cleanAndFilterCodes(codes: unknown, gtin?: string): Promise<string[]> {
    if (!Array.isArray(codes) || codes.length === 0) {
      return [];
    }

    // Явно фильтруем и приводим элементы к строкам
    const stringCodes: string[] = codes.filter(
      (c): c is string => typeof c === 'string',
    );

    if (stringCodes.length === 0) {
      return [];
    }

    const expectedPrefix = gtin ? `01${gtin}` : null;
    const uniqueCodes = Array.from(new Set(stringCodes)).filter((code) => {
      if (expectedPrefix && !code.startsWith(expectedPrefix)) return false;
      return true;
    });

    if (uniqueCodes.length === 0) {
      return [];
    }

    const [existingCodes, existingTaskCodes] = await Promise.all([
      this.codeService.getCodes(uniqueCodes),
      this.codeRepository.find({
        where: { code: In(uniqueCodes) },
        select: ['code'],
      }),
    ]);

    const dbDuplicates = new Set([
      ...existingCodes,
      ...existingTaskCodes.map((t) => t.code),
    ]);

    return uniqueCodes.filter((code) => !dbDuplicates.has(code));
  }
}
