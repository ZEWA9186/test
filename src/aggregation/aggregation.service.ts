import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from './entities/active-task.entity';
import { AggregationRepository } from './repository/aggregation.repository';
import { ContainerFillStats, AggregationInfoDto } from './dto/responce.dto';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';
import { AggregationRules } from './helper-service/aggregation.rules';

import { CodeService } from '../code/code.service';
import { Gs1ParserService } from '../validation/gs1-parser.service';
import { withOperationLogging } from './helper-service/aggregation-operation-logger';
import { AggregationProgressService } from './helper-service/aggregation-progress.service';

@Injectable()
export class AggregationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly aggregationRepository: AggregationRepository,
    private readonly aggregationProductService: AggregationProductService,
    private readonly aggregationContainerService: AggregationContainerService,
    private readonly codeService: CodeService,
    private readonly gs1Parser: Gs1ParserService,
    private readonly aggregationProgressService: AggregationProgressService,
  ) {}

  async processScan(tsdId: number, code: string) {
    return withOperationLogging({ tsdId, operation: 'processScan', code }, async (context) => {
      const activeTask = await this.getActiveTask(tsdId);
      context.taskId = activeTask.taskId;

      const scanType = this.validateScanType(code, activeTask, activeTask.expectedScan);

      if (scanType !== ExpectedScanType.PRODUCT) {
        return this.withTransaction((manager) =>
          this.aggregationContainerService.closeContainer(activeTask, code, manager),
        );
      }

      return this.withTransaction(async (manager) => {
        await this.codeService.validateAndSaveCode(code, manager);

        return this.aggregationProductService.addProduct(activeTask, code, manager);
      });
    });
  }

  async getCurrentState(tsdId: number) {
    const activeTask = await this.getActiveTask(tsdId);
    return await this.aggregationProgressService.getProgress(activeTask);
  }

  async deleteCode(tsdId: number, code: string): Promise<void> {
    return withOperationLogging({ tsdId, operation: 'deleteCode', code }, async (context) => {
      await this.withTransaction(async (manager) => {
        const activeTask = await this.getActiveTask(tsdId, manager);
        context.taskId = activeTask.taskId;

        const deletedCode = await this.aggregationRepository.deleteProduct(
          activeTask,
          code,
          manager,
        );

        await this.codeService.deleteCode(deletedCode, manager);
      });
    });
  }

  async deletePackage(tsdId: number, packageLabel: string): Promise<void> {
    return withOperationLogging(
      { tsdId, operation: 'deletePackage', packageLabel },
      async (context) => {
        await this.withTransaction(async (manager) => {
          const activeTask = await this.getActiveTask(tsdId, manager);
          context.taskId = activeTask.taskId;

          const codes = await this.aggregationRepository.deletePackage(
            activeTask,
            packageLabel,
            manager,
          );

          await this.codeService.batchDeleteCodes(codes, manager);
        });
      },
    );
  }

  async addProductIntoPackage(packageLabel: string, tsdId: number, code: string) {
    return withOperationLogging(
      {
        tsdId,
        operation: 'addProductIntoPackage',
        packageLabel,
        code,
      },
      async (context) => {
        const activeTask = await this.getActiveTask(tsdId);
        context.taskId = activeTask.taskId;

        const expectedPackageType = AggregationRules.getNextContainerType(activeTask);

        const packageType = this.validateScanType(packageLabel, activeTask, expectedPackageType);

        this.validateScanType(code, activeTask, ExpectedScanType.PRODUCT);

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
      },
    );
  }

  async moveBox(boxLabel: string, palletLabel: string, tsdId: number): Promise<void> {
    return withOperationLogging(
      { tsdId, operation: 'moveBox', boxLabel, palletLabel },
      async (context) => {
        const activeTask = await this.getActiveTask(tsdId);
        context.taskId = activeTask.taskId;

        await this.withTransaction((manager) =>
          this.aggregationRepository.moveBox(boxLabel, palletLabel, activeTask, manager),
        );
      },
    );
  }

  async searchInfo(tsdId: number, code: string): Promise<AggregationInfoDto> {
    return withOperationLogging({ tsdId, operation: 'searchInfo', code }, async (context) => {
      const activeTask = await this.getActiveTask(tsdId);
      context.taskId = activeTask.taskId;

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
    });
  }

  async validateTaskCompletion(tsdId: number) {
    return withOperationLogging({ tsdId, operation: 'validateTaskCompletion' }, async (context) => {
      const activeTask = await this.getActiveTask(tsdId);
      context.taskId = activeTask.taskId;

      const stats = await this.aggregationRepository.getTaskPackagingStats(activeTask);

      const formatCode = (code: string): string => {
        const scanType = this.gs1Parser.getScanType(code, activeTask);

        return scanType === ExpectedScanType.PRODUCT
          ? code
          : this.gs1Parser.getContainerNumber(code);
      };

      const formatContainers = (containers: ContainerFillStats[]) =>
        containers.map((container) => ({
          ...container,
          label: formatCode(container.label),
          productCodes: container.productCodes.map(formatCode),
        }));

      return {
        ...stats,
        productsWithoutPackaging: stats.productsWithoutPackaging.map(formatCode),
        smallBoxesWithoutBigBox: stats.smallBoxesWithoutBigBox.map(formatCode),
        bigBoxesWithoutPallet: stats.bigBoxesWithoutPallet.map(formatCode),
        smallBoxes: formatContainers(stats.smallBoxes),
        bigBoxes: formatContainers(stats.bigBoxes),
        pallets: formatContainers(stats.pallets),
      };
    });
  }

  private async getActiveTask(tsdId: number, manager?: EntityManager) {
    const activeTask = await this.aggregationRepository.getActiveTask(tsdId, manager);

    if (!activeTask) {
      throw new BadRequestException('Активное задание не назначено');
    }

    return activeTask;
  }

  private validateScanType(
    code: string,
    activeTask: ActiveTaskEntity,
    expectedType: ExpectedScanType,
  ): ExpectedScanType {
    const scanType = this.gs1Parser.getScanType(code, activeTask);

    if (scanType !== expectedType) {
      throw new BadRequestException(`Ожидалось ${expectedType}, получено ${scanType}`);
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
