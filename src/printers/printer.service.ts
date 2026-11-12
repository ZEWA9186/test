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
  DmPrintCode,
} from './printer.utils';

import { printerLogger } from '../logger-winston/winston.config';

import { PrinterLabels } from './types';
import { PrinterConfig } from './printer-config.entity';

import { PrinterConfigService } from './printers-helper/printer-config.service';
import { PrinterConnectionService } from './printers-helper/printer-connection.service';
import { PrinterMonitoringService } from './printers-helper/printer-monitoring.service';
import { PrinterTransportService } from './printers-helper/printer-transport.service';

import { TaskService } from '../task/task.service';
import { LastPackageService } from '../last-package/last-package.service';
import { getPrinterName } from '../config/config.env';

@Injectable()
export class PrinterService implements OnModuleInit {
  constructor(
    private readonly printerConfigService: PrinterConfigService,
    private readonly printerConnectionService: PrinterConnectionService,
    private readonly printerMonitoringService: PrinterMonitoringService,
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
      throw new BadRequestException(`Принтер: конфигурация для ${name} не найдена`);
    }

    await this.printerConnectionService.connect(config);
  }

  public async printAllDM(id: number): Promise<void> {
    try {
      await this.assertPrinterAlive(PrinterLabels.Printer1);

      const codes = await this.taskService.getCodesToPrintByTaskId(id);
      let i = 0;
      for (const code of codes) {
        code.id = i++;
        await this.printDmCode(code);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      this.logger.error(`Ошибка печати датаматриксов для задачи ${id}`, err);
      throw this.toPrintException(err, `Ошибка печати датаматриксов для задачи ${id}`);
    }
  }

  private async printDmCode(code: DmPrintCode): Promise<void> {
    try {
      const commands = await buildDmCodeCommands(code);

      await this.printerTransportService.sendCommands(PrinterLabels.Printer1, commands);
    } catch (error) {
      this.logger.error('[PRINTER] Ошибка печати кода:', error);
      throw this.toPrintException(error, 'Ошибка печати датаматрикса');
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

    await this.assertPrinterAlive(PrinterLabels.Printer1);

    for (let i = 0; i < count; i++) {
      const boxNumber = await this.lastPackageService.updateSmallBoxNumber();
      await this.printSmallBoxLabel(boxNumber, task.id, false);
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

    await this.assertPrinterAlive(PrinterLabels.Printer1);

    for (let i = 0; i < count; i++) {
      const boxNumber: number = await this.lastPackageService.updateBigBoxNumber();
      console.log(boxNumber, task.id);
      await this.printBigBoxLabel(boxNumber, task.id, false);
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

    await this.assertPrinterAlive(PrinterLabels.Printer1);

    for (let i = 0; i < count; i++) {
      const palletNumber = await this.lastPackageService.updatePalletNumber();
      await this.printPalletLabel(palletNumber, task.id, false);
    }
  }

  public async printSmallBoxLabel(
    boxNumber: number,
    taskId: number,
    checkPrinter = true,
  ): Promise<void> {
    if (checkPrinter) {
      await this.assertPrinterAlive(PrinterLabels.Printer1);
    }

    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerSmallBox) {
      throw new BadRequestException('В задаче не указано количество продуктов в малой коробке');
    }

    try {
      const data = await buildSmallBoxLabelFile(boxNumber, task);

      await this.printerTransportService.sendFile(
        getPrinterName(),
        data,
        `малой коробки ${boxNumber}`,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки малой коробки:', err);
      throw this.toPrintException(err, `Ошибка печати этикетки малой коробки ${boxNumber}`);
    }
  }

  public async printBigBoxLabel(
    boxNumber: number,
    taskId: number,
    checkPrinter = true,
  ): Promise<void> {
    if (checkPrinter) {
      await this.assertPrinterAlive(PrinterLabels.Printer1);
    }

    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
    }

    if (!task.piecesPerBigBox) {
      throw new BadRequestException('В задаче не указано количество продуктов в большой коробке');
    }

    try {
      const data = await buildBigBoxLabelFile(boxNumber, task);

      await this.printerTransportService.sendFile(
        getPrinterName(),
        data,
        `большой коробки ${boxNumber}`,
      );
    } catch (err) {
      this.logger.error('Ошибка печати этикетки большой коробки:', err);
      throw this.toPrintException(err, `Ошибка печати этикетки большой коробки ${boxNumber}`);
    }
  }

  public async printPalletLabel(
    palletNumber: number,
    taskId: number,
    checkPrinter = true,
  ): Promise<void> {
    try {
      if (checkPrinter) {
        await this.assertPrinterAlive(PrinterLabels.Printer1);
      }

      const task = await this.taskService.getTaskById(taskId);

      if (!task) {
        throw new BadRequestException(`Конфигурации для задачи ${taskId} нет`);
      }

      if (!task.piecesPerPallet) {
        throw new BadRequestException('В задаче не указано количество продуктов на паллете');
      }

      const data = await buildPalletLabelFile(palletNumber, task);

      await this.printerTransportService.sendFile(
        getPrinterName(),
        data,
        `паллеты ${palletNumber}`,
      );
    } catch (err: any) {
      this.logger.error('Ошибка печати этикетки паллеты:', err);
      throw this.toPrintException(err, `Ошибка печати этикетки паллеты ${palletNumber}`);
    }
  }
  public async getPrinterAliveStatus(name: string): Promise<boolean> {
    return this.printerMonitoringService.isPrinterAlive(name);
  }

  private async assertPrinterAlive(name: string): Promise<void> {
    if (!this.printerConnectionService.getEndpoint(name)) {
      throw new BadRequestException(`Принтер ${name} не подключён`);
    }

    const isAlive = await this.printerMonitoringService.isPrinterAlive(name);

    if (!isAlive) {
      throw new BadRequestException(`Принтер не доступен`);
    }
  }

  private toPrintException(error: unknown, fallback: string): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const message = (error as { message?: string } | undefined)?.message;

    return new BadRequestException(message || fallback);
  }
}
