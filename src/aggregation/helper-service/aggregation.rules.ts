import {
    InternalServerErrorException,
} from '@nestjs/common';

import {
    ActiveTaskEntity,
    ExpectedScanType,
} from '../entities/active-task.entity';

export class AggregationRules {
    static getProductLimit(
        activeTask: ActiveTaskEntity,
    ): number {
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

    static getNextContainerType(
        activeTask: ActiveTaskEntity,
    ): ExpectedScanType {
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
}