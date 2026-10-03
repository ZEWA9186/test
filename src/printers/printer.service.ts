/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { PrinterConfigRepository } from './printer-config.repository';
import { AppGateway } from '../app.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from 'winston';
import { printer } from 'node-thermal-printer';
import { IMonitoringVariables, MonitoringStatusActions, Status } from '../globalTypes';
import { printLabelBox, printLabelPallet } from './printer.utils';
import { TemplateService } from '../template/template.service';
import * as net from 'net';
import * as ping from 'ping';
import { printerLogger } from '../logger-winston/winston.config';
import { PrinterNames } from './types';
import { EntityManager } from 'typeorm';
import { PrinterConfig } from './printer-config.entity';

@Injectable()
@Injectable()
export class PrinterService implements OnModuleDestroy {
  constructor(
    @Inject('PrinterConfigRepository')
    private printerConfigRepo: PrinterConfigRepository,
    private readonly entityManager: EntityManager,
    private readonly appGateway: AppGateway,
    private readonly eventEmitter: EventEmitter2,
    private readonly templateService: TemplateService,
    @Inject('GLOBAL_MONITORING_VARIABLES')
    private readonly globalMonVar: IMonitoringVariables,
    @Inject('winston') private readonly logger: Logger = printerLogger,
  ) {}

  private printQueue: Array<{
    commands: Array<string | Buffer>;
    label: string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    resolve: Function;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    reject: Function;
  }> = [];

  private isProcessingQueue = false;
  private readonly MAX_QUEUE_SIZE = 10;
  private isConnected = false;
  private printer: any;
  private printers: Record<string, any> = {};

  private connectionInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000;
  private host: string = '172.16.16.140'; // IP-адрес принтера
  private port: number = 9100; // порт принтера
  private lastStatus: Status | null = null;
  private statusChangeTimeout: NodeJS.Timeout | null = null;
  private globalPrinterStatus = Status.Connected;
  private globalPrintersStatus: any = [];

  async onModuleInit() {
    const allConfigs = await this.printerConfigRepo.find();
    console.log('All configs:', allConfigs);
    for (const element of allConfigs) {
      await this.connectPrinter(element.name);
    }

    let i = 0;
    for (const key in this.printers) {
      const element = this.printers[key];
      this.globalPrintersStatus[i] = { key, isConnected: element.isConnected };
      i++;
    }
    setInterval(() => this.pingPrinter(this.globalPrintersStatus), 1000);
  }

  private async updateConnectionStatus(arrPrinter: any) {
    this.appGateway.sendPrinterConnectionStatus(arrPrinter);
  }

  private async pingPrinter(arrPrinter: any) {
    try {
      for (let i = 0; i < arrPrinter.length; i++) {
        const res = await ping.promise.probe(
          this.printers[arrPrinter[i].key].printer?.Interface?.host,
        );
        // console.log(this.printers[arrPrinter[i].key].printer?.Interface.host);
        const newStatus = res.alive ? Status.Connected : Status.Disconnected;

        arrPrinter[i].isConnected = newStatus;
      }

      await this.updateConnectionStatus(arrPrinter);
      // console.log('----------------------------', element.host, element.name);
    } catch (error: any) {
      this.logger.error(`Printer ping error: ${error.message}`);
    }
  }

  onModuleDestroy() {
    if (this.connectionInterval) {
      clearInterval(this.connectionInterval);
    }
  }

  async getConfigByName(name: string): Promise<any> {
    return this.printerConfigRepo.findOne({ where: { name } });
  }

  async updatePrinterConfig(
    name: string,
    type: string,
    host: string,
    port: number,
    enabled?: boolean,
  ): Promise<any> {
    let config = await this.printerConfigRepo.findOne({ where: { name } });
    if (!config) {
      config = this.printerConfigRepo.create({
        name,
        host,
        enabled,
        type,
        port,
      });
    } else {
      config.host = host;
      config.port = port;
      config.type = type;
      config.enabled = !!enabled;
    }
    await this.printerConfigRepo.save(config);
    await this.connectPrinter(name);
  }

  public async connectPrinter(name: string): Promise<any> {
    this.logger.info(`Принтер: Подключение к принтеру...${name}`);
    try {
      const config = await this.getConfigByName(name);
      if (!config) {
        this.logger.warn(`Принтер: Конфигурация для ${name} не найдена`);
        return;
      }
      this.host = config.host || '192.168.100.141';
      this.port = config.port || 9100;

      this.printer = new printer({
        interface: `tcp://${this.host}:${this.port}`,
      });

      this.isConnected = true;
      this.printers[name] = {
        printer: this.printer,
        isConnected: this.isConnected,
      };
      console.log(this.printers, 'lllllllllllllllllllllllll');
      this.logger.info(`Принтер: Подключено к принтеру${this.host}`);
    } catch (err) {
      this.logger.error('Принтер: Ошибка подключения:', err);
      this.isConnected = false;
    }
  }

  async getUserIdByBoxNumber(
    boxNumber: number,
    tableName: string,
    manager: EntityManager,
  ): Promise<number | null> {
    const queryRunner = manager;
    const result = await queryRunner.query(
      `SELECT user_id FROM "${tableName}" WHERE box_number = $1 LIMIT 1`,
      [boxNumber],
    );

    return result[0]?.user_id || null;
  }

  public async printBoxLabel(boxNumber: number, countInBox: number): Promise<any> {
    try {
      const printer = this.printers[PrinterNames.Printer3].printer;
      // console.log(this.printers);
      // console.log(printer, 'asfasfsafas,,,,,,,,,,,,,,,,,,');
      const template = this.templateService.getAll();
      let boxTemplate = [];
      if (template) {
        boxTemplate = template.find((el: any) => el.type === 'box')?.template || [];
      }
      // TODO Исправить поведения енама шаблона этикетки
      // TODO Сквозная нумерация на печать или привязку при агрегации

      const printerName3 = process.env.PRINTER_NAME_3 || '';
      const printerName2 = process.env.PRINTER_NAME_2 || '';
      let goTo = MonitoringStatusActions.Right;
      if (this.globalMonVar.currentBoxNumber % 2 === 0) {
        goTo = this.globalMonVar.isFirstBoxOdd
          ? MonitoringStatusActions.Right
          : MonitoringStatusActions.Left;
      }
      const printerName = goTo === MonitoringStatusActions.Right ? printerName2 : printerName3;
      if (boxTemplate.length) {
        await printLabelBox(
          boxNumber,
          countInBox,
          printer,
          boxTemplate,
          this.globalMonVar.task,
          this.logger,
          printerName,
        );
      }
    } catch (err) {
      this.logger.error('Ошибка печати этикетки коробки:', err);
    }
  }

  public async printPalletLabel(
    palletNumber: number,
    countInPallet: number,
    productCountInPallet: number,
  ): Promise<any> {
    try {
      const template = this.templateService.getAll();
      const printer = this.printers[PrinterNames.Printer3].printer;
      let palletTemplate = [];
      if (template) {
        palletTemplate = template.find((el: any) => el.type === 'pallet')?.template || [];
      }
      if (palletTemplate.length) {
        await printLabelPallet(
          palletNumber,
          countInPallet,
          printer,
          palletTemplate,
          this.globalMonVar.task,
          this.logger,
          productCountInPallet,
        );
      }
    } catch (err) {
      this.logger.error('Ошибка печати этикетки паллеты:', err);
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async addToPrintQueue(commands: Array<string | Buffer>, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Проверяем не переполнена ли очередь
      if (this.printQueue.length >= this.MAX_QUEUE_SIZE) {
        reject(new Error(`Очередь печати переполнена (максимум ${this.MAX_QUEUE_SIZE} заданий)`));
        return;
      }

      // Добавляем в очередь
      this.printQueue.push({ commands, label, resolve, reject });

      // 🔄 ВСЕГДА запускаем обработку при добавлении нового задания
      this.restartQueueProcessing();
    });
  }
  private restartQueueProcessing() {
    if (!this.isProcessingQueue && this.printQueue.length > 0) {
      this.logger.info('Перезапуск обработки очереди печати');
      this.processPrintQueue();
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
        // Проверка статуса принтера ТОЛЬКО если это первое задание
        // ИЛИ предыдущее завершилось с ошибкой (принтер мог отвалиться)
        this.logger.info(`Печать задания: ${printJob.label}`);
        await this.sendPrintCommands(printJob.commands, printJob.label);

        // Успешно — удаляем из очереди
        this.printQueue.shift();
        printJob.resolve();

        this.logger.info(
          `Задание успешно напечатано. Осталось в очереди: ${this.printQueue.length}`,
        );
      } catch (error: any) {
        this.logger.error(
          `Ошибка печати ${printJob.label}: ${error.message}. Проверяем принтер...`,
        );

        // Принтер отвалился — проверяем его статус и ждём восстановления
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!isReady && attempts < maxAttempts) {
          const isAvailable = await this.isPrinterAvailable();

          if (!isAvailable) {
            attempts++;
            this.logger.warn(`Принтер недоступен, ожидание... (${attempts}/${maxAttempts})`);
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          const status = await this.checkTSCPrinterStatus();
          isReady = status.isReady;

          if (!isReady) {
            attempts++;
            this.logger.warn(
              `Принтер не готов: ${status.description}, ожидание... (${attempts}/${maxAttempts})`,
            );
            await new Promise((resolve) => setTimeout(resolve, 50));
          } else {
            this.logger.info('Принтер восстановлен, продолжаем печать');
          }
        }

        if (!isReady) {
          // Принтер не восстановился — оставляем задание в очереди и выходим
          this.logger.error(
            `Принтер не восстановился после ${maxAttempts} попыток.  +
            Задание ${printJob.label} остаётся в очереди. Заданий в очереди: ${this.printQueue.length}`,
          );
          this.isProcessingQueue = false;
          setTimeout(() => this.restartQueueProcessing(), 3000);
          return;
        }

        // Принтер восстановился — удаляем проблемное задание и идём дальше
        this.printQueue.shift();
        printJob.reject(error);

        this.logger.info(
          `Пропускаем проблемное задание ${printJob.label}, продолжаем очередь. Осталось: ${this.printQueue.length}`,
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

  private async checkTSCPrinterStatus(): Promise<{
    isReady: boolean;
    description: string;
  }> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      // eslint-disable-next-line prefer-const
      let timeout: NodeJS.Timeout;
      const printer = this.printers[PrinterNames.Printer2].printer?.Interface;
      client.connect(printer.port, printer.host, () => {
        // Команда для проверки статуса TSC принтера
        client.write(Buffer.from('\x1B!?\n', 'ascii')); // ESC !? - команда статуса для TSC
      });

      let responseData = Buffer.alloc(0);

      client.on('data', (data) => {
        responseData = Buffer.concat([responseData, data]);

        // TSC принтеры обычно возвращают статус в течение 1-2 секунд
        if (responseData.length > 0) {
          clearTimeout(timeout);
          client.destroy();

          const status = this.parseTSCStatus(responseData);
          resolve(status);
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
  private async isPrinterAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      const printer = this.printers[PrinterNames.Printer2].printer?.Interface;
      client.connect(printer.port, printer.host, () => {
        client.destroy();
        resolve(true);
      });

      client.on('error', () => {
        client.destroy();
        resolve(false);
      });

      setTimeout(() => {
        client.destroy();
        resolve(false);
      }, 1000);
    });
  }

  async sendPrintCommands(commands: Array<string | Buffer>, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      // Объединяем команды в один Buffer
      const buffers: Buffer[] = [];
      for (const cmd of commands) {
        buffers.push(
          typeof cmd === 'string'
            ? Buffer.from(cmd + '\n', 'ascii')
            : Buffer.concat([cmd, Buffer.from('\n', 'ascii')]),
        );
      }
      const printCommands = Buffer.concat(buffers);

      console.log('------------------printCommands----------', printCommands);
      const printer = this.printers[PrinterNames.Printer2].printer?.Interface;
      client.connect(printer.port, printer.host, () => {
        client.write(printCommands, (error) => {
          client.destroy();
          if (error) {
            this.logger.error(`Ошибка отправки данных для ${label}: ${error.message}`);
            reject(error);
          } else {
            this.logger.info(`Команды для ${label} успешно отправлены2`);

            resolve();
          }
        });
      });

      client.on('error', (error) => {
        client.destroy();
        this.logger.error(`Ошибка подключения при печати ${label}: ${error.message}`);
        this.isConnected = false;
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

  private parseTSCStatus(statusBuffer: Buffer): {
    isReady: boolean;
    description: string;
  } {
    if (statusBuffer.length === 0) {
      return { isReady: false, description: 'Нет ответа от принтера' };
    }

    // TSC принтеры возвращают статус в виде байтов
    // Обычно первый байт содержит основную информацию
    const statusByte = statusBuffer[0];

    // Анализ битов статуса TSC принтера
    const isPaperOut = (statusByte & 0x04) !== 0; // Нет бумаги
    const isPaused = (statusByte & 0x20) !== 0; // Принтер на паузе
    const isHeadUp = (statusByte & 0x40) !== 0; // Головка поднята
    const isRibbonOut = (statusByte & 0x80) !== 0; // Нет риббона

    const isReady = !isPaperOut && !isPaused && !isHeadUp && !isRibbonOut;

    let description = 'Принтер готов к печати';
    if (!isReady) {
      const issues: string[] = [];
      if (isPaperOut) issues.push('нет бумаги');
      if (isPaused) issues.push('на паузе');
      if (isHeadUp) issues.push('головка поднята');
      if (isRibbonOut) issues.push('нет риббона');

      description = `Проблемы: ${issues.join(', ')}`;
    }

    return { isReady, description };
  }
}
