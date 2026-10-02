import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  ActiveTaskEntity,
  ExpectedScanType,
} from '../entities/active-task.entity';

import { AggregationRepository } from '../repository/aggregation.repository';

@Injectable()
export class AggregationContainerService {
  constructor(private readonly aggregationRepository: AggregationRepository) {}

  async closeContainer(activeTask: ActiveTaskEntity, code: string) {
    try {
      switch (activeTask.expectedScan) {
        case ExpectedScanType.SMALL_BOX_LABEL:
          return this.closeSmallBox(activeTask, code);

        case ExpectedScanType.BIG_BOX_LABEL:
          return this.closeBigBox(activeTask, code);

        case ExpectedScanType.PALLET_LABEL:
          return this.closePallet(activeTask, code);

        default:
          throw new InternalServerErrorException(
            `Некорректное состояние: ${activeTask.expectedScan}`,
          );
      }
    } catch (err: any) {
      throw new InternalServerErrorException('Ошибка привязки этикеток');
    }
  }

  private async closeSmallBox(activeTask: ActiveTaskEntity, code: string) {
    await this.aggregationRepository.setContainerLabel(
      activeTask,
      ExpectedScanType.SMALL_BOX_LABEL,
      code,
    );

    const smallBoxCount =
      await this.aggregationRepository.getClosedSmallBoxCount(activeTask);
    if (smallBoxCount >= activeTask.piecesPerBigBox) {
      activeTask.expectedScan = ExpectedScanType.BIG_BOX_LABEL;
    } else {
      activeTask.expectedScan = ExpectedScanType.PRODUCT;
    }

    await this.aggregationRepository.saveActiveTask(activeTask);
    return activeTask.expectedScan;
  }

  private async closeBigBox(activeTask: ActiveTaskEntity, code: string) {
    await this.aggregationRepository.setContainerLabel(
      activeTask,
      ExpectedScanType.BIG_BOX_LABEL,
      code,
    );

    const bigBoxCount =
      await this.aggregationRepository.getClosedBigBoxCount(activeTask);

    if (bigBoxCount >= activeTask.piecesPerPallet) {
      activeTask.expectedScan = ExpectedScanType.PALLET_LABEL;
    } else {
      activeTask.expectedScan = ExpectedScanType.PRODUCT;
    }
    await this.aggregationRepository.saveActiveTask(activeTask);
    return activeTask.expectedScan;
  }

  private async closePallet(activeTask: ActiveTaskEntity, code: string) {
    await this.aggregationRepository.setContainerLabel(
      activeTask,
      ExpectedScanType.PALLET_LABEL,
      code,
    );

    activeTask.expectedScan = ExpectedScanType.PRODUCT;

    await this.aggregationRepository.saveActiveTask(activeTask);
    return activeTask.expectedScan;
  }
}
