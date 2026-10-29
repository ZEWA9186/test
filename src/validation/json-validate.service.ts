import * as fs from 'fs';
import * as path from 'path';
import { logger1S } from '../logger-winston/winston.config';
import { CodeValidationService } from './code-validation.service';
import { getJsonDirectory1STemplate, getTemplateDirectory } from '../config/config.paths';
import { TASK } from '../files1s/sample';
import { Injectable } from '@nestjs/common';
import { TaskValidationResult } from '../files1s/dto/task-validation-dto';
import { isCodeFilterEnabled } from '../config/config.env';

@Injectable()
export class JsonValidationService {
  constructor(private readonly codeValidationService: CodeValidationService) {}

  async validateJson(jsonData: any): Promise<TaskValidationResult> {
    if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
      return {
        errors: ['Ожидается JSON-объект'],
        items: [],
      };
    }

    const errors: string[] = [];
    const items: string[] = [];
    let codes: string[] = [];

    const aggregationLevel = Number(jsonData.aggregationLvl);
    const templateDir = getJsonDirectory1STemplate();
    let templateFields: string[] = [];

    try {
      const templateFiles = (await fs.promises.readdir(templateDir)).filter((f) =>
        f.endsWith('.json'),
      );

      if (templateFiles.length === 0) {
        logger1S.error('[VALIDATION] В директории шаблонов нет JSON файлов');
        return {
          errors: ['Не найден файл шаблона'],
          items: ['В директории шаблонов нет JSON файлов'],
        };
      }

      if (templateFiles.length > 1) {
        logger1S.warn(
          `[VALIDATION] Найдено несколько JSON файлов в директории шаблонов. Будет использован первый: ${templateFiles[0]}`,
        );
      }

      const templatePath = path.join(templateDir, templateFiles[0]);
      const templateContent = await fs.promises.readFile(templatePath, 'utf-8');
      templateFields = Object.keys(JSON.parse(templateContent));

      if (templateFields.length === 0) {
        logger1S.error('[VALIDATION] Шаблонный файл не содержит полей');
        return {
          errors: ['Шаблонный файл пустой'],
          items: ['Шаблонный файл не содержит полей'],
        };
      }
    } catch (err: any) {
      logger1S.error('[VALIDATION] Ошибка загрузки шаблона:', err.message ?? err);
      return {
        errors: ['Ошибка загрузки шаблона'],
        items: ['Ошибка загрузки шаблона'],
      };
    }

    const activeFields = TASK.filter((field) => templateFields.includes(field.name));

    // 3. Проверяем наличие полей из шаблона в JSON
    for (const fieldName of templateFields) {
      const fieldInfo = TASK.find((field) => field.name === fieldName);
      const required = fieldInfo ? this.isRequiredForLevel(fieldInfo, aggregationLevel) : true;

      if (required && !(fieldName in jsonData)) {
        const fieldLabel = fieldInfo?.label || fieldName;
        errors.push(`Отсутствует обязательное поле: ${fieldLabel}`);
        items.push(fieldName);
      }
    }

    // 4. Проверяем значения полей
    for (const field of activeFields) {
      const value = jsonData[field.name];

      if (!templateFields.includes(field.name) || (field.allowSpace && value === ' ')) {
        continue;
      }

      const required = this.isRequiredForLevel(field, aggregationLevel);
      const isEmpty =
        value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

      if (required && isEmpty) {
        errors.push(`Обязательное поле ${field.label} не может быть пустым`);
        items.push(field.name);
        continue;
      }

      if (isEmpty) {
        continue;
      }

      switch (field.name) {
        case 'gtin':
        case 'ITF14':
          if (!/^\d{14}$/.test(value)) {
            errors.push(`${field.label} требует ровно 14 цифр`);
            items.push(field.name);
          }
          break;

        case 'dateManufacture':
        case 'dateExpiration':
          if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
            errors.push(`${field.label} должен быть в формате ДД.ММ.ГГГГ`);
            items.push(field.name);
          }
          break;

        case 'aggregationLvl':
          if (!/^\d+$/.test(value) || ![1, 2, 3].includes(Number(value))) {
            errors.push(`${field.label} должен быть 1, 2 или 3`);
            items.push(field.name);
          }
          break;

        case 'piecesPerSmallBox':
        case 'piecesPerBigBox':
        case 'piecesPerPallet':
          if (!/^\d+$/.test(value) || parseInt(value, 10) <= 0) {
            errors.push(`${field.label} должно быть целым числом > 0`);
            items.push(field.name);
          }
          break;

        case 'nettoUnit':
        case 'bruttoUnit':
        case 'bruttoBox':
          if (!/^\d+(\.\d+)?$/.test(value) || parseFloat(value) <= 0) {
            errors.push(`${field.label} должно быть положительным числом`);
            items.push(field.name);
          }
          break;

        case 'codes': {
          try {
            const codeValidation = isCodeFilterEnabled()
              ? await this.codeValidationService.cleanAndFilterCodes(value, jsonData.gtin)
              : await this.codeValidationService.validate(value, jsonData.gtin);

            if (codeValidation.errors.length > 0) {
              errors.push(...codeValidation.errors);
              items.push(...codeValidation.items);
            }

            if (codeValidation.codes) {
              codes = codeValidation.codes;
            }
          } catch (err: any) {
            logger1S.error('[VALIDATION] Ошибка при валидации кодов:', err.message);
            errors.push('Ошибка валидации кодов');
            items.push(field.name);
          }
          break;
        }

        case 'smallBoxLabel':
        case 'bigBoxLabel':
        case 'palletLabel': {
          const templateDirectory = getTemplateDirectory();
          const templateFilePath = path.join(templateDirectory, `${value}.prn`);

          try {
            await fs.promises.access(templateFilePath);
          } catch {
            errors.push(`Шаблон ${field.label} не найден: ${value}.prn`);
            items.push(field.name);
          }
          break;
        }
      }
    }

    return { codes, errors, items };
  }

  private isRequiredForLevel(field: (typeof TASK)[number], aggregationLevel: number): boolean {
    if (field.name === 'smallBoxLabel') {
      return aggregationLevel === 3;
    }

    if (field.name === 'bigBoxLabel') {
      return aggregationLevel >= 2;
    }

    if (field.name === 'piecesPerSmallBox') {
      return aggregationLevel === 3;
    }

    if (field.name === 'piecesPerBigBox') {
      return aggregationLevel >= 2;
    }

    return field.required === true;
  }
}
