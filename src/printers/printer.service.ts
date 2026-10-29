import {
  Injectable,
  Inject,
  OnModuleInit,
  BadRequestException,
  HttpException,
} from '@nestjs/common';

import { Logger } from 'winston';

import {
  buildBigBoxLabelFile,
  buildDmCodeCommands,
  buildPalletLabelFile,
  buildSmallBoxLabelFile,
} from './printer.utils';

import { printerLogger } from '../logger-winston/winston.config';

import { PrinterLabels } from './types';
import { PrinterConfig } from './printer-config.entity';

import { PrinterConfigService } from './printers-helper/printer-config.service';
import { PrinterConnectionService } from './printers-helper/printer-connection.service';
import { PrinterTransportService } from './printers-helper/printer-transport.service';

import { TaskService } from '../task/task.service';
import { LastPackageService } from '../last-package/last-package.service';
import { getPrinterName } from '../config/config.env';

@Injectable()
export class PrinterService implements OnModuleInit {
  constructor(
    private readonly printerConfigService: PrinterConfigService,
    private readonly printerConnectionService: PrinterConnectionService,
    private readonly printerTransportService: PrinterTransportService,

    private readonly taskService: TaskService,
    private readonly lastPackageService: LastPackageService,

    @Inject('winston')
    private readonly logger: Logger = printerLogger,
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
      const codes = await this.taskService.getCodesToPrintByTaskId(id);

      for (const code of codes) {
        await this.printDmCode(code);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      this.logger.error(`Ошибка печати датаматриксов для задачи ${id}`, err);

      throw new BadRequestException(`Ошибка печати датаматриксов для задачи ${id}`);
    }
  }

  private async printDmCode(code: string): Promise<void> {
    try {
      const commands = await buildDmCodeCommands(code);

      await this.printerTransportService.sendCommands(PrinterLabels.Printer2, commands);
    } catch (error) {
      this.logger.error('[PRINTER] Ошибка печати кода:', error);
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

    const count = (await this.taskService.getProductsCount(taskId)) / task.piecesPerSmallBox;

    for (let i = 0; i < count; i++) {
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

    const count =
      (await this.taskService.getProductsCount(taskId)) /
      (await this.taskService.getProductsInBigBox(taskId));

    for (let i = 0; i < count; i++) {
      const boxNumber: number = await this.lastPackageService.updateBigBoxNumber();
      console.log(boxNumber, task.id);
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

    const count =
      (await this.taskService.getProductsCount(taskId)) /
      (await this.taskService.getProductsInPalletId(taskId));

    for (let i = 0; i < count; i++) {
      const palletNumber = await this.lastPackageService.updatePalletNumber();
      await this.printPalletLabel(palletNumber, task.id);
    }
  }

  public async printSmallBoxLabel(boxNumber: number, taskId: number): Promise<void> {
    const endpoint = this.printerConnectionService.getEndpoint(PrinterLabels.Printer1);

    if (!endpoint) {
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

    try {
      const data = await buildSmallBoxLabelFile(boxNumber, task.piecesPerSmallBox, task);

      await this.printerTransportService.sendFile(
        getPrinterName(),
        data,
        `малой коробки ${boxNumber}`,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки малой коробки:', err);
    }
  }

  public async printBigBoxLabel(boxNumber: number, taskId: number): Promise<void> {
    const endpoint = this.printerConnectionService.getEndpoint(PrinterLabels.Printer1);

    if (!endpoint) {
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

    try {
      const data = await buildBigBoxLabelFile(boxNumber, task.piecesPerBigBox, task);

      await this.printerTransportService.sendFile(
        getPrinterName(),
        data,
        `большой коробки ${boxNumber}`,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки большой коробки:', err);
    }
  }

  public async printPalletLabel(palletNumber: number, taskId: number): Promise<void> {
    try {
      const endpoint = this.printerConnectionService.getEndpoint(PrinterLabels.Printer1);

      if (!endpoint) {
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

      const productsInPallet = await this.taskService.getProductsInPalletId(taskId);
      const data = await buildPalletLabelFile(palletNumber, task, productsInPallet);

      await this.printerTransportService.sendFile(
        getPrinterName(),
        data,
        `паллеты ${palletNumber}`,
      );
    } catch (err: any) {
      this.logger.error('Ошибка печати этикетки паллеты:', err);
      if (err instanceof HttpException) {
        throw err;
      }
    }
  }
  public getConnectionStatus(): boolean {
    return this.printerConnectionService.isConnected(PrinterLabels.Printer2);
  }
}
