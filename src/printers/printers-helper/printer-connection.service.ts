import { Inject, Injectable } from '@nestjs/common';
import { Logger } from 'winston';

import { PrinterConfig } from '../printer-config.entity';
import { PrinterConfigService } from './printer-config.service';
import { printerLogger } from '../../logger-winston/winston.config';

interface RuntimePrinter {
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

  private printers: Record<string, RuntimePrinter> = {};

  async initialize(): Promise<void> {
    const configs = await this.printerConfigService.findAll();

    for (const config of configs) {
      if (!config.enabled) {
        continue;
      }

      await this.connect(config);
    }
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.printers[config.name] = {
      host: config.host,
      port: config.port,
      isConnected: false,
    };

    this.logger.info(`Принтер: ${config.name} добавлен в runtime (${config.host}:${config.port})`);
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
