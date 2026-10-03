import { BadRequestException, Injectable } from '@nestjs/common';

import { FIXED_LENGTH_AI, TemplateItem } from './interfaces/gs1.types';

import { TemplateTypes } from '../globalTypes';
import { TemplateService } from '../template/template.service';
import { ActiveTaskEntity, ExpectedScanType } from '../aggregation/entities/active-task.entity';

@Injectable()
export class Gs1ParserService {
  private readonly GS = '\x1D';

  constructor(private readonly templateService: TemplateService) {}

  getScanType(code: string, activeTask: ActiveTaskEntity): ExpectedScanType {
    if (!code) {
      throw new BadRequestException('Пустой код');
    }

    if (!activeTask) {
      throw new BadRequestException('Нет активного задания');
    }

    const normalizedCode = this.normalizeGS(code);

    if (this.isProductCode(normalizedCode)) {
      this.validateProduct(normalizedCode, activeTask);

      return ExpectedScanType.PRODUCT;
    }

    const templates = this.templateService.getAll();

    const smallBoxTemplate = templates.find((template) => template.type === TemplateTypes.SmallBox);

    const bigBoxTemplate = templates.find((template) => template.type === TemplateTypes.BigBox);

    const palletTemplate = templates.find((template) => template.type === TemplateTypes.Pallet);

    if (smallBoxTemplate && this.validateTemplate(normalizedCode, smallBoxTemplate.template)) {
      const parsedData = this.parseByTemplate(normalizedCode, smallBoxTemplate.template);

      this.validateAgainstTask(parsedData, smallBoxTemplate.template, activeTask);

      return ExpectedScanType.SMALL_BOX_LABEL;
    }

    if (bigBoxTemplate && this.validateTemplate(normalizedCode, bigBoxTemplate.template)) {
      const parsedData = this.parseByTemplate(normalizedCode, bigBoxTemplate.template);

      this.validateAgainstTask(parsedData, bigBoxTemplate.template, activeTask);

      return ExpectedScanType.BIG_BOX_LABEL;
    }

    if (palletTemplate && this.validateTemplate(normalizedCode, palletTemplate.template)) {
      const parsedData = this.parseByTemplate(normalizedCode, palletTemplate.template);

      this.validateAgainstTask(parsedData, palletTemplate.template, activeTask);

      return ExpectedScanType.PALLET_LABEL;
    }

    throw new BadRequestException('Код не соответствует формату товара, коробки или палеты');
  }

  private validateProduct(code: string, activeTask: ActiveTaskEntity): void {
    if (!code.startsWith('01')) {
      throw new BadRequestException('Некорректный код товара: ожидается AI 01');
    }

    const gtin = code.substring(2, 16);

    if (!/^\d{14}$/.test(gtin)) {
      throw new BadRequestException(
        `Некорректный GTIN товара: ожидается 14 цифр, получено "${gtin}"`,
      );
    }

    if (!activeTask.gtin) {
      throw new BadRequestException('В активном задании не указан GTIN');
    }

    if (gtin !== activeTask.gtin) {
      throw new BadRequestException(
        `GTIN товара не совпадает с заданием: ` + `ожидался ${activeTask.gtin}, получен ${gtin}`,
      );
    }
  }

  private isProductCode(code: string): boolean {
    return (
      code.length >= 18 &&
      code.startsWith('01') &&
      /^\d{14}$/.test(code.substring(2, 16)) &&
      code.substring(16, 18) === '21'
    );
  }

  private validateTemplate(code: string, template: string[]): boolean {
    const normalizedCode = this.normalizeGS(code);
    const normalizedTemplate = this.normalizeTemplate(template);

    let position = 0;

    for (let i = 0; i < normalizedTemplate.length; i++) {
      const item = normalizedTemplate[i];

      if (!item.ai) {
        continue;
      }

      const ai = item.ai;

      const actualAI = normalizedCode.substring(position, position + ai.length);

      if (actualAI !== ai) {
        return false;
      }

      position += ai.length;

      if (this.isFixedLength(ai)) {
        const fixedLength = FIXED_LENGTH_AI[ai];

        if (position + fixedLength > normalizedCode.length) {
          return false;
        }

        position += fixedLength;
        continue;
      }

      const nextGSPosition = normalizedCode.indexOf(this.GS, position);

      if (nextGSPosition === -1) {
        if (i === normalizedTemplate.length - 1) {
          position = normalizedCode.length;
          continue;
        }

        return false;
      }

      if (i < normalizedTemplate.length - 1) {
        const nextItem = normalizedTemplate[i + 1];

        if (nextItem.ai) {
          const nextAIPosition = nextGSPosition + 1;

          if (nextAIPosition + nextItem.ai.length > normalizedCode.length) {
            return false;
          }

          const nextAI = normalizedCode.substring(
            nextAIPosition,
            nextAIPosition + nextItem.ai.length,
          );

          if (nextAI !== nextItem.ai) {
            return false;
          }
        }
      }

      position = nextGSPosition + 1;
    }

    return position === normalizedCode.length;
  }

  private parseByTemplate(code: string, rawTemplate: string[]): Record<string, string> {
    const template = this.normalizeTemplate(rawTemplate);
    const result: Record<string, string> = {};

    let position = 0;

    for (const item of template) {
      if (!item.ai) {
        continue;
      }

      const ai = item.ai;

      const actualAI = code.substring(position, position + ai.length);

      if (actualAI !== ai) {
        throw new BadRequestException(
          `Ошибка разбора GS1: ожидался AI ${ai} ` + `на позиции ${position}, найден ${actualAI}`,
        );
      }

      position += ai.length;

      if (this.isFixedLength(ai)) {
        const fixedLength = FIXED_LENGTH_AI[ai];

        if (position + fixedLength > code.length) {
          throw new BadRequestException(`Ошибка разбора GS1: недостаточно данных для AI ${ai}`);
        }

        result[ai] = code.substring(position, position + fixedLength);

        position += fixedLength;
        continue;
      }

      const nextGSPosition = code.indexOf(this.GS, position);

      if (nextGSPosition === -1) {
        result[ai] = code.substring(position);
        position = code.length;
      } else {
        result[ai] = code.substring(position, nextGSPosition);

        position = nextGSPosition + 1;
      }
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
    let gtin: string | undefined;

    for (const [ai, value] of Object.entries(parsedData)) {
      const semantic = semanticMap[ai];

      if (semantic === 'gtin' || semantic === 'itf14') {
        gtin = value;
        break;
      }
    }

    if (!gtin) {
      gtin = parsedData['01'] || parsedData['02'];
      // TODO || parsedData['03'] || parsedData['04'];
      // для этикеток большой коробки и палеты
    }

    if (!gtin) {
      throw new BadRequestException('В этикетке отсутствует GTIN/ITF14');
    }

    const expectedGtin = activeTask.gtin || activeTask.ITF14;

    if (!expectedGtin) {
      throw new BadRequestException('В активном задании не указан GTIN/ITF14');
    }

    if (gtin !== expectedGtin) {
      throw new BadRequestException(
        `GTIN/ITF14 этикетки не совпадает с заданием: ` +
          `ожидался ${expectedGtin}, получен ${gtin}`,
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
      throw new BadRequestException(
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
      throw new BadRequestException(
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

  private extractContainerNumber(parsedData: Record<string, string>): string | null {
    const containerNumber = parsedData['21'];

    if (!containerNumber) {
      return null;
    }

    return containerNumber.replace(/^\x1D+|\x1D+$/g, '');
  }
}
