import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';

import {
    ActiveTaskEntity,
    ExpectedScanType,
} from '../entities/active-task.entity';

import { AggregationRepository } from '../repository/aggregation.repository'

@Injectable()
export class AggregationContainerService {

    constructor(
        private readonly aggregationRepository: AggregationRepository,
    ) {}

    async closeContainer(
        activeTask: ActiveTaskEntity,
        code: string,
    ) {
        switch (activeTask.expectedScan) {
            case ExpectedScanType.SMALL_BOX_LABEL:
                return this.closeSmallBox(
                    activeTask,
                    code,
                );

            case ExpectedScanType.BIG_BOX_LABEL:
                return this.closeBigBox(
                    activeTask,
                    code,
                );

            case ExpectedScanType.PALLET_LABEL:
                return this.closePallet(
                    activeTask,
                    code,
                );

            default:
                throw new BadRequestException(
                    `Некорректное состояние: ${activeTask.expectedScan}`,
                );
        }
    }

    private async closeSmallBox(
        activeTask: ActiveTaskEntity,
        code: string,
    ) {
        await this.aggregationRepository.setContainerLabel(
            activeTask,
            ExpectedScanType.SMALL_BOX_LABEL,
            code,
        );

        const smallBoxCount =
            await this.aggregationRepository.getClosedSmallBoxCount(
                activeTask,
            );
        if (
            smallBoxCount >=
            activeTask.piecesPerBigBox
        ) {
            activeTask.expectedScan =
                ExpectedScanType.BIG_BOX_LABEL;
        } else {
            activeTask.expectedScan =
                ExpectedScanType.PRODUCT;
        }

        await this.aggregationRepository.saveActiveTask(
            activeTask,
        );
    }

    private async closeBigBox(
        activeTask: ActiveTaskEntity,
        code: string,
    ) {
        await this.aggregationRepository.setContainerLabel(
            activeTask,
            ExpectedScanType.BIG_BOX_LABEL,
            code,
        );

        const bigBoxCount =
            await this.aggregationRepository.getClosedBigBoxCount(
                activeTask,
            );

        if (
            bigBoxCount >=
            activeTask.piecesPerPallet
        ) {
            activeTask.expectedScan =
                ExpectedScanType.PALLET_LABEL;
        } else {
            activeTask.expectedScan =
                ExpectedScanType.PRODUCT;
        }
        await this.aggregationRepository.saveActiveTask(
            activeTask,
        );
    }

    private async closePallet(
        activeTask: ActiveTaskEntity,
        code: string,
    ) {
        await this.aggregationRepository.setContainerLabel(
            activeTask,
            ExpectedScanType.PALLET_LABEL,
            code,
        );

        activeTask.expectedScan =
            ExpectedScanType.PRODUCT;

        await this.aggregationRepository.saveActiveTask(
            activeTask,
        );
    }
}