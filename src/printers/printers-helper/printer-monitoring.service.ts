import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

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
   * Проверить конкретный принтер по имени.
   * Возвращает true, если хост отвечает на ping.
   */
  async isPrinterAlive(name: string): Promise<boolean> {
    const endpoint = this.printerConnectionService.getEndpoint(name);

    if (!endpoint) {
      return false;
    }

    try {
      const result = await ping.promise.probe(endpoint.host, { timeout: 2 });

      this.printerConnectionService.setConnected(name, result.alive);

      return result.alive;
    } catch (error: any) {
      this.printerConnectionService.setConnected(name, false);
      this.logger.error(`Printer ping error (${name}): ${error.message}`);

      return false;
    }
  }

  /**
   * Проверить все подключённые принтеры.
   */
  private async checkPrinters(): Promise<void> {
    try {
      const printers = this.printerConnectionService.getPrintersForMonitoring();

      for (const printer of printers) {
        await this.isPrinterAlive(printer.name);
      }

      const statuses = this.printerConnectionService.getStatuses();

      this.appGateway.sendPrinterConnectionStatus(statuses);
    } catch (error: any) {
      this.logger.error(`Printer ping error: ${error.message}`);
    }
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
