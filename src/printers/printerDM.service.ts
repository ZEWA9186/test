import { Injectable, Inject } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PrinterService } from './printer.service';
import { Logger } from 'winston';
import { printerLogger } from '../logger-winston/winston.config';
@Injectable()
export class PrinterDMService {
  constructor(
    private readonly printerService: PrinterService,
    @Inject('winston') private readonly logger: Logger = printerLogger,
  ) { }
  public async printBigCode(codeData: string): Promise<void> {
    try {
      const sanitizedCode = codeData
        .replaceAll('\u001d', '@')
        .replaceAll('@', '$d029')
        // .replace(/"/g, '\\["]');

      console.log('печать большого кода------', sanitizedCode);
      const wayaway = process.env.AVAILABLE_FILES_DIRECTORY + '/template_files';

      // Асинхронная загрузка шаблона
      const templatePath = path.join(wayaway, 'templateBig.prn');
      const templateContent = await fs.readFile(templatePath, 'utf-8');

      const commands = templateContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((command) => command.replace('<GS1>', `$1${sanitizedCode}`));

      // await this.sendPrintCommands(commands, 'кода');
      await this.printerService.addToPrintQueue(commands, 'большого кода');
    } catch (err : any) {
      this.logger.error(err.message || 'Ошибка печати кода');
    }
  }
  public async printCode(codeData: string): Promise<void> {
    try {
      const sanitizedCode = codeData
        .replaceAll('\u001d', '@')
        .replaceAll('@', '$d029')
        // .replace(/"/g, '\\["]');

      console.log('печать кода------', sanitizedCode);
      const wayaway = process.env.AVAILABLE_FILES_DIRECTORY + '/template_files';

      // Асинхронная загрузка шаблона
      const templatePath = path.join(wayaway, 'template.prn');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      console.log('-------------------sanitizedCode--------123', templateContent);
      const commands = templateContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        // .map((command) => command.replace('{{CODE}}', sanitizedCode));
        .map((command) => command.replace('<GS1>', `$1${sanitizedCode}`));
      // await this.sendPrintCommands(commands, 'кода');
      await this.printerService.addToPrintQueue(commands, 'кода');
    } catch (err : any) {
      this.logger.error(err.message || 'Ошибка печати кода');
    }
  }

  public async printEmptyLabel(): Promise<void> {
    console.log('печать пустой этикетки 1');
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
    } catch { }
  }
}
