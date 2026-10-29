import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationInfoDto, ContainerFillStats } from '../dto/responce.dto';
import { AggregationRules } from '../helper-service/aggregation.rules';
import { AggregationSharedService } from './aggregation-shared.service';

import { Gs1ParserService } from '../../validation/gs1-parser.service';
import { withOperationLogging } from '../helper-service/aggregation-operation-logger';
import { TaskCodesEntity } from '../../task/entities/task-codes.entity';

@Injectable()
export class AggregationReportService {
  constructor(
    private readonly shared: AggregationSharedService,
    private readonly aggregationRepository: AggregationRepository,
    private readonly gs1Parser: Gs1ParserService,
    @InjectRepository(TaskCodesEntity)
    private readonly taskCodesRepository: Repository<TaskCodesEntity>,
  ) {}

  async searchInfo(tsdId: number, code: string): Promise<AggregationInfoDto> {
    return withOperationLogging({ tsdId, operation: 'searchInfo', code }, async (context) => {
      const activeTask = await this.shared.getActiveTask(tsdId);
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
      const activeTask = await this.shared.getActiveTask(tsdId);
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
          contents: container.contents.map(formatCode),
        }));

      if (activeTask.taskId === null) {
        throw new InternalServerErrorException();
      }

      const taskCodesCount = await this.taskCodesRepository.count({
        where: { taskId: activeTask.taskId },
      });

      if (stats.totalRecords !== taskCodesCount) {
        stats.isValid = false;
      }

      return {
        ...stats,
        requiredRecords: taskCodesCount,
        productsWithoutPackaging: stats.productsWithoutPackaging.map(formatCode),
        smallBoxesWithoutBigBox: stats.smallBoxesWithoutBigBox.map(formatCode),
        bigBoxesWithoutPallet: stats.bigBoxesWithoutPallet.map(formatCode),
        smallBoxes: formatContainers(stats.smallBoxes),
        bigBoxes: formatContainers(stats.bigBoxes),
        pallets: formatContainers(stats.pallets),
      };
    });
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
