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
   * Остановить мониторинг.
   */
  onModuleDestroy(): void {
    if (this.connectionInterval) {
      clearInterval(this.connectionInterval);

      this.connectionInterval = null;
    }
  }
}
