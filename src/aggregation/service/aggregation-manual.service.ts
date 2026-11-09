import { BadRequestException, Injectable } from '@nestjs/common';

import { ExpectedScanType } from '../entities/active-task.entity';
import { AggregationRepository } from '../repository/aggregation.repository';
import { AggregationRules } from '../helper-service/aggregation.rules';
import { AggregationSharedService } from './aggregation-shared.service';

import { CodeService } from '../../code/code.service';
import { Gs1ParserService } from '../../validation/gs1-parser.service';
import { withOperationLogging } from '../helper-service/aggregation-operation-logger';

@Injectable()
export class AggregationManualService {
  constructor(
    private readonly shared: AggregationSharedService,
    private readonly aggregationRepository: AggregationRepository,
    private readonly codeService: CodeService,
    private readonly gs1Parser: Gs1ParserService,
  ) {}

  async deleteCode(tsdId: number, code: string): Promise<void> {
    return withOperationLogging({ tsdId, operation: 'deleteCode', code }, async (context) => {
      await this.shared.withTransaction(tsdId, async (manager, activeTask) => {
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
        await this.shared.withTransaction(tsdId, async (manager, activeTask) => {
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

  async addProductIntoPackage(packageLabel: string, tsdId: number, code: string): Promise<void> {
    return withOperationLogging(
      {
        tsdId,
        operation: 'addProductIntoPackage',
        packageLabel,
        code,
      },
      async (context) => {
        await this.shared.withTransaction(tsdId, async (manager, activeTask) => {
          context.taskId = activeTask.taskId;
          const expectedPackageType = AggregationRules.getNextContainerType(activeTask);

          const packageType = this.shared.validateScanType(
            packageLabel,
            activeTask,
            expectedPackageType,
          );

          this.shared.validateScanType(code, activeTask, ExpectedScanType.PRODUCT);

          await this.codeService.validateAndSaveCode(code, manager);

          const currentCount = await this.aggregationRepository.countProductsInPackage(
            activeTask,
            packageLabel,
            manager,
          );

          await this.shared.assertCapacity(packageType, activeTask, currentCount);

          await this.aggregationRepository.addProductIntoPackage(
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

  async moveBox(innerLabel: string, outerLabel: string, tsdId: number): Promise<void> {
    return withOperationLogging(
      { tsdId, operation: 'moveBox', innerLabel, outerLabel },
      async (context) => {
        await this.shared.withTransaction(tsdId, async (manager, activeTask) => {
          context.taskId = activeTask.taskId;

          const innerType = this.gs1Parser.getScanType(innerLabel, activeTask);

          const expectedOuter = AggregationRules.getOuterType(innerType);

          if (expectedOuter === null) {
            throw new BadRequestException();
          }

          this.shared.validateScanType(outerLabel, activeTask, expectedOuter);

          const outerCount = await this.aggregationRepository.getCountByLabel(
            outerLabel,
            expectedOuter,
            innerType,
            activeTask,
            manager,
          );
          console.log(outerCount);

          await this.shared.assertCapacity(expectedOuter, activeTask, outerCount);

          const isSmallBox = innerType === ExpectedScanType.SMALL_BOX_LABEL;

          await this.aggregationRepository.moveBox(
            innerLabel,
            outerLabel,
            expectedOuter,
            innerType,
            activeTask,
            isSmallBox,
            manager,
          );
        });
      },
    );
  }
}
