import { InternalServerErrorException } from '@nestjs/common';

import {
  ActiveTaskEntity,
  ExpectedScanType,
} from '../entities/active-task.entity';

export class AggregationRules {
  static getProductLimit(activeTask: ActiveTaskEntity): number {
    switch (activeTask.aggregationLvl) {
      case 1:
        return activeTask.piecesPerPallet;

      case 2:
        return activeTask.piecesPerBigBox;

      case 3:
        return activeTask.piecesPerSmallBox;

      default:
        throw new InternalServerErrorException(
          `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
        );
    }
  }

  static getNextContainerType(activeTask: ActiveTaskEntity): ExpectedScanType {
    switch (activeTask.aggregationLvl) {
      case 1:
        return ExpectedScanType.PALLET_LABEL;

      case 2:
        return ExpectedScanType.BIG_BOX_LABEL;

      case 3:
        return ExpectedScanType.SMALL_BOX_LABEL;

      default:
        throw new InternalServerErrorException(
          `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
        );
    }
  }

  static getExpectedScanAfterPackage(
    activeTask: ActiveTaskEntity,
    closedContainerCount: number = 0,
  ): ExpectedScanType {
    switch (activeTask.aggregationLvl) {
      case 1:
        return ExpectedScanType.PRODUCT;

      case 2:
        return closedContainerCount >= activeTask.piecesPerPallet
          ? ExpectedScanType.PALLET_LABEL
          : ExpectedScanType.PRODUCT;

      case 3:
        return closedContainerCount >= activeTask.piecesPerBigBox
          ? ExpectedScanType.BIG_BOX_LABEL
          : ExpectedScanType.PRODUCT;

      default:
        throw new InternalServerErrorException(
          `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
        );
    }
  }

  static getContentsType(
    activeTask: ActiveTaskEntity,
    scanType: ExpectedScanType,
  ): ExpectedScanType | null {
    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return ExpectedScanType.PRODUCT;

      case ExpectedScanType.BIG_BOX_LABEL:
        return activeTask.aggregationLvl === 3
          ? ExpectedScanType.SMALL_BOX_LABEL
          : ExpectedScanType.PRODUCT;

      case ExpectedScanType.PALLET_LABEL:
        return activeTask.aggregationLvl === 1
          ? ExpectedScanType.PRODUCT
          : ExpectedScanType.BIG_BOX_LABEL;

      default:
        return null;
    }
  }
}
