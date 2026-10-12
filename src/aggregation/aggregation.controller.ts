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

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async sendCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    return await this.aggregationService.processScan(tsdId, body.code);
  }

  @Post(':id/add-product-into-package')
  @HttpCode(HttpStatus.OK)
  async addProductIntoPackage(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string; code: string },
  ) {
    return await this.aggregationService.addProductIntoPackage(body.packageLabel, tsdId, body.code);
  }

  @Post(':id/search-product')
  @HttpCode(HttpStatus.OK)
  async searchProductInfo(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { code: string },
  ) {
    return await this.aggregationService.searchProductInfo(tsdId, body.code);
  }

  @Post(':id/search-package')
  @HttpCode(HttpStatus.OK)
  async searchPackageInfo(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body() body: { packageLabel: string },
  ) {
    return await this.aggregationService.searchPackageInfo(tsdId, body.packageLabel);
  }

  @Post(':id/delete-code')
  @HttpCode(HttpStatus.OK)
  async deleteCode(@Param('id', ParseIntPipe) tsdId: number, @Body() body: { code: string }) {
    return await this.aggregationService.deleteCode(body.code, tsdId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async ping() {}
}
