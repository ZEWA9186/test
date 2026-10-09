import { BadRequestException, Injectable } from '@nestjs/common';

import { ExpectedScanType } from './entities/active-task.entity';
import { AggregationRepository } from './repository/aggregation.repository';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';
import { CodeService } from '../code/code.service';
import { Gs1ParserService } from '../gs1-parser/gs1-parser.service';

@Injectable()
export class AggregationService {
  constructor(
    private readonly aggregationRepository: AggregationRepository,
    private readonly aggregationProductService: AggregationProductService,
    private readonly aggregationContainerService: AggregationContainerService,
    private readonly codeService: CodeService,
    private readonly gs1Parser: Gs1ParserService,
  ) {}

  async processScan(tsdId: number, code: string) {
    //TODO Не дублировать инфу в связанной таблице
    const activeTask = await this.aggregationRepository.getActiveTask(tsdId);

    const scanType = this.gs1Parser.getScanType(code, activeTask);

    if (scanType !== activeTask.expectedScan) {
      throw new BadRequestException(`Ожидался ${activeTask.expectedScan}`);
    }

    if (activeTask.expectedScan === ExpectedScanType.PRODUCT) {
      await this.codeService.validateAndSaveCode(code);
      return this.aggregationProductService.addProduct(activeTask, code);
    }

    return this.aggregationContainerService.closeContainer(activeTask, code);
  }
}
