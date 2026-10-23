import { Injectable } from '@nestjs/common';

import { ActiveTaskEntity } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationResponseDto } from '../dto/responce.dto';

@Injectable()
export class AggregationProgressService {
  constructor(private readonly aggregationRepository: AggregationRepository) {}

  async getProgress(activeTask: ActiveTaskEntity): Promise<AggregationResponseDto> {
    const hasSmallBox = activeTask.aggregationLvl === 3;
    const hasBigBox = activeTask.aggregationLvl === 2 || activeTask.aggregationLvl === 3;

    let smallBox: AggregationResponseDto['smallBox'] = null;
    let bigBox: AggregationResponseDto['bigBox'] = null;
    let pallet: AggregationResponseDto['pallet'] = null;

    // Малый короб: количество товаров, ещё не закрытых малым коробом.
    if (hasSmallBox) {
      const current = await this.aggregationRepository.getOpenProductCount(activeTask);

      smallBox = {
        current,
        limit: activeTask.piecesPerSmallBox,
      };
    }

    // Большой короб: малые короба либо товары, если малые короба не используются.
    if (hasBigBox) {
      const current = hasSmallBox
        ? await this.aggregationRepository.getClosedSmallBoxCount(activeTask)
        : await this.aggregationRepository.getOpenProductCount(activeTask);

      bigBox = {
        current,
        limit: activeTask.piecesPerBigBox,
      };
    }

    // Палета: большие короба либо товары, если большие короба не используются.
    const current = hasBigBox
      ? await this.aggregationRepository.getClosedBigBoxCount(activeTask)
      : await this.aggregationRepository.getOpenProductCount(activeTask);

    pallet = {
      current,
      limit: activeTask.piecesPerPallet,
    };

    return {
      smallBox,
      bigBox,
      pallet,
      expectedScan: activeTask.expectedScan,
    };
  }
}
