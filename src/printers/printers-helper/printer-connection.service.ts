import { Inject, Injectable } from '@nestjs/common';
import { printer } from 'node-thermal-printer';
import { Logger } from 'winston';

import { PrinterConfig } from '../printer-config.entity';
import { PrinterConfigService } from './printer-config.service';
import { printerLogger } from '../../logger-winston/winston.config'

interface RuntimePrinter {
  printer: any;
  host: string;
  port: number;
  isConnected: boolean;
}

@Injectable()
export class PrinterConnectionService {
  constructor(
    private readonly printerConfigService: PrinterConfigService,
    @Inject('winston') private readonly logger: Logger = printerLogger,
  ) {}

  /**
   * Здесь находятся принтеры, которые сейчас используются приложением.
 **/
  private printers: Record<string, RuntimePrinter> = {};

  /**
   * Загружаем конфигурации из БД
   */
  async initialize(): Promise<void> {
    const configs = await this.printerConfigService.findAll();

    for (const config of configs) {
      if (!config.enabled) {
        continue;
      }

      await this.connect(config);
    }
  }

  /**
   * Создание runtime-объекта принтера.
   * */
  async connect(config: PrinterConfig): Promise<void> {
    this.logger.info(`Принтер: подключение ${config.name} (${config.host}:${config.port})`);

    try {
      const host = config.host;
      const port = config.port;

      const printerInstance = new printer({
        interface: `tcp://${host}:${port}`,
      });

      this.printers[config.name] = {
        printer: printerInstance,
        host,
        port,
        isConnected: true,
      };

      this.logger.info(`Принтер: ${config.name} добавлен в runtime`);
    } catch (error) {
      this.printers[config.name] = {
        printer: null,
        host: config.host,
        port: config.port,
        isConnected: false,
      };

      this.logger.error(`Принтер: ошибка подключения ${config.name}:`, error);
    }
  }

  async applyConfig(config: PrinterConfig): Promise<void> {
    if (config.enabled) {
      await this.connect(config);
      return;
    }

    this.disconnect(config.name);
  }

  disconnect(name: string): void {
    delete this.printers[name];

    this.logger.info(`Принтер: ${name} удалён из runtime`);
  }

  getPrinter(name: string): any | null {
    return this.printers[name]?.printer ?? null;
  }

  getEndpoint(name: string): { host: string; port: number } | null {
    const printer = this.printers[name];

    if (!printer) {
      return null;
    }

    return {
      host: printer.host,
      port: printer.port,
    };
  }

  isConnected(name: string): boolean {
    return this.printers[name]?.isConnected ?? false;
  }

  setConnected(name: string, value: boolean): void {
    const printer = this.printers[name];

    if (!printer) {
      return;
    }

    printer.isConnected = value;
  }

  getPrintersForMonitoring(): Array<{
    name: string;
    host: string;
  }> {
    return Object.entries(this.printers).map(([name, printer]) => ({
      name,
      host: printer.host,
    }));
  }

  getStatuses(): Array<{
    key: string;
    isConnected: string;
  }> {
    return Object.entries(this.printers).map(([key, printer]) => ({
      key,
      isConnected: printer.isConnected ? 'Connected' : 'Disconnected',
    }));
  }
}
