import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';

import { ActiveTaskEntity, ExpectedScanType } from '../aggregation/entities/active-task.entity';
import { loggerGS1 } from '../logger-winston/winston.config';

@Injectable()
export class Gs1ParserService {
  private readonly GS = '\x1D';

  getScanType(code: string, activeTask: ActiveTaskEntity): ExpectedScanType {
    if (!code?.trim()) {
      this.throwGs1Error('Пустой код');
    }

    const normalizedCode = this.normalizeGS(code.trim());

    if (this.isProductCode(normalizedCode)) {
      this.validateProduct(normalizedCode, activeTask);
      return ExpectedScanType.PRODUCT;
    }

    return this.parseSscc(normalizedCode);
  }

  getContainerNumber(code: string): string {
    if (!code?.trim()) {
      this.throwGs1Error('Пустой код');
    }

    return this.extractContainerNumber(code);
  }

  private validateProduct(code: string, activeTask: ActiveTaskEntity) {
    if (!code.startsWith('01')) {
      this.throwGs1Error('Некорректный код товара: ожидается AI 01');
    }

    const gtin = code.substring(2, 16);

    this.validateGtinFormat(gtin);

    if (gtin !== activeTask.gtin) {
      this.throwGs1Error(`GTIN не совпадает с заданием`);
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

  private parseSscc(code: string) {
    if (!code.startsWith('00')) {
      this.throwGs1Error(
        'Код не соответствует формату: ожидался товарный код AI 01 или SSCC с AI 00',
      );
    }

    if (!/^00\d{18}$/.test(code)) {
      this.throwGs1Error('Некорректный SSCC: после AI 00 должны идти ровно 18 цифр');
    }

    const sscc = code.substring(2);

    const extensionDigit = sscc.charAt(0);
    const labelGln = sscc.substring(1, 10);

    this.validateGln(labelGln);

    return this.getContainerType(extensionDigit);
  }

  private getContainerType(extensionDigit: string): ExpectedScanType {
    switch (extensionDigit) {
      case '7':
        return ExpectedScanType.SMALL_BOX_LABEL;

      case '8':
        return ExpectedScanType.BIG_BOX_LABEL;

      case '9':
        return ExpectedScanType.PALLET_LABEL;

      default:
        this.throwGs1Error(
          `Неизвестный тип тары в SSCC: ${extensionDigit}. Ожидалась цифра 7, 8 или 9`,
        );
    }
  }

  private validateGln(labelGln: string) {
    const expectedGln = process.env.GLN?.trim();

    //TODO Отдельный модуль валидации енв

    if (!expectedGln) {
      const message = 'Не задан GLN в переменной окружения GLN';
      loggerGS1.error(message);
      throw new InternalServerErrorException(message);
    }

    if (!/^\d{9}$/.test(expectedGln)) {
      const message = 'Некорректная настройка GLN: ожидается идентификатор из 9 цифр';

      loggerGS1.error(message);
      throw new InternalServerErrorException(message);
    }

    if (labelGln !== expectedGln) {
      this.throwGs1Error(
        `GLN этикетки не совпадает с настройкой: ожидался ${expectedGln}, получен ${labelGln}`,
      );
    }
  }

  private extractContainerNumber(sscc: string): string {
    const serialReference = sscc.substring(13, 19);
    return serialReference.replace(/^0+/, '') || '0';
  }

  private validateGtinFormat(gtin: string) {
    if (!/^\d{14}$/.test(gtin)) {
      this.throwGs1Error(`Некорректный GTIN`);
    }
  }

  private normalizeGS(code: string): string {
    return code.includes('\\x1D') ? code.replace(/\\x1D/g, this.GS) : code;
  }

  private throwGs1Error(message: string): never {
    loggerGS1.error(message);
    throw new BadRequestException(message);
  }
}
