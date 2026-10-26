import { Injectable } from '@nestjs/common';

import { ActiveTaskEntity } from '../entities/active-task.entity';
import { AggregationResponseDto } from '../dto/responce.dto';
import { AggregationRules } from './aggregation.rules';
import { AggregationCounts } from '../entities/aggregation-counts';

@Injectable()
export class AggregationProgressService {
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
