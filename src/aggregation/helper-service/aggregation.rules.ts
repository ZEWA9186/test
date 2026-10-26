import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { AggregationCounts } from '../entities/aggregation-counts';

export type ContainerColumn = 'small_box_label' | 'big_box_label' | 'pallet_label';

/**
 * Описание одного контейнера на уровне агрегации.
 * Порядок в массиве: от нижнего контейнера к верхнему.
 */
export interface ContainerRule {
  scanType: ExpectedScanType;
  labelColumn: ContainerColumn;
  /** Колонка непосредственного содержимого. null — содержимое товары. */
  childLabelColumn: ContainerColumn | null;
  /** Колонки родителей, которые должны быть NULL при закрытии. */
  parentLabelColumns: ContainerColumn[];
  /** Колонки нижних уровней, которые не должны участвовать в закрытии. */
  lowerLevelLabelColumns: ContainerColumn[];
  limit: number;
}

export class AggregationRules {
  static getProductLimit(activeTask: ActiveTaskEntity): number {
    return this.getContainerRules(activeTask)[0].limit;
  }

  static getLimitByType(scanType: ExpectedScanType, activeTask: ActiveTaskEntity) {
    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return activeTask.piecesPerSmallBox;

      case ExpectedScanType.BIG_BOX_LABEL:
        return activeTask.piecesPerBigBox;

      case ExpectedScanType.PALLET_LABEL:
        return activeTask.piecesPerPallet;

      default:
        return null;
    }
  }

  static getNextContainerType(activeTask: ActiveTaskEntity): ExpectedScanType {
    return this.getContainerRules(activeTask)[0].scanType;
  }

  static getColumnByScanType(scanType: ExpectedScanType): ContainerColumn {
    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return 'small_box_label';

      case ExpectedScanType.BIG_BOX_LABEL:
        return 'big_box_label';

      case ExpectedScanType.PALLET_LABEL:
        return 'pallet_label';

      default:
        throw new BadRequestException(`Неизвестный тип тары: ${scanType}`);
    }
  }

  /**
   * Возвращает контейнеры уровня от нижнего к верхнему.
   * По этому описанию репозиторий строит SQL.
   */
  static getContainerRules(activeTask: ActiveTaskEntity): ContainerRule[] {
    const level = activeTask.aggregationLvl;

    switch (level) {
      case 1:
        return [
          {
            scanType: ExpectedScanType.PALLET_LABEL,
            labelColumn: 'pallet_label',
            childLabelColumn: null,
            parentLabelColumns: [],
            lowerLevelLabelColumns: ['small_box_label', 'big_box_label'],
            limit: activeTask.piecesPerPallet,
          },
        ];

      case 2:
        return [
          {
            scanType: ExpectedScanType.BIG_BOX_LABEL,
            labelColumn: 'big_box_label',
            childLabelColumn: null,
            parentLabelColumns: ['pallet_label'],
            lowerLevelLabelColumns: ['small_box_label'],
            limit: activeTask.piecesPerBigBox,
          },
          {
            scanType: ExpectedScanType.PALLET_LABEL,
            labelColumn: 'pallet_label',
            childLabelColumn: 'big_box_label',
            parentLabelColumns: [],
            lowerLevelLabelColumns: [],
            limit: activeTask.piecesPerPallet,
          },
        ];

      case 3:
        return [
          {
            scanType: ExpectedScanType.SMALL_BOX_LABEL,
            labelColumn: 'small_box_label',
            childLabelColumn: null,
            parentLabelColumns: ['big_box_label', 'pallet_label'],
            lowerLevelLabelColumns: [],
            limit: activeTask.piecesPerSmallBox,
          },
          {
            scanType: ExpectedScanType.BIG_BOX_LABEL,
            labelColumn: 'big_box_label',
            childLabelColumn: 'small_box_label',
            parentLabelColumns: ['pallet_label'],
            lowerLevelLabelColumns: [],
            limit: activeTask.piecesPerBigBox,
          },
          {
            scanType: ExpectedScanType.PALLET_LABEL,
            labelColumn: 'pallet_label',
            childLabelColumn: 'big_box_label',
            parentLabelColumns: [],
            lowerLevelLabelColumns: [],
            limit: activeTask.piecesPerPallet,
          },
        ];

      default:
        throw new InternalServerErrorException(`Неизвестный уровень агрегации: ${level}`);
    }
  }

  static getContentsCount(
    activeTask: ActiveTaskEntity,
    scanType: ExpectedScanType,
    recordsCount: number,
  ): number {
    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return recordsCount;

      case ExpectedScanType.BIG_BOX_LABEL:
        if (activeTask.aggregationLvl === 3) {
          return recordsCount / activeTask.piecesPerSmallBox;
        }

        return recordsCount;

      case ExpectedScanType.PALLET_LABEL:
        switch (activeTask.aggregationLvl) {
          case 1:
            return recordsCount;

          case 2:
            return recordsCount / activeTask.piecesPerBigBox;

          case 3:
            return recordsCount / (activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox);

          default:
            throw new InternalServerErrorException(
              `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
            );
        }

      default:
        throw new InternalServerErrorException(`Невозможно посчитать содержимое: ${scanType}`);
    }
  }

  static getContentsType(
    aggregationLvl: number,
    scanType: ExpectedScanType,
  ): ExpectedScanType | null {
    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return ExpectedScanType.PRODUCT;

      case ExpectedScanType.BIG_BOX_LABEL:
        return aggregationLvl === 3
          ? ExpectedScanType.SMALL_BOX_LABEL
          : ExpectedScanType.PRODUCT;

      case ExpectedScanType.PALLET_LABEL:
        return aggregationLvl === 1
          ? ExpectedScanType.PRODUCT
          : ExpectedScanType.BIG_BOX_LABEL;

      default:
        return null;
    }
  }

  static getExpectedScan(
    activeTask: ActiveTaskEntity,
    counts: AggregationCounts,
  ): ExpectedScanType {
    switch (activeTask.aggregationLvl) {
      case 1:
        return counts.openProducts >= activeTask.piecesPerPallet
          ? ExpectedScanType.PALLET_LABEL
          : ExpectedScanType.PRODUCT;

      case 2:
        if (counts.closedBigBoxes >= activeTask.piecesPerPallet) {
          return ExpectedScanType.PALLET_LABEL;
        }

        return counts.openProducts >= activeTask.piecesPerBigBox
          ? ExpectedScanType.BIG_BOX_LABEL
          : ExpectedScanType.PRODUCT;

      case 3:
        if (counts.closedBigBoxes >= activeTask.piecesPerPallet) {
          return ExpectedScanType.PALLET_LABEL;
        }

        if (counts.closedSmallBoxes >= activeTask.piecesPerBigBox) {
          return ExpectedScanType.BIG_BOX_LABEL;
        }

        return counts.openProducts >= activeTask.piecesPerSmallBox
          ? ExpectedScanType.SMALL_BOX_LABEL
          : ExpectedScanType.PRODUCT;

      default:
        throw new InternalServerErrorException(
          `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
        );
    }
  }
}
