import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import * as net from 'net';

import { PrinterLabels } from '../types';
import { PrinterMonitoringService } from './printer-monitoring.service';
import { PrinterConnectionService } from './printer-connection.service';
import { printerLogger } from '../../logger-winston/winston.config';

@Injectable()
export class PrinterQueueService {
  private readonly MAX_QUEUE_SIZE = 10;

  private printQueue: Array<{
    commands: Array<string | Buffer>;
    label: string;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    resolve: Function;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    reject: Function;
  }> = [];

  private isProcessingQueue = false;

  constructor(
    private readonly printerMonitoringService: PrinterMonitoringService,
    private readonly printerConnectionService: PrinterConnectionService,

    @Inject('winston')
    private readonly logger: Logger = printerLogger,
  ) {}

  public async addToPrintQueue(commands: Array<string | Buffer>, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.printQueue.length >= this.MAX_QUEUE_SIZE) {
        reject(new Error(`Очередь печати переполнена (максимум ${this.MAX_QUEUE_SIZE} заданий)`));

        return;
      }

      this.printQueue.push({
        commands,
        label,
        resolve,
        reject,
      });

      this.restartQueueProcessing();
    });
  }

  private restartQueueProcessing(): void {
    if (!this.isProcessingQueue && this.printQueue.length > 0) {
      this.logger.info('Перезапуск обработки очереди печати');

      void this.processPrintQueue();
    }
  }

  private async processPrintQueue(): Promise<void> {
    if (this.isProcessingQueue || this.printQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    this.logger.info(
      `Начало обработки очереди печати. Заданий в очереди: ${this.printQueue.length}`,
    );

    while (this.printQueue.length > 0) {
      const printJob = this.printQueue[0];

      try {
        this.logger.info(`Печать задания: ${printJob.label}`);
        //TODO Изменить принтеры
        await this.sendPrintCommands(PrinterLabels.Printer2, printJob.commands, printJob.label);

        this.printQueue.shift();

        printJob.resolve();

        this.logger.info(
          `Задание успешно напечатано. Осталось в очереди: ${this.printQueue.length}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Ошибка печати ${printJob.label}: ${error.message}. Проверяем принтер...`,
        );

        const isReady = await this.waitForPrinterRecovery(PrinterLabels.Printer2);

        if (!isReady) {
          this.logger.error(
            `Принтер не восстановился. ` + `Задание ${printJob.label} остаётся в очереди.`,
          );

          this.isProcessingQueue = false;

          setTimeout(() => this.restartQueueProcessing(), 3000);

          return;
        }

        this.printQueue.shift();

        printJob.reject(error);

        this.logger.info(
          `Пропускаем проблемное задание ${printJob.label}, ` +
            `продолжаем очередь. Осталось: ${this.printQueue.length}`,
        );
      }
    }

    this.isProcessingQueue = false;

    if (this.printQueue.length > 0) {
      setTimeout(() => this.restartQueueProcessing(), 50);
    } else {
      this.logger.info('Очередь печати обработана');
    }
  }

  private async waitForPrinterRecovery(printerName: string): Promise<boolean> {
    let attempts = 0;

    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const isAvailable = await this.printerMonitoringService.isPrinterAvailable(printerName);

      if (!isAvailable) {
        attempts++;

        this.logger.warn(`Принтер недоступен, ожидание... (${attempts}/${maxAttempts})`);

        await new Promise((resolve) => setTimeout(resolve, 500));

        continue;
      }

      const status = await this.printerMonitoringService.checkTSCPrinterStatus(printerName);

      if (status.isReady) {
        this.logger.info('Принтер восстановлен, продолжаем печать');

        return true;
      }

      attempts++;

      this.logger.warn(
        `Принтер не готов: ${status.description}, ` + `ожидание... (${attempts}/${maxAttempts})`,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return false;
  }

  private async sendPrintCommands(
    printerName: string,
    commands: Array<string | Buffer>,
    label: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const endpoint = this.printerConnectionService.getEndpoint(printerName);

      if (!endpoint) {
        reject(new Error(`Принтер ${printerName} не подключён`));

        return;
      }

      const client = new net.Socket();

      const buffers: Buffer[] = [];

      for (const command of commands) {
        buffers.push(
          typeof command === 'string'
            ? Buffer.from(command + '\n', 'ascii')
            : Buffer.concat([command, Buffer.from('\n', 'ascii')]),
        );
      }

      const printCommands = Buffer.concat(buffers);

      console.log('------------------printCommands----------', printCommands);

      client.connect(endpoint.port, endpoint.host, () => {
        client.write(printCommands, (error) => {
          client.destroy();

          if (error) {
            this.logger.error(`Ошибка отправки данных для ${label}: ${error.message}`);

            reject(error);

            return;
          }

          this.printerConnectionService.setConnected(printerName, true);

          this.logger.info(`Команды для ${label} успешно отправлены`);

          resolve();
        });
      });

      client.on('error', (error) => {
        client.destroy();

        this.printerConnectionService.setConnected(printerName, false);

        this.logger.error(`Ошибка подключения при печати ${label}: ${error.message}`);

        reject(error);
      });

      client.setTimeout(5000, () => {
        client.destroy();

        const error = new Error(`Таймаут при печати ${label}`);

        this.logger.error(error.message);

        reject(error);
      });
    });
  }
}
