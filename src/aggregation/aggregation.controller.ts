import {
  Body,
  Controller,
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
  async sendCode(
    @Param('id', ParseIntPipe) tsdId: number,
    @Body('code') code: string,
  ) {
    return await this.aggregationService.processScan(tsdId, code);
  }
}
