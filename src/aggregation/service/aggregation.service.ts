import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { Injectable } from '@nestjs/common';
import { AggregationSharedService } from './aggregation-shared.service';
import { AggregationRepository } from '../repository/aggregation.repository';
import { CodeService } from '../../code/code.service';
import { withOperationLogging } from '../helper-service/aggregation-operation-logger';
import { AggregationRules } from '../helper-service/aggregation.rules';
import { AggregationCounts } from '../entities/aggregation-counts';
import { AggregationResponseDto } from '../dto/responce.dto';

@Injectable()
export class AggregationService {
  constructor(
    private readonly shared: AggregationSharedService,
    private readonly aggregationRepository: AggregationRepository,
    private readonly codeService: CodeService,
  ) {}

  async processScan(tsdId: number, code: string) {
    return withOperationLogging({ tsdId, operation: 'processScan', code }, async (context) => {
      return this.shared.withTransaction(async (manager) => {
        const activeTask = await this.aggregationRepository.getActiveTaskForUpdate(tsdId, manager);
        context.taskId = activeTask.taskId;

        const counts = await this.aggregationRepository.getCounts(activeTask, manager);
        const expected = AggregationRules.getExpectedScan(activeTask, counts);
        const scanType = this.shared.validateScanType(code, activeTask, expected);

        if (scanType === ExpectedScanType.PRODUCT) {
          await this.codeService.validateAndSaveCode(code, manager);
          await this.aggregationRepository.addProduct(activeTask, code, manager);
        } else {
          await this.aggregationRepository.setContainerLabel(activeTask, scanType, code, manager);
        }

        const nextCounts = await this.aggregationRepository.getCounts(activeTask, manager);
        return this.getProgress(activeTask, nextCounts);
      });
    });
  }

  async getCurrentState(tsdId: number) {
    const activeTask = await this.shared.getActiveTask(tsdId);
    const counts = await this.aggregationRepository.getCounts(activeTask);
    return this.getProgress(activeTask, counts);
  }

  getProgress(activeTask: ActiveTaskEntity, counts: AggregationCounts): AggregationResponseDto {
    const lvl = activeTask.aggregationLvl;
    const expectedScan = AggregationRules.getExpectedScan(activeTask, counts);

    if (lvl === 1) {
      return {
        smallBox: null,
        bigBox: null,
        pallet: { current: counts.openProducts, limit: activeTask.piecesPerPallet },
        expectedScan,
      };
    }

    if (lvl === 2) {
      return {
        smallBox: null,
        bigBox: {
          current: counts.openProducts,
          limit: activeTask.piecesPerBigBox,
        },
        pallet: {
          current: counts.closedBigBoxes,
          limit: activeTask.piecesPerPallet,
        },
        expectedScan,
      };
    }

    return {
      smallBox: {
        current: counts.openProducts,
        limit: activeTask.piecesPerSmallBox,
      },
      bigBox: {
        current: counts.closedSmallBoxes,
        limit: activeTask.piecesPerBigBox,
      },
      pallet: {
        current: counts.closedBigBoxes,
        limit: activeTask.piecesPerPallet,
      },
      expectedScan,
    };
  }
}
