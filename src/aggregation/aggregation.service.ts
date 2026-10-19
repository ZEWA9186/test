import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from './entities/active-task.entity';
import { AggregationRepository } from './repository/aggregation.repository';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';
import { AggregationRules } from './helper-service/aggregation.rules';
import { AggregationInfoDto } from './dto/responce.dto';

import { CodeService } from '../code/code.service';
import { Gs1ParserService } from '../gs1-parser/gs1-parser.service';

// TODO: логирование ручных операций и ошибок.
@Injectable()
export class AggregationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly aggregationRepository: AggregationRepository,
    private readonly aggregationProductService: AggregationProductService,
    private readonly aggregationContainerService: AggregationContainerService,
    private readonly codeService: CodeService,
    private readonly gs1Parser: Gs1ParserService,
  ) {}

  // Обычный поток сканирования работает только с текущей фасовкой.
  async processScan(tsdId: number, code: string) {
    const { activeTask, scanType } = await this.getAndValidateActiveTask(tsdId, code);

    if (scanType !== ExpectedScanType.PRODUCT) {
      return this.withTransaction((manager) =>
        this.aggregationContainerService.closeContainer(activeTask, code, manager),
      );
    }

    return this.withTransaction(async (manager) => {
      await this.codeService.validateAndSaveCode(code, manager);
      return this.aggregationProductService.addProduct(activeTask, code, manager);
    });
  }

  async deleteCode(tsdId: number, code: string): Promise<void> {
    await this.withTransaction(async (manager) => {
      const activeTask = await this.getActiveTask(tsdId, manager);
      const deletedCode = await this.aggregationRepository.deleteProduct(activeTask, code, manager);

      await this.codeService.deleteCode(deletedCode, manager);
    });
  }

  async deletePackage(tsdId: number, packageLabel: string): Promise<void> {
    await this.withTransaction(async (manager) => {
      const activeTask = await this.getActiveTask(tsdId, manager);
      const codes = await this.aggregationRepository.deletePackage(
        activeTask,
        packageLabel,
        manager,
      );

      await this.codeService.batchDeleteCodes(codes, manager);
    });
  }

  async addProductIntoPackage(packageLabel: string, tsdId: number, code: string) {
    const activeTask = await this.getActiveTask(tsdId);
    const expectedPackageType = AggregationRules.getNextContainerType(activeTask);
    const packageType = this.validateScanType(
      packageLabel,
      activeTask,
      expectedPackageType,
      `Товар можно добавить только в ${expectedPackageType}`,
    );

    this.validateScanType(code, activeTask, ExpectedScanType.PRODUCT, 'Ожидался товарный код');

    return this.withTransaction(async (manager) => {
      await this.codeService.validateAndSaveCode(code, manager);

      return this.aggregationProductService.addProductIntoPackage(
        activeTask,
        code,
        packageLabel,
        packageType,
        manager,
      );
    });
  }

  async moveBox(boxLabel: string, palletLabel: string, tsdId: number): Promise<void> {
    const activeTask = await this.getActiveTask(tsdId);

    await this.withTransaction((manager) =>
      this.aggregationRepository.moveBox(boxLabel, palletLabel, activeTask, manager),
    );
  }

  async searchInfo(tsdId: number, code: string): Promise<AggregationInfoDto> {
    const activeTask = await this.getActiveTask(tsdId);
    const scanType = this.gs1Parser.getScanType(code, activeTask);

    switch (scanType) {
      case ExpectedScanType.PRODUCT:
        return this.searchProductInfo(code, activeTask, scanType);

      case ExpectedScanType.SMALL_BOX_LABEL:
      case ExpectedScanType.BIG_BOX_LABEL:
      case ExpectedScanType.PALLET_LABEL:
        return this.searchPackageInfo(code, activeTask, scanType);

      default:
        throw new BadRequestException('Не удалось определить тип этикетки');
    }
  }

  private async getActiveTask(tsdId: number, manager?: EntityManager): Promise<ActiveTaskEntity> {
    return this.aggregationRepository.getActiveTask(tsdId, manager);
  }

  private async getAndValidateActiveTask(
    tsdId: number,
    code: string,
  ): Promise<{ activeTask: ActiveTaskEntity; scanType: ExpectedScanType }> {
    const activeTask = await this.getActiveTask(tsdId);
    const scanType = this.validateScanType(
      code,
      activeTask,
      activeTask.expectedScan,
      `Ожидался ${activeTask.expectedScan}`,
    );

    return { activeTask, scanType };
  }

  private validateScanType(
    code: string,
    activeTask: ActiveTaskEntity,
    expectedType: ExpectedScanType,
    errorMessage: string,
  ): ExpectedScanType {
    const scanType = this.gs1Parser.getScanType(code, activeTask);

    if (scanType !== expectedType) {
      throw new BadRequestException(errorMessage);
    }

    return scanType;
  }

  private withTransaction<T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(callback);
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

  private async searchPackageInfo(
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

    const parents: AggregationInfoDto['parents'] = {
      smallBox: null,
      bigBox: null,
      pallet: null,
    };

    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        parents.bigBox = packaging.bigBoxLabel;
        parents.pallet = packaging.palletLabel;
        break;

      case ExpectedScanType.BIG_BOX_LABEL:
        parents.pallet = packaging.palletLabel;
        break;

      case ExpectedScanType.PALLET_LABEL:
        break;

      default:
        throw new BadRequestException('Ожидалась этикетка упаковки');
    }

    return {
      scanType,
      label: packageLabel,
      parents,
      contentsCount,
      contentsType: AggregationRules.getContentsType(activeTask.aggregationLvl, scanType),
      aggregationLvl: activeTask.aggregationLvl,
    };
  }
}
