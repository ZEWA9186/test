import { Injectable, Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import * as net from 'net';
import * as ping from 'ping';

import { Logger } from 'winston';

import { PrinterConnectionService } from './printer-connection.service';
import { printerLogger } from '../../logger-winston/winston.config';
import { AppGateway } from '../../app.gateway';

@Injectable()
export class PrinterMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly CHECK_INTERVAL = 3000;

  private connectionInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly printerConnectionService: PrinterConnectionService,

    private readonly appGateway: AppGateway,

    @Inject('winston')
    private readonly logger: Logger = printerLogger,
  ) {}

  /**
   * Запустить постоянный мониторинг.
   */
  async onModuleInit(): Promise<void> {
    await this.checkPrinters();

    this.connectionInterval = setInterval(() => {
      void this.checkPrinters();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Проверить все подключённые принтеры.
   */
  private async checkPrinters(): Promise<void> {
    try {
      const printers = this.printerConnectionService.getPrintersForMonitoring();

      for (const printer of printers) {
        const result = await ping.promise.probe(printer.host);

        this.printerConnectionService.setConnected(printer.name, result.alive);
      }

      const statuses = this.printerConnectionService.getStatuses();

      this.appGateway.sendPrinterConnectionStatus(statuses);
    } catch (error: any) {
      this.logger.error(`Printer ping error: ${error.message}`);
    }
  }

  /**
   * Проверить возможность TCP-соединения.
   */
  public async isPrinterAvailable(name: string): Promise<boolean> {
    const endpoint = this.printerConnectionService.getEndpoint(name);

    if (!endpoint) {
      return false;
    }

    return new Promise((resolve) => {
      const client = new net.Socket();

      const timeout = setTimeout(() => {
        client.destroy();

        resolve(false);
      }, 1000);

      client.connect(endpoint.port, endpoint.host, () => {
        clearTimeout(timeout);

        client.destroy();

        resolve(true);
      });

      client.on('error', () => {
        clearTimeout(timeout);

        client.destroy();

        resolve(false);
      });
    });
  }

  /**
   * Проверить готовность TSC-принтера.
   */
  public async checkTSCPrinterStatus(name: string): Promise<{
    isReady: boolean;
    description: string;
  }> {
    const endpoint = this.printerConnectionService.getEndpoint(name);

    if (!endpoint) {
      return {
        isReady: false,
        description: `Принтер ${name} не подключён`,
      };
    }

    return new Promise((resolve) => {
      const client = new net.Socket();

      let timeout: NodeJS.Timeout;

      client.connect(endpoint.port, endpoint.host, () => {
        client.write(Buffer.from('\x1B!?\n', 'ascii'));
      });

      let responseData = Buffer.alloc(0);

      client.on('data', (data) => {
        responseData = Buffer.concat([responseData, data]);

        if (responseData.length > 0) {
          clearTimeout(timeout);

          client.destroy();

          resolve(this.parseTSCStatus(responseData));
        }
      });

      client.on('error', () => {
        clearTimeout(timeout);

        client.destroy();

        resolve({
          isReady: false,
          description: 'Ошибка подключения к принтеру',
        });
      });

      timeout = setTimeout(() => {
        client.destroy();

        resolve({
          isReady: false,
          description: 'Таймаут проверки статуса',
        });
      }, 3000);
    });
  }

  /**
   * Разбор ответа TSC.
   */
  private parseTSCStatus(statusBuffer: Buffer): {
    isReady: boolean;
    description: string;
  } {
    if (statusBuffer.length === 0) {
      return {
        isReady: false,
        description: 'Нет ответа от принтера',
      };
    }

    const statusByte = statusBuffer[0];

    const isPaperOut = (statusByte & 0x04) !== 0;

    const isPaused = (statusByte & 0x20) !== 0;

    const isHeadUp = (statusByte & 0x40) !== 0;

    const isRibbonOut = (statusByte & 0x80) !== 0;

    const isReady = !isPaperOut && !isPaused && !isHeadUp && !isRibbonOut;

    let description = 'Принтер готов к печати';

    if (!isReady) {
      const issues: string[] = [];

      if (isPaperOut) {
        issues.push('нет бумаги');
      }

      if (isPaused) {
        issues.push('на паузе');
      }

      if (isHeadUp) {
        issues.push('головка поднята');
      }

      if (isRibbonOut) {
        issues.push('нет риббона');
      }

      description = `Проблемы: ${issues.join(', ')}`;
    }

    return {
      isReady,
      description,
    };
  }

  /**
   * Остановить мониторинг.
   */
  onModuleDestroy(): void {
    if (this.connectionInterval) {
      clearInterval(this.connectionInterval);

      this.connectionInterval = null;
    }
  }
}
