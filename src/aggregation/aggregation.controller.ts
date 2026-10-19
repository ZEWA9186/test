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

import { AggregationService } from './aggregation.service';

@Controller('aggregation')
export class AggregationController {
  constructor(private readonly aggregationService: AggregationService) {}

  // Обычная фасовка

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    return this.aggregationService.processScan(tsdId, body.code);
  }

  @Post(':id/add-product-into-package')
  @HttpCode(HttpStatus.OK)
  async addProductIntoPackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string; code: string },
  ) {
    return this.aggregationService.addProductIntoPackage(body.packageLabel, tsdId, body.code);
  }

  @Post(':id/search-product')
  @HttpCode(HttpStatus.OK)
  async searchProductInfo(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { code: string },
  ) {
    return this.aggregationService.searchInfo(tsdId, body.code);
  }

  @Post(':id/delete-package')
  @HttpCode(HttpStatus.OK)
  async deletePackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string },
  ) {
    await this.aggregationService.deletePackage(tsdId, body.packageLabel);
  }

  @Post(':id/move-box')
  @HttpCode(HttpStatus.OK)
  async moveBox(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { boxLabel: string; palletLabel: string },
  ) {
    await this.aggregationService.moveBox(body.boxLabel, body.palletLabel, tsdId);
  }

  @Post(':id/delete-code')
  @HttpCode(HttpStatus.OK)
  async deleteCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    await this.aggregationService.deleteCode(tsdId, body.code);
  }

  // Историческая фасовка

  @Post(':id/history/scan')
  @HttpCode(HttpStatus.OK)
  async sendHistoryCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    return this.aggregationService.processScan(tsdId, body.code);
  }

  @Post(':id/history/add-product-into-package')
  @HttpCode(HttpStatus.OK)
  async addProductIntoHistoryPackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string; code: string },
  ) {
    return this.aggregationService.addProductIntoPackage(body.packageLabel, tsdId, body.code);
  }

  @Post(':id/history/search-product')
  @HttpCode(HttpStatus.OK)
  async searchHistoryProductInfo(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { code: string },
  ) {
    return this.aggregationService.searchInfo(tsdId, body.code);
  }

  @Post(':id/history/delete-package')
  @HttpCode(HttpStatus.OK)
  async deleteHistoryPackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string },
  ) {
    await this.aggregationService.deletePackage(tsdId, body.packageLabel);
  }

  @Post(':id/history/move-box')
  @HttpCode(HttpStatus.OK)
  async moveHistoryBox(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { boxLabel: string; palletLabel: string },
  ) {
    await this.aggregationService.moveBox(body.boxLabel, body.palletLabel, tsdId);
  }

  @Post(':id/history/delete-code')
  @HttpCode(HttpStatus.OK)
  async deleteHistoryCode(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { code: string },
  ) {
    await this.aggregationService.deleteCode(tsdId, body.code);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async ping() {}
}
