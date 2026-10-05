/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Inject, OnModuleInit, BadRequestException } from '@nestjs/common';

import { Logger } from 'winston';

import { MonitoringStatusActions } from '../globalTypes';

import { printLabelBox, printLabelPallet } from './printer.utils';

import { TemplateService } from '../template/template.service';
import { printerLogger } from '../logger-winston/winston.config';

import { PrinterLabels } from './types';

import { PrinterConfig } from './printer-config.entity';

import { PrinterConfigService } from './printers-helper/printer-config.service';
import { PrinterConnectionService } from './printers-helper/printer-connection.service';
import { PrinterQueueService } from './printers-helper/printer-queue.service';
import { TaskService } from '../task/task.service';
import { PrinterDMService } from './printers-helper/printerDM.service';

@Injectable()
export class PrinterService implements OnModuleInit {
  constructor(
    private readonly printerConfigService: PrinterConfigService,

    private readonly printerConnectionService: PrinterConnectionService,

    private readonly printerQueueService: PrinterQueueService,

    private readonly templateService: TemplateService,
    @Inject()
    private readonly taskService: TaskService,

    @Inject('winston')
    private readonly logger: Logger = printerLogger,

    private readonly printerDMService: PrinterDMService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.printerConnectionService.initialize();
  }

  async getConfigByName(name: string): Promise<PrinterConfig | null> {
    return this.printerConfigService.findByName(name);
  }

  async updatePrinterConfig(
    name: string,
    type: string,
    host: string,
    port: number,
    enabled: boolean = false,
  ): Promise<void> {
    const config = await this.printerConfigService.saveConfig(name, type, host, port, enabled);

    await this.printerConnectionService.applyConfig(config);
  }

  // TODO Коннект сейчас хуй пойми как отрабатывает
  public async connectPrinter(name: string): Promise<void> {
    const config = await this.printerConfigService.findByName(name);

    if (!config) {
      this.logger.warn(`Принтер: конфигурация для ${name} не найдена`);

      return;
    }

    await this.printerConnectionService.connect(config);
  }

  public async printAllDM(id: number) {
    try {
      const codes = await this.taskService.getCodesByTaskId(id);
      for (const code of codes) {
        await this.printerDMService.printCode(code);
        new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err: any) {
      printerLogger.error(`Ошибка печати датаматриксов для задачи ${id}`);
      throw new BadRequestException(`Ошибка печати датаматриксов для задачи ${id}`);
    }
  }
  /*  async getUserIdByBoxNumber(
    boxNumber: number,
    tableName: string,
    manager: EntityManager,
  ): Promise<number | null> {
    const result = await manager.query(
      `SELECT user_id FROM "${tableName}" WHERE box_number = $1 LIMIT 1`,
      [boxNumber],
    );

    return result[0]?.user_id || null;
  }*/

  public async printBoxLabel(boxNumber: number, countInBox: number, id: number): Promise<any> {
    try {
      const printer = this.printerConnectionService.getPrinter(PrinterLabels.Printer2);

      // TODO:
      // Тип/назначение принтера сейчас определяется через PrinterLabels.
      // В будущем перенести эту информацию в PrinterConfig и определять
      // тип/назначение принтера из конфигурации БД.

      if (!printer) {
        this.logger.error(`Принтер ${PrinterLabels.Printer2} не подключён`);

        return;
      }

      const template = this.templateService.getAll();

      let boxTemplate = [];

      if (template) {
        boxTemplate = template.find((el: any) => el.type === 'smallBox')?.template || [];
      }

      // TODO Исправить поведение енама шаблона этикетки
      // TODO Сквозная нумерация на печать или привязку при агрегации
      // TODO Переписать поведение принтеров
      // TODO Подумать над процессом печати, всё сразу, частями, допечать

      const printerName = process.env.PRINTER_NAME_2 || '';

      //const printerName2 = process.env.PRINTER_NAME_3 || '';/

      // let goTo = MonitoringStatusActions.Right;

      // if (this.globalMonVar.currentBoxNumber % 2 === 0) {
      //   goTo = this.globalMonVar.isFirstBoxOdd
      //     ? MonitoringStatusActions.Right
      //     : MonitoringStatusActions.Left;
      // }
      //
      // const printerName = goTo === MonitoringStatusActions.Right ? printerName2 : printerName3;

      const task = await this.taskService.getTaskById(id);

      if (!task) {
        throw new BadRequestException(`Конфигурации для задачи ${id} нет`);
      }

      if (boxTemplate.length) {
        await printLabelBox(
          boxNumber,
          countInBox,
          printer,
          boxTemplate,
          task,
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
    id: number,
  ): Promise<any> {
    try {
      const printer = this.printerConnectionService.getPrinter(PrinterLabels.Printer3);

      if (!printer) {
        this.logger.error(`Принтер ${PrinterLabels.Printer3} не подключён`);

        return;
      }

      const template = this.templateService.getAll();

      let palletTemplate = [];

      if (template) {
        palletTemplate = template.find((el: any) => el.type === 'pallet')?.template || [];
      }

      const task = await this.taskService.getTaskById(id);

      if (!task) {
        throw new BadRequestException(`Конфигурации для задачи ${id} нет`);
      }
      const printerName = process.env.PRINTER_NAME_1 || '';

      if (palletTemplate.length) {
        await printLabelPallet(
          palletNumber,
          countInPallet,
          printer,
          palletTemplate,
          task,
          this.logger,
          productCountInPallet,
          printerName,
        );
      }
    } catch (err) {
      this.logger.error('Ошибка печати этикетки паллеты:', err);
    }
  }

  public getConnectionStatus(): boolean {
    return this.printerConnectionService.isConnected(PrinterLabels.Printer2);
  }

  public async addToPrintQueue(commands: Array<string | Buffer>, label: string): Promise<void> {
    return this.printerQueueService.addToPrintQueue(commands, label);
  }
}
