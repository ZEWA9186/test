import { Controller, Post, Body, Get, Param, Header } from '@nestjs/common';

import { PrinterService } from './printer.service';
import { PrinterLabels } from './types';

@Controller('printer')
export class PrinterController {
  constructor(private readonly printerService: PrinterService) {}

  @Post('update-config')
  async updateConfig(
    @Body()
    body: {
      name: string;
      type: string;
      host: string;
      port: number;
      enabled?: boolean;
    },
  ): Promise<void> {
    await this.printerService.updatePrinterConfig(
      body.name,
      body.type,
      body.host,
      body.port,
      body.enabled,
    );
  }

  @Post('print-DM')
  async printDM(@Body('taskId') taskId: number): Promise<void> {
    await this.printerService.printAllDM(taskId);
  }

  @Header('Cache-Control', 'no-store')
  @Get(':label')
  async getConfig(@Param('label') label: PrinterLabels): Promise<any> {
    try {
      return await this.printerService.getConfigByName(label);
    } catch (err) {
      console.log('getConfig', err);
    }
  }

  // ============================================================
  // МАЛЫЕ КОРОБКИ
  // ============================================================

  /**
   * Печать одной этикетки малой коробки.
   *
   * boxNumber — номер коробки из внешнего ресурса.
   * taskId — задача.
   * Количество продукции берётся из task.piecesPerSmallBox.
   */
  @Post('print-box')
  async printBox(
    @Body()
    body: {
      boxNumber: number;
      taskId: number;
    },
  ): Promise<void> {
    await this.printerService.printSmallBoxLabel(body.boxNumber, body.taskId);
  }

  /**
   * Печать всех малых коробок.
   *
   * Номер коробки получает PrinterService
   * через LastPackageService.
   */
  @Post('print-all-box')
  async printAllBox(@Body('taskId') taskId: number): Promise<void> {
    await this.printerService.printAllSmallBoxLabel(taskId);
  }

  // ============================================================
  // БОЛЬШИЕ КОРОБКИ
  // ============================================================

  /**
   * Печать одной этикетки большой коробки.
   *
   * boxNumber — номер коробки из внешнего ресурса.
   * taskId — задача.
   * Количество продукции берётся из task.piecesPerBigBox.
   */
  @Post('print-big-box')
  async printBigBox(
    @Body()
    body: {
      boxNumber: number;
      taskId: number;
    },
  ): Promise<void> {
    await this.printerService.printBigBoxLabel(body.boxNumber, body.taskId);
  }

  /**
   * Печать всех больших коробок.
   */
  @Post('print-all-big-box')
  async printAllBigBox(@Body('taskId') taskId: number): Promise<void> {
    await this.printerService.printAllBigBoxLabel(taskId);
  }

  // ============================================================
  // ПАЛЛЕТЫ
  // ============================================================

  /**
   * Печать одной этикетки паллеты.
   *
   * palletNumber — номер паллеты из внешнего ресурса.
   * taskId — задача.
   *
   * Количество продукции для этикетки
   * определяется внутри PrinterService.
   */
  @Post('print-pallet')
  async printPallet(
    @Body()
    body: {
      palletNumber: number;
      taskId: number;
    },
  ): Promise<void> {
    await this.printerService.printPalletLabel(body.palletNumber, body.taskId);
  }

  /**
   * Печать всех паллет.
   */
  @Post('print-all-pallet')
  async printAllPallet(@Body('taskId') taskId: number): Promise<void> {
    await this.printerService.printAllPalletLabel(taskId);
  }
}
