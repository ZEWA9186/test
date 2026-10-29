import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { AggregationService } from './service/aggregation.service';
import { AggregationManualService } from './service/aggregation-manual.service';
import { AggregationReportService } from './service/aggregation-report.service';

@Controller('aggregation')
export class AggregationController {
  constructor(
    private readonly aggregationService: AggregationService,
    private readonly aggregationManualService: AggregationManualService,
    private readonly aggregationReportService: AggregationReportService,
  ) {}

  // Обычная фасовка

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    return this.aggregationService.processScan(tsdId, body.code);
  }

  @Get(':id/get-current-state')
  @HttpCode(HttpStatus.OK)
  async getCurrentState(@Param('id', ParseIntPipe) tsdId: number) {
    return await this.aggregationService.getCurrentState(tsdId);
  }

  // РУЧНЫЕ ОПЕРАЦИИ

  @Post(':id/delete-code')
  @HttpCode(HttpStatus.OK)
  async deleteCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    await this.aggregationManualService.deleteCode(tsdId, body.code);
  }

  @Post(':id/delete-package')
  @HttpCode(HttpStatus.OK)
  async deletePackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string },
  ) {
    await this.aggregationManualService.deletePackage(tsdId, body.packageLabel);
  }

  @Post(':id/move-box')
  @HttpCode(HttpStatus.OK)
  async moveBox(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { innerLabel: string; outerLabel: string },
  ) {
    await this.aggregationManualService.moveBox(body.innerLabel, body.outerLabel, tsdId);
  }

  @Post(':id/add-product-into-package')
  @HttpCode(HttpStatus.OK)
  async addProductIntoPackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string; code: string },
  ) {
    return this.aggregationManualService.addProductIntoPackage(body.packageLabel, tsdId, body.code);
  }

  // ИНФОРМАЦИЯ И ПОИСК

  @Post(':id/search-product')
  @HttpCode(HttpStatus.OK)
  async searchProductInfo(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { code: string },
  ) {
    return this.aggregationReportService.searchInfo(tsdId, body.code);
  }

  @Get(':id/getStats')
  @HttpCode(HttpStatus.OK)
  async getStats(@Param('id', ParseIntPipe) tsdId: number) {
    return await this.aggregationReportService.validateTaskCompletion(tsdId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async ping() {}
}
