import { BadRequestException, Injectable } from '@nestjs/common';

import { FIXED_LENGTH_AI, TemplateItem } from './interfaces/gs1.types';
import { TemplateTypes } from '../globalTypes';
import { TemplateService } from '../template/template.service';
import { ActiveTaskEntity, ExpectedScanType } from '../aggregation/entities/active-task.entity';
import { loggerGS1 } from '../logger-winston/winston.config';

@Injectable()
export class Gs1ParserService {
  private readonly GS = '\x1D';

  constructor(private readonly templateService: TemplateService) {}

  getScanType(code: string, activeTask: ActiveTaskEntity): ExpectedScanType {
    if (!code) {
      this.throwGs1Error('Пустой код');
    }

    if (!activeTask) {
      this.throwGs1Error('Нет активного задания');
    }

    const normalizedCode = this.normalizeGS(code);

    // Обычный код товара
    if (this.isProductCode(normalizedCode)) {
      this.validateProduct(normalizedCode, activeTask);

      return ExpectedScanType.PRODUCT;
    }

    const templates = this.templateService.getAll();

    const templateTypes = [
      {
        type: TemplateTypes.smallBox,
        scanType: ExpectedScanType.SMALL_BOX_LABEL,
      },
      {
        type: TemplateTypes.bigBox,
        scanType: ExpectedScanType.BIG_BOX_LABEL,
      },
      {
        type: TemplateTypes.pallet,
        scanType: ExpectedScanType.PALLET_LABEL,
      },
    ];

    for (const { type, scanType } of templateTypes) {
      const template = templates.find((item) => item.type === type);

      if (!template) {
        continue;
      }

      const parsedData = this.parseByTemplate(normalizedCode, template.template);

      if (!parsedData) {
        continue;
      }

      this.validateAgainstTask(parsedData, template.template, activeTask);

      return scanType;
    }

    this.throwGs1Error('Код не соответствует формату товара, коробки или палеты');
  }

  /**
   * Проверяет обычный код товара.
   *
   * Формат:
   * 01 + GTIN(14) + 21 + серийный номер
   */
  private validateProduct(code: string, activeTask: ActiveTaskEntity): void {
    if (!code.startsWith('01')) {
      this.throwGs1Error('Некорректный код товара: ожидается AI 01');
    }

    const gtin = code.substring(2, 16);

    this.validateGtinFormat(gtin);

    this.validateGtinAgainstTask(gtin, activeTask.gtin, 'GTIN товара');
  }

  private isProductCode(code: string): boolean {
    return (
      code.length >= 18 &&
      code.startsWith('01') &&
      /^\d{14}$/.test(code.substring(2, 16)) &&
      code.substring(16, 18) === '21'
    );
  }

  private parseByTemplate(code: string, rawTemplate: string[]): Record<string, string> | null {
    const template = this.normalizeTemplate(rawTemplate);

    const result: Record<string, string> = {};

    let position = 0;

    for (let i = 0; i < template.length; i++) {
      const item = template[i];

      if (!item.ai) {
        continue;
      }

      const ai = item.ai;

      // Проверяем AI в текущей позиции.
      const actualAI = code.substring(position, position + ai.length);

      if (actualAI !== ai) {
        return null;
      }

      position += ai.length;

      // AI фиксированной длины.
      if (this.isFixedLength(ai)) {
        const fixedLength = FIXED_LENGTH_AI[ai];

        if (position + fixedLength > code.length) {
          return null;
        }

        result[ai] = code.substring(position, position + fixedLength);

        position += fixedLength;

        continue;
      }

      const nextGSPosition = code.indexOf(this.GS, position);

      if (nextGSPosition === -1) {
        if (i === template.length - 1) {
          result[ai] = code.substring(position);
          position = code.length;

          continue;
        }

        return null;
      }

      result[ai] = code.substring(position, nextGSPosition);

      position = nextGSPosition + 1;

      if (i < template.length - 1) {
        const nextItem = template[i + 1];

        if (nextItem.ai) {
          if (position + nextItem.ai.length > code.length) {
            return null;
          }

          const nextAI = code.substring(position, position + nextItem.ai.length);

          if (nextAI !== nextItem.ai) {
            return null;
          }
        }
      }
    }

    if (position !== code.length) {
      return null;
    }

    return result;
  }

  private validateAgainstTask(
    parsedData: Record<string, string>,
    rawTemplate: string[],
    activeTask: ActiveTaskEntity,
  ): void {
    const semanticMap = this.getSemanticMap(rawTemplate);

    this.validateGtin(parsedData, semanticMap, activeTask);

    this.validateDate(
      parsedData,
      semanticMap,
      'production_date',
      activeTask.dateManufacture,
      'Дата производства',
    );

    this.validateDate(
      parsedData,
      semanticMap,
      'expiration_date',
      activeTask.dateExpiration,
      'Срок годности',
    );

    this.validateBatch(parsedData, semanticMap, activeTask.batch);
  }

  private validateGtin(
    parsedData: Record<string, string>,
    semanticMap: Record<string, string>,
    activeTask: ActiveTaskEntity,
  ): void {
    const labelGtin = this.extractGtin(parsedData, semanticMap);

    if (!labelGtin) {
      this.throwGs1Error('В этикетке отсутствует GTIN/ITF14');
    }

    const expectedGtin = activeTask.gtin || activeTask.ITF14;

    if (!expectedGtin) {
      this.throwGs1Error('В активном задании не указан GTIN/ITF14');
    }

    this.validateGtinFormat(labelGtin);

    this.validateGtinAgainstTask(labelGtin, expectedGtin, 'GTIN/ITF14 этикетки');
  }

  private extractGtin(
    parsedData: Record<string, string>,
    semanticMap: Record<string, string>,
  ): string | undefined {
    for (const [ai, value] of Object.entries(parsedData)) {
      const semantic = semanticMap[ai];

      if (semantic === 'gtin' || semantic === 'itf14') {
        return value;
      }
    }

    return parsedData['01'] || parsedData['02'];
  }

  private validateGtinFormat(gtin: string): void {
    if (!/^\d{14}$/.test(gtin)) {
      this.throwGs1Error(`Некорректный GTIN: ожидается 14 цифр, получено "${gtin}"`);
    }
  }

  private validateGtinAgainstTask(
    actualGtin: string,
    expectedGtin: string,
    fieldName: string,
  ): void {
    if (!expectedGtin) {
      this.throwGs1Error('В активном задании не указан GTIN');
    }

    if (actualGtin !== expectedGtin) {
      this.throwGs1Error(
        `${fieldName} не совпадает с заданием: ` +
          `ожидался ${expectedGtin}, получен ${actualGtin}`,
      );
    }
  }

  private validateDate(
    parsedData: Record<string, string>,
    semanticMap: Record<string, string>,
    semantic: string,
    expectedDate: string,
    fieldName: string,
  ): void {
    let valueFromLabel: string | undefined;

    for (const [ai, value] of Object.entries(parsedData)) {
      if (semanticMap[ai] === semantic) {
        valueFromLabel = value;
        break;
      }
    }

    if (!valueFromLabel) {
      return;
    }

    const expectedValue = this.formatDateForLabel(expectedDate);

    if (valueFromLabel !== expectedValue) {
      this.throwGs1Error(
        `${fieldName} этикетки не совпадает с заданием: ` +
          `ожидалось ${expectedValue}, получено ${valueFromLabel}`,
      );
    }
  }

  private validateBatch(
    parsedData: Record<string, string>,
    semanticMap: Record<string, string>,
    expectedBatch: string,
  ): void {
    let batchFromLabel: string | undefined;

    for (const [ai, value] of Object.entries(parsedData)) {
      const semantic = semanticMap[ai];

      if (semantic === 'batch' || semantic === 'lot') {
        batchFromLabel = value;
        break;
      }
    }

    if (!batchFromLabel) {
      batchFromLabel = parsedData['10'];
    }

    if (!batchFromLabel || !expectedBatch) {
      return;
    }

    if (!this.compareBatchValue(batchFromLabel, expectedBatch)) {
      this.throwGs1Error(
        `Партия этикетки не совпадает с заданием: ` +
          `ожидалась ${expectedBatch}, получена ${batchFromLabel}`,
      );
    }
  }

  private getSemanticMap(rawTemplate: string[]): Record<string, string> {
    const template = this.normalizeTemplate(rawTemplate);

    const semanticMap: Record<string, string> = {};

    for (const item of template) {
      if (item.ai && item.semantic) {
        semanticMap[item.ai] = item.semantic;
      }
    }

    return semanticMap;
  }

  private normalizeTemplate(template: string[]): TemplateItem[] {
    return template.map((item) => {
      if (!item || item.trim() === '') {
        return {
          ai: '',
          fullString: '',
        };
      }

      const parts = item.trim().split(/\s+/);

      return {
        ai: parts[0],
        semantic: parts.slice(1).join(' ') || undefined,
        fullString: item,
      };
    });
  }

  private isFixedLength(ai: string): boolean {
    return ai in FIXED_LENGTH_AI;
  }

  private normalizeGS(code: string): string {
    if (!code) {
      return code;
    }

    return code.includes('\\x1D') ? code.replace(/\\x1D/g, String.fromCharCode(29)) : code;
  }

  private formatDateForLabel(date: string): string {
    const [day, month, year] = date.split('.');

    return `${year.slice(2)}${month}${day}`;
  }

  private compareBatchValue(valueFromLabel: string, expectedBatch: string): boolean {
    if (!valueFromLabel || !expectedBatch) {
      return false;
    }

    if (valueFromLabel === expectedBatch) {
      return true;
    }
    if (expectedBatch.length % 2 === 0) {
      return false;
    }

    if (
      valueFromLabel.length === expectedBatch.length + 1 &&
      valueFromLabel.startsWith('0') &&
      valueFromLabel.substring(1) === expectedBatch
    ) {
      return true;
    }

    if (
      valueFromLabel.length === expectedBatch.length - 1 &&
      expectedBatch.startsWith('0') &&
      valueFromLabel === expectedBatch.substring(1)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Извлекает серийный/контейнерный номер AI 21.
   */
  private extractContainerNumber(parsedData: Record<string, string>): string | null {
    const containerNumber = parsedData['21'];

    if (!containerNumber) {
      return null;
    }

    return containerNumber.replace(/^\x1D+|\x1D+$/g, '');
  }

  private throwGs1Error(message: string): never {
    loggerGS1.error(message);

    throw new BadRequestException(message);
  }
}
