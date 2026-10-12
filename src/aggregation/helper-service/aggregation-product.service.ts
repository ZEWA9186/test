import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationRules } from './aggregation.rules';

@Injectable()
export class AggregationProductService {
  constructor(private readonly aggregationRepository: AggregationRepository) {}

  async addProduct(activeTask: ActiveTaskEntity, code: string) {
    try {
      await this.aggregationRepository.addProduct(activeTask, code);
      const count = await this.aggregationRepository.getOpenProductCount(activeTask);

      const limit = AggregationRules.getProductLimit(activeTask);

      if (count < limit) {
        return activeTask.expectedScan;
      }

      activeTask.expectedScan = AggregationRules.getNextContainerType(activeTask);

      await this.aggregationRepository.saveActiveTask(activeTask);

      return activeTask.expectedScan;
    } catch (err: any) {
      console.log(err);
      throw new InternalServerErrorException('Не удалось добавить продукт');
    }
  }
  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
  ) {
    const limit = AggregationRules.getProductLimit(activeTask);

    const currentCount = await this.aggregationRepository.countProductsInPackage(
      activeTask,
      packageLabel,
    );

    if (currentCount >= limit) {
      throw new BadRequestException(`Тара ${packageLabel} заполнена: ${currentCount}/${limit}`);
    }

    const packaging = await this.aggregationRepository.addProductIntoPackage(
      activeTask,
      code,
      packageLabel,
      packageType,
    );

    const productCount = await this.aggregationRepository.countProductsInPackage(
      activeTask,
      packageLabel,
    );

    if (productCount < limit) {
      return {
        success: true,
        productCount,
        limit,
        expectedScan: activeTask.expectedScan,
      };
    }

    const hasParent =
      packageType === ExpectedScanType.SMALL_BOX_LABEL
        ? Boolean(packaging.bigBoxLabel || packaging.palletLabel)
        : packageType === ExpectedScanType.BIG_BOX_LABEL
          ? Boolean(packaging.palletLabel)
          : false;

    if (hasParent) {
      activeTask.expectedScan = ExpectedScanType.PRODUCT;
    } else {
      let closedContainerCount = 0;

      if (activeTask.aggregationLvl === 2) {
        closedContainerCount = await this.aggregationRepository.getClosedBigBoxCount(activeTask);
      } else if (activeTask.aggregationLvl === 3) {
        closedContainerCount = await this.aggregationRepository.getClosedSmallBoxCount(activeTask);
      }

      activeTask.expectedScan = AggregationRules.getExpectedScanAfterPackage(
        activeTask,
        closedContainerCount,
      );
    }

    await this.aggregationRepository.saveActiveTask(activeTask);

    return activeTask.expectedScan;
  }
}
