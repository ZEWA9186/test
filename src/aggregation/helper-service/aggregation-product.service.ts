import {
    Injectable,
} from '@nestjs/common';

import { ActiveTaskEntity } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationRules } from './aggregation.rules';

@Injectable()
export class AggregationProductService {

    constructor(
        private readonly aggregationRepository: AggregationRepository,
    ) {}

    async addProduct(
        activeTask: ActiveTaskEntity,
        code: string,
    ) {
        await this.aggregationRepository.addProduct(
            activeTask,
            code,
        );

        const count =
            await this.aggregationRepository.getOpenProductCount(
                activeTask,
            );

        const limit =
            AggregationRules.getProductLimit(activeTask);

        if (count < limit) {
            return;
        }

        activeTask.expectedScan =
            AggregationRules.getNextContainerType(
                activeTask,
            );

        await this.aggregationRepository.saveActiveTask(
            activeTask,
        );

    }
}