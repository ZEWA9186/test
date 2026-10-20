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

  @Get(':id/getStats')
  @HttpCode(HttpStatus.OK)
  async getStats(@Param('id', ParseIntPipe) tsdId: number) {
    return await this.aggregationService.validateTaskCompletion(tsdId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async ping() {}
}
