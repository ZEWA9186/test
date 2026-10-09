import { Injectable, Inject, OnModuleInit, BadRequestException } from '@nestjs/common';

import { Logger } from 'winston';

import { printLabelBox, printLabelPallet } from './printer.utils';

import { TemplateService } from '../template/template.service';
import { printerLogger } from '../logger-winston/winston.config';

import { PrinterLabels } from './types';
import { PrinterConfig } from './printer-config.entity';

import { PrinterConfigService } from './printers-helper/printer-config.service';
import { PrinterConnectionService } from './printers-helper/printer-connection.service';

import { TaskService } from '../task/task.service';
import { PrinterDMService } from './printers-helper/printerDM.service';
import { LastPackageService } from '../last-package/last-package.service';

@Injectable()
export class PrinterService implements OnModuleInit {
  constructor(
    private readonly printerConfigService: PrinterConfigService,
    private readonly printerConnectionService: PrinterConnectionService,
    private readonly templateService: TemplateService,

    private readonly taskService: TaskService,
    private readonly lastPackageService: LastPackageService,

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
    enabled: boolean = true,
  ): Promise<void> {
    const config = await this.printerConfigService.saveConfig(name, type, host, port, enabled);

    await this.printerConnectionService.applyConfig(config);
  }

  public async connectPrinter(name: string): Promise<void> {
    const config = await this.printerConfigService.findByName(name);

    if (!config) {
      this.logger.warn(`Принтер: конфигурация для ${name} не найдена`);
      return;
    }

    await this.printerConnectionService.connect(config);
  }

  public async printAllDM(id: number): Promise<void> {
    try {
      const codes = await this.taskService.getCodesByTaskId(id);

      for (const code of codes) {
        await this.printerDMService.printCode(code);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      this.logger.error(`Ошибка печати датаматриксов для задачи ${id}`, err);

      throw new BadRequestException(`Ошибка печати датаматриксов для задачи ${id}`);
    }
  }

  public async printAllSmallBoxLabel(taskId: number): Promise<void> {
    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerSmallBox) {
      throw new BadRequestException('В задаче не указано количество продуктов в малой коробке');
    }

    for (let i = 0; i < task.piecesPerSmallBox; i++) {
      const boxNumber = await this.lastPackageService.updateSmallBoxNumber();
      await this.printSmallBoxLabel(boxNumber, task.id);
    }
  }

  public async printAllBigBoxLabel(taskId: number): Promise<void> {
    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerBigBox) {
      throw new BadRequestException('В задаче не указано количество продуктов в большой коробке');
    }

    for (let i = 0; i < task.piecesPerBigBox; i++) {
      const boxNumber = await this.lastPackageService.updateBigBoxNumber();
      await this.printBigBoxLabel(boxNumber, task.id);
    }
  }

  public async printAllPalletLabel(taskId: number): Promise<void> {
    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerPallet) {
      throw new BadRequestException('В задаче не указано количество продуктов на паллете');
    }

    for (let i = 0; i < task.piecesPerPallet; i++) {
      const palletNumber = await this.lastPackageService.updatePalletNumber();
      await this.printPalletLabel(palletNumber, task.id);
    }
  }

  public async printSmallBoxLabel(boxNumber: number, taskId: number): Promise<void> {
    const printer = this.printerConnectionService.getPrinter(PrinterLabels.Printer1);

    if (!printer) {
      this.logger.error(`Принтер ${PrinterLabels.Printer1} не подключён`);
      return;
    }

    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerSmallBox) {
      throw new BadRequestException('В задаче не указано количество продуктов в малой коробке');
    }

    const template = this.templateService.getAll();

    const boxTemplate = template?.find((el: any) => el.type === 'smallBox')?.template || [];

    if (!boxTemplate.length) {
      return;
    }

    const printerName = process.env.PRINTER_NAME_1 || '';

    try {
      await printLabelBox(
        boxNumber,
        task.piecesPerSmallBox,
        printer,
        boxTemplate,
        task,
        this.logger,
        printerName,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки малой коробки:', err);
    }
  }

  public async printBigBoxLabel(boxNumber: number, taskId: number): Promise<void> {
    const printer = this.printerConnectionService.getPrinter(PrinterLabels.Printer1);

    if (!printer) {
      this.logger.error(`Принтер ${PrinterLabels.Printer1} не подключён`);
      return;
    }

    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerBigBox) {
      throw new BadRequestException('В задаче не указано количество продуктов в большой коробке');
    }

    const template = this.templateService.getAll();

    const boxTemplate = template?.find((el: any) => el.type === 'bigBox')?.template || [];

    if (!boxTemplate.length) {
      return;
    }

    const ProductsInBigBox = await this.taskService.getProductsInBigBox(taskId);
    //TODO Исправить генератор, добавить количество продуктов в коробке
    const printerName = process.env.PRINTER_NAME_1 || '';

    try {
      await printLabelBox(
        boxNumber,
        task.piecesPerBigBox,
        printer,
        boxTemplate,
        task,
        this.logger,
        printerName,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки большой коробки:', err);
    }
  }

  public async printPalletLabel(palletNumber: number, taskId: number): Promise<void> {
    try {
      const printer = this.printerConnectionService.getPrinter(PrinterLabels.Printer1);

      if (!printer) {
        this.logger.error(`Принтер ${PrinterLabels.Printer1} не подключён`);
        return;
      }

      const task = await this.taskService.getTaskById(taskId);

      if (!task) {
        throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
      }

      if (!task.piecesPerPallet) {
        throw new BadRequestException('В задаче не указано количество продуктов на паллете');
      }

      const template = this.templateService.getAll();

      const palletTemplate = template?.find((el: any) => el.type === 'pallet')?.template || [];

      if (!palletTemplate.length) {
        return;
      }

      const productsInPallet = await this.taskService.getProductsInPalletId(taskId);

      const printerName = process.env.PRINTER_NAME_1 || '';

      await printLabelPallet(
        palletNumber,
        task.piecesPerPallet,
        printer,
        palletTemplate,
        task,
        this.logger,
        productsInPallet,
        printerName,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки паллеты:', err);
    }
  }
  public getConnectionStatus(): boolean {
    return this.printerConnectionService.isConnected(PrinterLabels.Printer2);
  }
}
