import { InternalServerErrorException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationProgressService } from './aggregation-progress.service';

@Injectable()
export class AggregationContainerService {
  constructor(
    private readonly aggregationRepository: AggregationRepository,
    private readonly aggregationProgressService: AggregationProgressService,
  ) {}

  async closeContainer(activeTask: ActiveTaskEntity, code: string, manager: EntityManager) {
    switch (activeTask.expectedScan) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return this.closeSmallBox(activeTask, code, manager);

      case ExpectedScanType.BIG_BOX_LABEL:
        return this.closeBigBox(activeTask, code, manager);

      case ExpectedScanType.PALLET_LABEL:
        return this.closePallet(activeTask, code, manager);

      default:
        throw new InternalServerErrorException(
          `Некорректное состояние: ${activeTask.expectedScan}`,
        );
    }
  }

  private async closeSmallBox(activeTask: ActiveTaskEntity, code: string, manager: EntityManager) {
    await this.aggregationRepository.setContainerLabel(
      activeTask,
      ExpectedScanType.SMALL_BOX_LABEL,
      code,
      manager,
    );

    const smallBoxCount = await this.aggregationRepository.getClosedSmallBoxCount(
      activeTask,
      manager,
    );

    activeTask.expectedScan =
      smallBoxCount >= activeTask.piecesPerBigBox
        ? ExpectedScanType.BIG_BOX_LABEL
        : ExpectedScanType.PRODUCT;

    await this.aggregationRepository.saveActiveTask(activeTask, manager);

    return await this.aggregationProgressService.getProgress(activeTask);
  }

  private async closeBigBox(activeTask: ActiveTaskEntity, code: string, manager: EntityManager) {
    await this.aggregationRepository.setContainerLabel(
      activeTask,
      ExpectedScanType.BIG_BOX_LABEL,
      code,
      manager,
    );

    const bigBoxCount = await this.aggregationRepository.getClosedBigBoxCount(activeTask, manager);

    activeTask.expectedScan =
      bigBoxCount >= activeTask.piecesPerPallet
        ? ExpectedScanType.PALLET_LABEL
        : ExpectedScanType.PRODUCT;

    await this.aggregationRepository.saveActiveTask(activeTask, manager);

    return this.aggregationProgressService.getProgress(activeTask);
  }

  private async closePallet(activeTask: ActiveTaskEntity, code: string, manager: EntityManager) {
    await this.aggregationRepository.setContainerLabel(
      activeTask,
      ExpectedScanType.PALLET_LABEL,
      code,
      manager,
    );

    activeTask.expectedScan = ExpectedScanType.PRODUCT;

    await this.aggregationRepository.saveActiveTask(activeTask, manager);

    return await this.aggregationProgressService.getProgress(activeTask);
  }
}
