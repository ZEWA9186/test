import { BadRequestException, Injectable } from '@nestjs/common';

import { ActiveTaskEntity, ExpectedScanType } from './entities/active-task.entity';
import { AggregationRepository } from './repository/aggregation.repository';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';
import { CodeService } from '../code/code.service';
import { Gs1ParserService } from '../gs1-parser/gs1-parser.service';
import { AggregationRules } from './helper-service/aggregation.rules';
import { AggregationInfoDto } from './dto/responce.dto';

@Injectable()
export class AggregationService {
  constructor(
    private readonly aggregationRepository: AggregationRepository,
    private readonly aggregationProductService: AggregationProductService,
    private readonly aggregationContainerService: AggregationContainerService,
    private readonly codeService: CodeService,
    private readonly gs1Parser: Gs1ParserService,
  ) {}

  async processScan(tsdId: number, code: string) {
    //TODO проверка задания
    //TODO транзакция

    const activeTask = await this.aggregationRepository.getActiveTask(tsdId);

    const scanType = this.gs1Parser.getScanType(code, activeTask);

    if (scanType !== activeTask.expectedScan) {
      throw new BadRequestException(`Ожидался ${activeTask.expectedScan}`);
    }

    if (activeTask.expectedScan === ExpectedScanType.PRODUCT) {
      try {
        await this.codeService.validateAndSaveCode(code);
      } catch (error) {
        throw new BadRequestException(error);
      }
      return this.aggregationProductService.addProduct(activeTask, code);
    }

    return this.aggregationContainerService.closeContainer(activeTask, code);
  }

  async deleteCode(code: string, tsdId: number) {
    //TODO транзакция

    const deletedCode = await this.aggregationRepository.deleteProductAndResetExpectedScan(
      tsdId,
      code,
    );
    await this.codeService.deleteCode(deletedCode);
  }

  async deletePackage(packageLabel: string, tsdId: number) {
    //TODO транзакция
    const codes = await this.aggregationRepository.deletePackageAndResetExpectedScan(
      tsdId,
      packageLabel,
    );
    await this.codeService.batchDeleteCodes(codes);
  }

  async addProductIntoPackage(packageLabel: string, tsdId: number, code: string) {
    const activeTask = await this.aggregationRepository.getActiveTask(tsdId);

    const packageType = this.gs1Parser.getScanType(packageLabel, activeTask);

    const expectedPackageType = AggregationRules.getNextContainerType(activeTask);

    if (packageType !== expectedPackageType) {
      throw new BadRequestException(`Товар можно добавить только в ${expectedPackageType}`);
    }

    const productType = this.gs1Parser.getScanType(code, activeTask);

    if (productType !== ExpectedScanType.PRODUCT) {
      throw new BadRequestException('Ожидался товарный код');
    }
    //TODO транзакция
    try {
      await this.codeService.validateAndSaveCode(code);
    } catch (error) {
      throw new BadRequestException(error);
    }
    return this.aggregationProductService.addProductIntoPackage(
      activeTask,
      code,
      packageLabel,
      packageType,
    );
  }

  async searchInfo(tsdId: number, code: string) {
    const activeTask = await this.aggregationRepository.getActiveTask(tsdId);
    const scanType = this.gs1Parser.getScanType(code, activeTask);
    if (scanType === ExpectedScanType.PRODUCT) {
      return await this.searchProductInfo(code, activeTask, scanType);
    }
    if (
      scanType === ExpectedScanType.BIG_BOX_LABEL ||
      scanType === ExpectedScanType.SMALL_BOX_LABEL ||
      scanType == ExpectedScanType.PALLET_LABEL
    ) {
      return await this.searchPackageInfo(code, activeTask, scanType);
    }
    throw new BadRequestException();
  }

  private async searchProductInfo(
    code: string,
    activeTask: ActiveTaskEntity,
    scanType: ExpectedScanType,
  ): Promise<AggregationInfoDto> {
    const product = await this.aggregationRepository.searchProductInfo(activeTask, code);

    return {
      scanType,
      label: code,
      parents: {
        smallBox: product.smallBoxLabel,
        bigBox: product.bigBoxLabel,
        pallet: product.palletLabel,
      },
      contentsCount: null,
      contentsType: null,
      aggregationLvl: activeTask.aggregationLvl,
    };
  }

  async searchPackageInfo(
    packageLabel: string,
    activeTask: ActiveTaskEntity,
    scanType: ExpectedScanType,
  ): Promise<AggregationInfoDto> {
    const packaging = await this.aggregationRepository.searchPackageInfo(
      activeTask,
      packageLabel,
      scanType,
    );

    const contentsCount = await this.aggregationRepository.countPackageContents(
      activeTask,
      packageLabel,
      scanType,
    );

    let parents = {
      smallBox: null as string | null,
      bigBox: null as string | null,
      pallet: null as string | null,
    };

    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        parents = {
          smallBox: null,
          bigBox: packaging.bigBoxLabel,
          pallet: packaging.palletLabel,
        };
        break;

      case ExpectedScanType.BIG_BOX_LABEL:
        parents = {
          smallBox: null,
          bigBox: null,
          pallet: packaging.palletLabel,
        };
        break;

      case ExpectedScanType.PALLET_LABEL:
        break;
    }

    const contentsType = AggregationRules.getContentsType(activeTask, scanType);

    return {
      scanType,
      label: packageLabel,
      parents,
      contentsCount,
      contentsType,
      aggregationLvl: activeTask.aggregationLvl,
    };
  }
}
