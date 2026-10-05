import { Injectable, Inject } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { PrinterService } from '../printer.service';
import { Logger } from 'winston';
import { printerLogger } from '../../logger-winston/winston.config';
import { getTemplateDirectory } from '../../path.utils';

@Injectable()
export class PrinterDMService {
  constructor(
    private readonly printerService: PrinterService,
    @Inject('winston') private readonly logger: Logger = printerLogger,
  ) {}

  public async printBigCode(codeData: string): Promise<void> {
    try {
      const sanitizedCode = codeData.replaceAll('\u001d', '@').replaceAll('@', '$d029');

      this.logger.info('[PRINTER] Печать большого кода');

      const templatePath = path.join(getTemplateDirectory(), 'templateBig.prn');

      this.logger.debug(`[PRINTER] Шаблон: ${templatePath}`);

      const templateContent = await fs.readFile(templatePath, 'utf-8');

      const commands = templateContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((command) => command.replace('<GS1>', `$1${sanitizedCode}`));

      await this.printerService.addToPrintQueue(commands, 'большого кода');
    } catch (err: any) {
      this.logger.error(`[PRINTER] Ошибка печати большого кода: ${err.message || err}`);
    }
  }

  public async printCode(codeData: string): Promise<void> {
    try {
      const sanitizedCode = codeData.replaceAll('\u001d', '@').replaceAll('@', '$d029');

      this.logger.info('[PRINTER] Печать кода');

      const templatePath = path.join(getTemplateDirectory(), 'template.prn');

      this.logger.debug(`[PRINTER] Шаблон: ${templatePath}`);

      const templateContent = await fs.readFile(templatePath, 'utf-8');

      const commands = templateContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((command) => command.replace('<GS1>', `$1${sanitizedCode}`));

      await this.printerService.addToPrintQueue(commands, 'кода');
    } catch (err: any) {
      this.logger.error(`[PRINTER] Ошибка печати кода: ${err.message || err}`);
    }
  }

  public async printEmptyLabel(): Promise<void> {
    this.logger.info('[PRINTER] Печать пустой этикетки');

    try {
      await this.printerService.addToPrintQueue(
        [
          'SIZE 18.7 mm, 20.1 mm',
          'GAP 3 mm, 0 mm',
          'DIRECTION 0,0',
          'REFERENCE 0,0',
          'CLS',
          'PRINT 1,1',
        ],
        'пустой этикетки',
      );
    } catch (err: any) {
      this.logger.error(`[PRINTER] Ошибка печати пустой этикетки: ${err.message || err}`);
    }
  }
}
