import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationRules } from './aggregation.rules';

@Injectable()
export class AggregationProductService {
  constructor(private readonly aggregationRepository: AggregationRepository) {}

  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
    manager: EntityManager,
  ) {
    const limit = AggregationRules.getProductLimit(activeTask);

    const currentCount = await this.aggregationRepository.countProductsInPackage(
      activeTask,
      packageLabel,
      manager,
    );

    if (currentCount >= limit) {
      throw new BadRequestException(`Тара ${packageLabel} заполнена: ${currentCount}/${limit}`);
    }

    await this.aggregationRepository.addProductIntoPackage(
      activeTask,
      code,
      packageLabel,
      packageType,
      manager,
    );
  }
}
