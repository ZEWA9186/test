import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import {
  ActiveTaskEntity,
  ExpectedScanType,
} from '../entities/active-task.entity';
import { PackagingEntity } from '../entities/packaging.entity';

@Injectable()
export class AggregationRepository {
  constructor(
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,

    @InjectRepository(PackagingEntity)
    private readonly packagingRepository: Repository<PackagingEntity>,
  ) {}

  async getActiveTask(tsdId: number): Promise<ActiveTaskEntity> {
    const activeTask = await this.activeTaskRepository.findOne({
      where: { tsdId },
      relations: {
        task: true,
      },
    });

    if (!activeTask) {
      throw new NotFoundException(`Для ТСД ${tsdId} нет активной задачи`);
    }

    return activeTask;
  }

  async saveActiveTask(
    activeTask: ActiveTaskEntity,
  ): Promise<ActiveTaskEntity> {
    return this.activeTaskRepository.save(activeTask);
  }

  async addProduct(
    activeTask: ActiveTaskEntity,
    code: string,
  ): Promise<PackagingEntity> {
    return this.packagingRepository.save({
      code,
      tsdId: activeTask.tsdId,
      task: activeTask.task,
    });
  }

  /**
   * Количество товаров в текущей открытой таре.
   */
  async getOpenProductCount(activeTask: ActiveTaskEntity): Promise<number> {
    switch (activeTask.aggregationLvl) {
      case 1:
        return this.packagingRepository.count({
          where: {
            tsdId: activeTask.tsdId,
            task: {
              id: activeTask.task.id,
            },
            palletLabel: IsNull(),
          },
        });

      case 2:
        return this.packagingRepository.count({
          where: {
            tsdId: activeTask.tsdId,
            task: {
              id: activeTask.task.id,
            },
            bigBoxLabel: IsNull(),
          },
        });

      case 3:
        return this.packagingRepository.count({
          where: {
            tsdId: activeTask.tsdId,
            task: {
              id: activeTask.task.id,
            },
            smallBoxLabel: IsNull(),
          },
        });

      default:
        throw new Error(
          `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
        );
    }
  }

  /**
   * Количество закрытых малых коробок
   * в текущей открытой большой коробке.
   *
   * Одна PackagingEntity = один товар.
   */
  async getClosedSmallBoxCount(activeTask: ActiveTaskEntity): Promise<number> {
    const recordsCount = await this.packagingRepository.count({
      where: {
        tsdId: activeTask.tsdId,
        task: {
          id: activeTask.task.id,
        },
        smallBoxLabel: Not(IsNull()),
        bigBoxLabel: IsNull(),
      },
    });

    return recordsCount / activeTask.piecesPerSmallBox;
  }

  /**
   * Количество закрытых больших коробок
   * на текущей открытой паллете.
   *
   * Одна PackagingEntity = один товар.
   */
  async getClosedBigBoxCount(activeTask: ActiveTaskEntity): Promise<number> {
    const recordsCount = await this.packagingRepository.count({
      where: {
        tsdId: activeTask.tsdId,
        task: {
          id: activeTask.task.id,
        },
        bigBoxLabel: Not(IsNull()),
        palletLabel: IsNull(),
      },
    });

    return (
      recordsCount / (activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox)
    );
  }

  /**
   * Закрывает текущую тару.
   */
  async setContainerLabel(
    activeTask: ActiveTaskEntity,
    containerType: ExpectedScanType,
    code: string,
  ): Promise<number> {
    const criteria = {
      tsdId: activeTask.tsdId,
      task: {
        id: activeTask.task.id,
      },
    };

    switch (containerType) {
      case ExpectedScanType.SMALL_BOX_LABEL: {
        const result = await this.packagingRepository.update(
          {
            ...criteria,
            smallBoxLabel: IsNull(),
          },
          {
            smallBoxLabel: code,
          },
        );

        return result.affected ?? 0;
      }

      case ExpectedScanType.BIG_BOX_LABEL: {
        const result = await this.packagingRepository.update(
          {
            ...criteria,
            bigBoxLabel: IsNull(),
          },
          {
            bigBoxLabel: code,
          },
        );

        return result.affected ?? 0;
      }

      case ExpectedScanType.PALLET_LABEL: {
        const result = await this.packagingRepository.update(
          {
            ...criteria,
            palletLabel: IsNull(),
          },
          {
            palletLabel: code,
          },
        );

        return result.affected ?? 0;
      }

      default:
        throw new Error(`Неподдерживаемый тип контейнера: ${containerType}`);
    }
  }
}
