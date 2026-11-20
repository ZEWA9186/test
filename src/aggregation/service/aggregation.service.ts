import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { Injectable } from '@nestjs/common';
import { AggregationSharedService } from './aggregation-shared.service';
import { AggregationRepository } from '../repository/aggregation.repository';
import { CodeService } from '../../code/code.service';
import { withOperationLogging } from '../helper-service/aggregation-operation-logger';
import { AggregationRules } from '../helper-service/aggregation.rules';
import { AggregationCounts } from '../entities/aggregation-counts';
import { AggregationResponseDto } from '../dto/responce.dto';
import { AggregationGateway } from '../aggregation.gateway';

@Injectable()
export class AggregationService {
  constructor(
    private readonly shared: AggregationSharedService,
    private readonly aggregationRepository: AggregationRepository,
    private readonly codeService: CodeService,
    private readonly aggregationGateway: AggregationGateway,
  ) {}

  async processScan(tsdId: string, code: string) {
    return withOperationLogging({ tsdId, operation: 'processScan', code }, async (context) => {
      const result = await this.shared.withTransaction(tsdId, async (manager, activeTask) => {
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

      try {
        if (context.taskId != null) {
          const state = await this.getCurrentState(tsdId);

          if (state.pallet) {
            this.aggregationGateway.sendPalletCounter({
              taskId: context.taskId,
              pallet: {
                current: state.pallet.current,
                limit: state.pallet.limit,
              },
            });
          }
        }
      } catch {
        // Состояние для WebSocket не должно ломать успешный скан.
      }

      return result;
    });
  }

  async getCurrentState(tsdId: string) {
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
        pallet: {
          current: counts.openProducts,
          limit: activeTask.piecesPerPallet,
          shared: true,
        },
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
          shared: true,
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
        shared: true,
      },
      expectedScan,
    };
  }
}
