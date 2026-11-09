import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { AggregationRules } from '../helper-service/aggregation.rules';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AggregationRepository } from '../repository/aggregation.repository';
import { Gs1ParserService } from '../../validation/gs1-parser.service';
import {
  getScanTypeLabel,
  getScanTypeLabelPrepositional,
} from '../helper-service/aggregation-scan-label';

@Injectable()
export class AggregationSharedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly aggregationRepository: AggregationRepository,
    private readonly gs1Parser: Gs1ParserService,
  ) {}

  async getActiveTask(tsdId: number, manager?: EntityManager): Promise<ActiveTaskEntity> {
    const activeTask = await this.aggregationRepository.getActiveTask(tsdId, manager);
    if (!activeTask) throw new BadRequestException('Активное задание не назначено');
    return activeTask;
  }

  validateScanType(
    code: string,
    activeTask: ActiveTaskEntity,
    expectedType: ExpectedScanType,
  ): ExpectedScanType {
    const scanType = this.gs1Parser.getScanType(code, activeTask);
    if (scanType !== expectedType) {
      throw new BadRequestException(
        `Сейчас нужно сканировать: ${getScanTypeLabel(expectedType)}. ` +
          `Отсканировано: ${getScanTypeLabel(scanType)}.`,
      );
    }
    return scanType;
  }

  withTransaction<T>(
    tsdId: number,
    cb: (manager: EntityManager, activeTask: ActiveTaskEntity) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const activeTask = await this.getActiveTask(tsdId, manager);

      if (!activeTask.packagingTableName) {
        throw new BadRequestException('Таблица фасовки не назначена');
      }

      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        activeTask.packagingTableName,
      ]);

      return cb(manager, activeTask);
    });
  }
  async withReadTransaction<T>(
    tsdId: number,
    cb: (manager: EntityManager, activeTask: ActiveTaskEntity) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const activeTask = await this.getActiveTask(tsdId, manager);

      if (!activeTask.packagingTableName) {
        throw new BadRequestException('Таблица фасовки не назначена');
      }

      return cb(manager, activeTask);
    });
  }

  async assertCapacity(
    scanType: ExpectedScanType,
    activeTask: ActiveTaskEntity,
    currentCount: number,
  ): Promise<void> {
    const limit = AggregationRules.getLimitByType(scanType, activeTask);
    if (limit === null || currentCount >= limit) {
      throw new BadRequestException(
        `В ${getScanTypeLabelPrepositional(scanType)} уже достигнут лимит`,
      );
    }
  }
}
