import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull, Not } from 'typeorm';
import { ActiveTaskEntity, ExpectedScanType } from './entities/active-task.entity';
import { PackagingEntity } from './entities/packaging.entity';

@Injectable()
export class AggregationService {
  constructor(private readonly dataSource: DataSource) {}

  async processScan(tsdId: number, code: string): Promise<ActiveTaskEntity> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Блокируем сессию ТСД под транзакцию
      const activeTask = await manager.findOne(ActiveTaskEntity, {
        where: { tsdId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activeTask) {
        throw new NotFoundException(
          `Активная сессия для ТСД #${tsdId} не найдена`,
        );
      }

      // 2. Вычисляем динамический pipeline и лимиты для этой сессии
      const { pipeline, limits } = this.resolvePipelineAndLimits(activeTask);

      // 3. Главный FSM переключатель
      if (activeTask.expectedScan === ExpectedScanType.PRODUCT) {
        // ─── СКАН ТОВАРА ─────────────────────────────────────────────
        const isOneLevelNoAggregation = pipeline.length === 1;

        if (isOneLevelNoAggregation) {
          // 1 уровень без агрегации: просто сохраняем штукный скан
          await manager.save(PackagingEntity, {
            activeTask: { tsdId },
            code,
          });
          return activeTask; // Остаемся в PRODUCT
        }

        // 2 или 3 уровня: определяем первого родителя
        const parentStep = pipeline[1];
        const parentCol = this.mapStepToColumn(parentStep);

        await manager.save(PackagingEntity, {
          activeTask: { tsdId },
          code,
          [parentCol]: null,
        });

        // Считаем объем накопившегося "хвоста" штук без родительской коробки
        const unassignedProducts = await manager.count(PackagingEntity, {
          where: {
            activeTask: { tsdId },
            [parentCol]: IsNull(),
          },
        });

        // Если набрали лимит — ждем этикетку коробки/паллеты
        const limit = limits[ExpectedScanType.PRODUCT] || 0;
        if (limit > 0 && unassignedProducts >= limit) {
          activeTask.expectedScan = parentStep;
        }
      } else {
        // ─── СКАН ЭТИКЕТКИ ТАРЫ (Малая / Большая коробка / Паллета) ───
        const currentStep = activeTask.expectedScan;
        const currentCol = this.mapStepToColumn(currentStep);

        // Динамически строим условие закрытия "хвоста"
        const currentIndex = pipeline.indexOf(currentStep);
        const previousStep = pipeline[currentIndex - 1];

        const where: Record<string, any> = {
          activeTask: { tsdId },
          [currentCol]: IsNull(),
        };

        // Если закрываем не товар, а вложенную коробку — проверяем, что она запечатана
        if (previousStep !== ExpectedScanType.PRODUCT) {
          where[this.mapStepToColumn(previousStep)] = Not(IsNull());
        }

        // Привязываем отсканированную этикетку ко всему текущему хвосту
        await manager.update(PackagingEntity, where, { [currentCol]: code });

        // Проверяем каскад на уровень выше (например, заполнилась ли большая коробка или паллета)
        const nextStepIdx = currentIndex + 1;
        if (nextStepIdx < pipeline.length) {
          const nextStep = pipeline[nextStepIdx];
          const nextCol = this.mapStepToColumn(nextStep);

          const res = await manager
            .createQueryBuilder(PackagingEntity, 'p')
            .select(`COUNT(DISTINCT p.${currentCol})`, 'cnt')
            .where(
              `p.tsd_id = :tsdId AND p.${currentCol} IS NOT NULL AND p.${nextCol} IS NULL`,
              { tsdId },
            )
            .getRawOne();

          const count = parseInt(res?.cnt || '0', 10);
          const limit = limits[currentStep] || 0;

          if (limit > 0 && count >= limit) {
            activeTask.expectedScan = nextStep; // Переходим на уровень выше
            await manager.save(ActiveTaskEntity, activeTask);
            return activeTask;
          }
        }

        // Возвращаемся к сбору товаров
        activeTask.expectedScan = pipeline[0]; // ExpectedScanType.PRODUCT
      }

      await manager.save(ActiveTaskEntity, activeTask);
      return activeTask;
    });
  }

  // ─── ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ──────────────────────────────────────────

  private resolvePipelineAndLimits(task: ActiveTaskEntity) {
    const {
      aggregationLvl,
      piecesPerSmallBox,
      piecesPerBigBox,
      piecesPerPallet,
    } = task;

    const pipeline: ExpectedScanType[] = [ExpectedScanType.PRODUCT];
    const limits: Partial<Record<ExpectedScanType, number>> = {};

    if (aggregationLvl === 1) {
      if (piecesPerPallet && piecesPerPallet > 0) {
        pipeline.push(ExpectedScanType.PALLET_LABEL);
        limits[ExpectedScanType.PRODUCT] = piecesPerPallet;
      }
    } else if (aggregationLvl === 2) {
      pipeline.push(ExpectedScanType.BIG_BOX_LABEL);
      limits[ExpectedScanType.PRODUCT] = piecesPerBigBox || 0;

      if (piecesPerPallet && piecesPerBigBox && piecesPerBigBox > 0) {
        pipeline.push(ExpectedScanType.PALLET_LABEL);
        limits[ExpectedScanType.BIG_BOX_LABEL] = Math.floor(
          piecesPerPallet / piecesPerBigBox,
        );
      }
    } else if (aggregationLvl >= 3) {
      pipeline.push(
        ExpectedScanType.SMALL_BOX_LABEL,
        ExpectedScanType.BIG_BOX_LABEL,
      );
      limits[ExpectedScanType.PRODUCT] = piecesPerSmallBox || 0;

      if (piecesPerBigBox && piecesPerSmallBox && piecesPerSmallBox > 0) {
        limits[ExpectedScanType.SMALL_BOX_LABEL] = Math.floor(
          piecesPerBigBox / piecesPerSmallBox,
        );
      }
      if (piecesPerPallet && piecesPerBigBox && piecesPerBigBox > 0) {
        pipeline.push(ExpectedScanType.PALLET_LABEL);
        limits[ExpectedScanType.BIG_BOX_LABEL] = Math.floor(
          piecesPerPallet / piecesPerBigBox,
        );
      }
    }

    return { pipeline, limits };
  }

  private mapStepToColumn(step: ExpectedScanType): keyof PackagingEntity {
    switch (step) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        return 'smallBoxLabel';
      case ExpectedScanType.BIG_BOX_LABEL:
        return 'bigBoxLabel';
      case ExpectedScanType.PALLET_LABEL:
        return 'palletLabel';
      default:
        throw new BadRequestException(`Невалидный шаг упаковки: ${step}`);
    }
  }
}
