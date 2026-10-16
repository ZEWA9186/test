import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TaskEntity } from '../task/entities/task.entity';
import { TaskCodesEntity } from '../task/entities/task-codes.entity';
import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';
import { PackagingEntity } from '../aggregation/entities/packaging.entity';
import {
  AggregationRepository,
  TaskPackagingStats,
} from '../aggregation/repository/aggregation.repository';

import { TaskHistoryEntity } from './entity/task-history.entity';
import { TaskHistoryPackagingEntity } from './entity/task-history-packaging.entity';

@Injectable()
export class TaskHistoryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly aggregationRepository: AggregationRepository,
  ) {}

  /**
   * Проверяет полноту агрегации.
   * Не изменяет данные и не закрывает задание.
   */
  async validateTask(taskId: number): Promise<void> {
    const task = await this.dataSource.getRepository(TaskEntity).findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Задание ${taskId} не найдено`);
    }

    const stats = await this.aggregationRepository.getTaskPackagingStats(taskId);

    this.validatePackaging(task, stats);
  }

  /**
   * Принудительно архивирует задание, даже если агрегация незавершена.
   *
   * Архивирование и удаление исходных данных выполняются
   * в одной транзакции PostgreSQL.
   */
  async archiveTask(taskId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const codesRepository = manager.getRepository(TaskCodesEntity);
      const packagingRepository = manager.getRepository(PackagingEntity);
      const activeTaskRepository = manager.getRepository(ActiveTaskEntity);
      const historyRepository = manager.getRepository(TaskHistoryEntity);
      const historyPackagingRepository = manager.getRepository(TaskHistoryPackagingEntity);

      // Сначала проверяем, не архивировали ли задание ранее.
      if (await historyRepository.exists({ where: { id: taskId } })) {
        throw new ConflictException(`Задание ${taskId} уже присутствует в архиве`);
      }

      const task = await taskRepository.findOne({
        where: { id: taskId },
      });

      if (!task) {
        throw new NotFoundException(`Задание ${taskId} не найдено`);
      }

      const packagingRecords = await packagingRepository.find({
        where: {
          task: { id: taskId },
        },
        order: {
          id: 'ASC',
        },
      });

      // Вычисляем неиспользованные коды средствами PostgreSQL.
      const unusedCodeRows: Array<{ code: string }> = await manager.query(
        `
          SELECT tc.code
          FROM task_codes tc
          WHERE tc.task_id = $1
            AND NOT EXISTS (
            SELECT 1
            FROM packaging p
            WHERE p.task_id = $1
              AND p.code = tc.code
          )
          ORDER BY tc.code
        `,
        [taskId],
      );

      const unusedCodes = unusedCodeRows.map((row) => row.code);

      const dateManufacture = this.normalizeDate(task.dateManufacture);

      // Основные параметры хранятся отдельными колонками.
      // Остальные параметры задания сохраняются в JSONB.
      const taskSnapshot: Record<string, unknown> = {
        ...task,
      };

      for (const key of [
        'id',
        'dateManufacture',
        'batch',
        'gtin',
        'name',
        'codes',
        'activeTasks',
        'packages',
        'tsdIds',
      ]) {
        delete taskSnapshot[key];
      }

      const history = await historyRepository.save({
        id: task.id,
        dateManufacture,
        batch: task.batch ?? null,
        gtin: task.gtin ?? null,
        name: task.name ?? null,
        taskSnapshot,
        unusedCodes,
      });

      // Сохраняем все упаковки, в том числе незакрытые.
      if (packagingRecords.length > 0) {
        const historyRecords = packagingRecords.map((record) => {
          const historyRecord = new TaskHistoryPackagingEntity();

          historyRecord.id = record.id;
          historyRecord.history = history;
          historyRecord.code = record.code;
          historyRecord.smallBoxLabel = record.smallBoxLabel;
          historyRecord.bigBoxLabel = record.bigBoxLabel;
          historyRecord.palletLabel = record.palletLabel;
          historyRecord.tsdId = record.tsdId;
          historyRecord.createdAt = record.createdAt;

          return historyRecord;
        });

        await historyPackagingRepository.save(historyRecords);
      }

      // Архив успешно сохранён. Удаляем рабочие данные.
      await activeTaskRepository
        .createQueryBuilder()
        .delete()
        .from(ActiveTaskEntity)
        .where('task_id = :taskId', { taskId })
        .execute();

      await codesRepository
        .createQueryBuilder()
        .delete()
        .from(TaskCodesEntity)
        .where('task_id = :taskId', { taskId })
        .execute();

      await packagingRepository
        .createQueryBuilder()
        .delete()
        .from(PackagingEntity)
        .where('task_id = :taskId', { taskId })
        .execute();

      await taskRepository.delete(taskId);
    });
  }

  /**
   * Проверяет все упаковки задания на основе статистики репозитория.
   * Расчёты выполняются по taskId, без разделения по ТСД.
   */
  private validatePackaging(task: TaskEntity, stats: TaskPackagingStats): void {
    const level = task.aggregationLvl;

    if (![1, 2, 3].includes(level)) {
      throw new BadRequestException(`Неизвестный уровень агрегации задания: ${level}`);
    }

    // Задание может содержать только неиспользованные коды.
    if (stats.totalRecords === 0) {
      return;
    }

    switch (level) {
      case 1:
        this.validateLevel1(task, stats);
        break;

      case 2:
        this.validateLevel2(task, stats);
        break;

      case 3:
        this.validateLevel3(task, stats);
        break;
    }
  }

  /**
   * Уровень 1: товар -> паллета.
   */
  private validateLevel1(task: TaskEntity, stats: TaskPackagingStats): void {
    this.assertZero(stats.withSmallBox, 'Обнаружены малые коробки на уровне 1');

    this.assertZero(stats.withBigBox, 'Обнаружены большие коробки на уровне 1');

    this.assertZero(stats.withoutPallet, 'Есть товары без этикетки паллеты');

    const productsPerPallet = this.getRequiredCount(
      task.piecesPerPallet,
      'Количество товаров на паллете',
    );

    for (const pallet of stats.pallets) {
      this.assertCount(
        pallet.productsCount,
        productsPerPallet,
        `Паллета ${pallet.label}: количество товаров`,
      );
    }
  }

  /**
   * Уровень 2: товар -> большая коробка -> паллета.
   */
  private validateLevel2(task: TaskEntity, stats: TaskPackagingStats): void {
    this.assertZero(stats.withSmallBox, 'Обнаружены малые коробки на уровне 2');

    this.assertZero(stats.withoutBigBox, 'Есть товары без этикетки большой коробки');

    this.assertZero(stats.withoutPallet, 'Есть товары без этикетки паллеты');

    const productsPerBigBox = this.getRequiredCount(
      task.piecesPerBigBox,
      'Количество товаров в большой коробке',
    );

    for (const box of stats.bigBoxes) {
      this.assertCount(
        box.productsCount,
        productsPerBigBox,
        `Большая коробка ${box.label}: количество товаров`,
      );

      this.assertCount(box.palletsCount, 1, `Большая коробка ${box.label}: количество паллет`);

      if (box.hasMissingPallet) {
        throw new BadRequestException(
          `Большая коробка ${box.label} размещена на паллете не полностью`,
        );
      }
    }

    this.validatePallets(stats, task.piecesPerPallet);
  }

  /**
   * Уровень 3: товар -> малая коробка -> большая коробка -> паллета.
   */
  private validateLevel3(task: TaskEntity, stats: TaskPackagingStats): void {
    this.assertZero(stats.withoutSmallBox, 'Есть товары без этикетки малой коробки');

    this.assertZero(stats.withoutBigBox, 'Есть товары без этикетки большой коробки');

    this.assertZero(stats.withoutPallet, 'Есть товары без этикетки паллеты');

    const productsPerSmallBox = this.getRequiredCount(
      task.piecesPerSmallBox,
      'Количество товаров в малой коробке',
    );

    for (const box of stats.smallBoxes) {
      this.assertCount(
        box.productsCount,
        productsPerSmallBox,
        `Малая коробка ${box.label}: количество товаров`,
      );

      this.assertCount(
        box.parentCount,
        1,
        `Малая коробка ${box.label}: количество больших коробок`,
      );

      if (box.hasMissingParent) {
        throw new BadRequestException(
          `Малая коробка ${box.label} размещена в большой коробке не полностью`,
        );
      }
    }

    // На уровне 3 piecesPerBigBox — количество малых коробок.
    const smallBoxesPerBigBox = this.getRequiredCount(
      task.piecesPerBigBox,
      'Количество малых коробок в большой коробке',
    );

    for (const box of stats.bigBoxes) {
      this.assertCount(
        box.smallBoxesCount,
        smallBoxesPerBigBox,
        `Большая коробка ${box.label}: количество малых коробок`,
      );

      this.assertCount(box.palletsCount, 1, `Большая коробка ${box.label}: количество паллет`);

      if (box.hasMissingPallet) {
        throw new BadRequestException(
          `Большая коробка ${box.label} размещена на паллете не полностью`,
        );
      }
    }

    this.validatePallets(stats, task.piecesPerPallet);
  }

  /**
   * На уровнях 2 и 3 паллета содержит большие коробки.
   */
  private validatePallets(stats: TaskPackagingStats, configuredCount: number | null): void {
    const bigBoxesPerPallet = this.getRequiredCount(
      configuredCount,
      'Количество больших коробок на паллете',
    );

    for (const pallet of stats.pallets) {
      this.assertCount(
        pallet.bigBoxesCount,
        bigBoxesPerPallet,
        `Паллета ${pallet.label}: количество больших коробок`,
      );
    }
  }

  private assertZero(actual: number, message: string): void {
    if (actual !== 0) {
      throw new BadRequestException(`${message}: ${actual}`);
    }
  }

  private getRequiredCount(value: number | null, description: string): number {
    const count = Number(value);

    if (!Number.isInteger(count) || count <= 0) {
      throw new BadRequestException(`${description} должно быть положительным целым числом`);
    }

    return count;
  }

  private assertCount(actual: number, expected: number, description: string): void {
    if (actual !== expected) {
      throw new BadRequestException(`${description}: ожидается ${expected}, фактически ${actual}`);
    }
  }

  /**
   * Преобразует дату в YYYY-MM-DD для SQL DATE.
   * Поддерживает YYYY-MM-DD и DD.MM.YYYY.
   */
  private normalizeDate(value: string | null | undefined): string | null {
    if (!value?.trim()) {
      return null;
    }

    const input = value.trim();
    let year: number;
    let month: number;
    let day: number;

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      [year, month, day] = input.split('-').map(Number);
    } else {
      const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);

      if (!match) {
        throw new BadRequestException(`Некорректная дата изготовления: "${value}"`);
      }

      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`Некорректная дата изготовления: "${value}"`);
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
