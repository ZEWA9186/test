import {
  Injectable,
} from '@nestjs/common';

import { ExpectedScanType } from './entities/active-task.entity';
import { AggregationRepository } from './repository/aggregation.repository';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';
import {CodeService} from "../code/code.service";

@Injectable()
export class AggregationService {

  constructor(
      private readonly aggregationRepository: AggregationRepository,
      private readonly aggregationProductService: AggregationProductService,
      private readonly aggregationContainerService: AggregationContainerService,
      private readonly codeService: CodeService
  ) {}

  async processScan(
      tsdId: number,
      code: string,
  ) {

    // await this.codeService.validateAndSaveCode(code);

    const activeTask =
        await this.aggregationRepository.getActiveTask(tsdId);

    // TODO:
    // Здесь вызывается сервис определения типа кода.
    //
    // const scanType =
    //   await this.scanTypeService.identify(code);
    //
    // PRODUCT
    // SMALL_BOX_LABEL
    // BIG_BOX_LABEL
    // PALLET_LABEL
    //
    // Далее:
    //
    // if (scanType !== activeTask.expectedScan) {
    //   throw new BadRequestException(...);
    // }

    if (
        activeTask.expectedScan === ExpectedScanType.PRODUCT
    ) {
      return this.aggregationProductService.addProduct(
          activeTask,
          code,
      );
    }

    return this.aggregationContainerService.closeContainer(
        activeTask,
        code,
    );
  }
}