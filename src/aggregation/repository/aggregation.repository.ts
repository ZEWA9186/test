import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { PackagingTableManager } from './packaging-table-manager.service';
import { AggregationLogger } from '../../logger-winston/winston.config';

export interface PackagingRecord {
  id: number;
  code: string;
  smallBoxLabel: string | null;
  bigBoxLabel: string | null;
  palletLabel: string | null;
  tsdId: number;
  createdAt: Date;
}

export interface ContainerFillStats {
  label: string;
  actualCount: number;
  expectedCount: number;
  isFull: boolean;
  isOverfilled: boolean;
  missingCount: number;
  productCodes: string[];
}

export interface TaskPackagingStats {
  totalRecords: number;
  isValid: boolean;

  productsWithoutPackaging: string[];
  smallBoxesWithoutBigBox: string[];
  bigBoxesWithoutPallet: string[];

  productsWithoutPackagingCount: number;
  smallBoxesWithoutBigBoxCount: number;
  bigBoxesWithoutPalletCount: number;

  smallBoxes: ContainerFillStats[];
  bigBoxes: ContainerFillStats[];
  pallets: ContainerFillStats[];
}

@Injectable()
export class AggregationRepository {
  constructor(
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,

    @InjectEntityManager()
    private readonly entityManager: EntityManager,

    private readonly packagingTableManager: PackagingTableManager,
  ) {}

  private getActiveTaskRepository(manager?: EntityManager): Repository<ActiveTaskEntity> {
    return manager ? manager.getRepository(ActiveTaskEntity) : this.activeTaskRepository;
  }

  private getManager(manager?: EntityManager): EntityManager {
    return manager ?? this.entityManager;
  }

  /** Возвращает проверенное имя таблицы текущей фасовки. */
  private getPackagingTable(activeTask: ActiveTaskEntity): string {
    if (!activeTask.packagingTableName) {
      throw new BadRequestException(`Для ТСД ${activeTask.tsdId} не указана таблица фасовки`);
    }

    return this.packagingTableManager.getQuotedTableName(activeTask.packagingTableName);
  }

  private mapPackagingRow(row: PackagingRecord | undefined): PackagingRecord | null {
    if (!row) {
      return null;
    }

    return {
      ...row,
      id: Number(row.id),
      tsdId: Number(row.tsdId),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }

  private async countRows(
    activeTask: ActiveTaskEntity,
    whereSql: string,
    parameters: unknown[],
    manager?: EntityManager,
  ): Promise<number> {
    const table = this.getPackagingTable(activeTask);
    const rows: Array<{ count: string | number }> = await this.getManager(manager).query(
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${whereSql}`,
      parameters,
    );

    return Number(rows[0]?.count ?? 0);
  }

  private async withOperationLogging<T>(
    activeTask: ActiveTaskEntity,
    operation: string,
    details: Record<string, unknown>,
    action: () => Promise<T>,
  ): Promise<T> {
    const context = {
      tsdId: activeTask.tsdId,
      taskId: activeTask.taskId,
      operation,
      ...details,
    };

    try {
      const result = await action();
      AggregationLogger.info('Операция агрегации выполнена', {
        ...context,
        ...(Array.isArray(result) ? { affectedCount: result.length } : {}),
      });
      return result;
    } catch (error) {
      AggregationLogger.error('Ошибка операции агрегации', {
        ...context,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    }
  }

  private logRepositoryError(
    operation: string,
    context: Record<string, unknown>,
    error: unknown,
  ): void {
    AggregationLogger.error('Ошибка в репозитории агрегации', {
      operation,
      ...context,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
  }

  async getActiveTask(tsdId: number, manager?: EntityManager): Promise<ActiveTaskEntity> {
    try {
      const activeTask = await this.getActiveTaskRepository(manager).findOne({
        where: { tsdId },
      });

      if (!activeTask || !activeTask.taskId) {
        throw new NotFoundException(`Для ТСД ${tsdId} нет активной задачи`);
      }

      return activeTask;
    } catch (error) {
      this.logRepositoryError('getActiveTask', { tsdId, taskId: null }, error);
      throw error;
    }
  }

  async saveActiveTask(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<ActiveTaskEntity> {
    try {
      return this.getActiveTaskRepository(manager).save(activeTask);
    } catch (error) {
      this.logRepositoryError(
        'saveActiveTask',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  async addProduct(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
    try {
      const table = this.getPackagingTable(activeTask);
      const rows: PackagingRecord[] = await this.getManager(manager).query(
        `
          INSERT INTO ${table} (code, tsd_id)
          VALUES ($1, $2)
          RETURNING
            id,
            code,
            small_box_label AS "smallBoxLabel",
            big_box_label AS "bigBoxLabel",
            pallet_label AS "palletLabel",
            tsd_id AS "tsdId",
            created_at AS "createdAt"
        `,
        [code, activeTask.tsdId],
      );

      const product = this.mapPackagingRow(rows[0]);
      if (!product) {
        throw new InternalServerErrorException('Не удалось добавить товар в фасовку');
      }

      return product;
    } catch (error) {
      this.logRepositoryError(
        'addProduct',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  /** Количество товаров в текущей открытой таре. */
  async getOpenProductCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    try {
      switch (activeTask.aggregationLvl) {
        case 1:
          return this.countRows(
            activeTask,
            'tsd_id = $1 AND pallet_label IS NULL',
            [activeTask.tsdId],
            manager,
          );

        case 2:
          return this.countRows(
            activeTask,
            'tsd_id = $1 AND big_box_label IS NULL',
            [activeTask.tsdId],
            manager,
          );

        case 3:
          return this.countRows(
            activeTask,
            'tsd_id = $1 AND small_box_label IS NULL',
            [activeTask.tsdId],
            manager,
          );

        default:
          throw new InternalServerErrorException(
            `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
          );
      }
    } catch (error) {
      this.logRepositoryError(
        'getOpenProductCount',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  /** Количество закрытых малых коробок, ещё не помещённых в большую коробку. */
  async getClosedSmallBoxCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    try {
      const recordsCount = await this.countRows(
        activeTask,
        'tsd_id = $1 AND small_box_label IS NOT NULL AND big_box_label IS NULL',
        [activeTask.tsdId],
        manager,
      );

      return recordsCount / activeTask.piecesPerSmallBox;
    } catch (error) {
      this.logRepositoryError(
        'getClosedSmallBoxCount',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  /** Количество закрытых больших коробок, ещё не помещённых на паллету. */
  async getClosedBigBoxCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    try {
      const productsPerBigBox =
        activeTask.aggregationLvl === 2
          ? activeTask.piecesPerBigBox
          : activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox;
      const recordsCount = await this.countRows(
        activeTask,
        'tsd_id = $1 AND big_box_label IS NOT NULL AND pallet_label IS NULL',
        [activeTask.tsdId],
        manager,
      );

      return recordsCount / productsPerBigBox;
    } catch (error) {
      this.logRepositoryError(
        'getClosedBigBoxCount',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  /** Закрывает текущую тару, присваивая этикетку товарам внутри неё. */
  async setContainerLabel(
    activeTask: ActiveTaskEntity,
    containerType: ExpectedScanType,
    code: string,
    manager?: EntityManager,
  ): Promise<number> {
    try {
      const table = this.getPackagingTable(activeTask);
      const em = this.getManager(manager);

      const existsRows: Array<{ exists: boolean }> = await em.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM ${table}
            WHERE small_box_label = $1
               OR big_box_label = $1
               OR pallet_label = $1
          ) AS "exists"
        `,
        [code],
      );

      if (existsRows[0]?.exists === true) {
        throw new BadRequestException(`Этикетка ${code} уже зарегистрирована в фасовке`);
      }

      let column: string;
      switch (containerType) {
        case ExpectedScanType.SMALL_BOX_LABEL:
          column = 'small_box_label';
          break;
        case ExpectedScanType.BIG_BOX_LABEL:
          column = 'big_box_label';
          break;
        case ExpectedScanType.PALLET_LABEL:
          column = 'pallet_label';
          break;
        default:
          throw new BadRequestException(`Неподдерживаемый тип контейнера: ${containerType}`);
      }

      // column выбирается только из фиксированного списка выше.
      const updatedRows: Array<{ updated: number }> = await em.query(
        `
          UPDATE ${table}
          SET ${column} = $1
          WHERE tsd_id = $2
            AND ${column} IS NULL
          RETURNING 1 AS updated
        `,
        [code, activeTask.tsdId],
      );

      return updatedRows.length;
    } catch (error) {
      this.logRepositoryError(
        'setContainerLabel',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  async deleteProduct(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<string> {
    return this.withOperationLogging(activeTask, 'deleteProduct', { code }, async () => {
      const table = this.getPackagingTable(activeTask);
      const rows: Array<{ code: string }> = await this.getManager(manager).query(
        `DELETE FROM ${table} WHERE code = $1 RETURNING code`,
        [code],
      );

      if (!rows.length) {
        throw new NotFoundException(`Код ${code} не найден`);
      }

      return rows[0].code;
    });
  }

  async deletePackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    manager?: EntityManager,
  ): Promise<string[]> {
    return this.withOperationLogging(activeTask, 'deletePackage', { packageLabel }, async () => {
      const table = this.getPackagingTable(activeTask);
      const rows: Array<{ code: string }> = await this.getManager(manager).query(
        `
          DELETE FROM ${table}
          WHERE small_box_label = $1
             OR big_box_label = $1
             OR pallet_label = $1
            RETURNING code
        `,
        [packageLabel],
      );

      if (!rows.length) {
        throw new NotFoundException(`Упаковка ${packageLabel} не найдена`);
      }

      return rows.map((row) => row.code);
    });
  }

  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
    return this.withOperationLogging(
      activeTask,
      'addProductIntoPackage',
      { code, packageLabel, packageType },
      async () => {
        const table = this.getPackagingTable(activeTask);
        const em = this.getManager(manager);

        let column: string;
        switch (packageType) {
          case ExpectedScanType.SMALL_BOX_LABEL:
            column = 'small_box_label';
            break;
          case ExpectedScanType.BIG_BOX_LABEL:
            column = 'big_box_label';
            break;
          case ExpectedScanType.PALLET_LABEL:
            column = 'pallet_label';
            break;
          default:
            throw new BadRequestException(`Неизвестный тип тары: ${packageType}`);
        }

        const packageRows: Array<{
          smallBoxLabel: string | null;
          bigBoxLabel: string | null;
          palletLabel: string | null;
        }> = await em.query(
          `
          SELECT
            small_box_label AS "smallBoxLabel",
            big_box_label AS "bigBoxLabel",
            pallet_label AS "palletLabel"
          FROM ${table}
          WHERE ${column} = $1
          LIMIT 1
        `,
          [packageLabel],
        );

        const existingPackage = packageRows[0];
        if (!existingPackage) {
          throw new NotFoundException(`Тара ${packageLabel} не найдена в текущей задаче`);
        }

        const insertedRows: PackagingRecord[] = await em.query(
          `
          INSERT INTO ${table} (
            code,
            tsd_id,
            small_box_label,
            big_box_label,
            pallet_label
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            code,
            small_box_label AS "smallBoxLabel",
            big_box_label AS "bigBoxLabel",
            pallet_label AS "palletLabel",
            tsd_id AS "tsdId",
            created_at AS "createdAt"
        `,
          [
            code,
            activeTask.tsdId,
            existingPackage.smallBoxLabel,
            existingPackage.bigBoxLabel,
            existingPackage.palletLabel,
          ],
        );

        const inserted = this.mapPackagingRow(insertedRows[0]);
        if (!inserted) {
          throw new InternalServerErrorException('Не удалось добавить товар в упаковку');
        }

        return inserted;
      },
    );
  }

  async countProductsInPackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    manager?: EntityManager,
  ): Promise<number> {
    try {
      return this.countRows(
        activeTask,
        '(small_box_label = $1 OR big_box_label = $1 OR pallet_label = $1)',
        [packageLabel],
        manager,
      );
    } catch (error) {
      this.logRepositoryError(
        'countProductsInPackage',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  async searchProductInfo(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
    try {
      const table = this.getPackagingTable(activeTask);
      const rows: PackagingRecord[] = await this.getManager(manager).query(
        `
          SELECT
            id,
            code,
            small_box_label AS "smallBoxLabel",
            big_box_label AS "bigBoxLabel",
            pallet_label AS "palletLabel",
            tsd_id AS "tsdId",
            created_at AS "createdAt"
          FROM ${table}
          WHERE code = $1
          LIMIT 1
        `,
        [code],
      );

      const product = this.mapPackagingRow(rows[0]);
      if (!product) {
        throw new NotFoundException('Товар не найден в текущей агрегации');
      }

      return product;
    } catch (error) {
      this.logRepositoryError(
        'searchProductInfo',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  async searchPackageInfo(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
    try {
      const table = this.getPackagingTable(activeTask);
      const em = this.getManager(manager);

      let column: string;
      switch (scanType) {
        case ExpectedScanType.SMALL_BOX_LABEL:
          column = 'small_box_label';
          break;
        case ExpectedScanType.BIG_BOX_LABEL:
          column = 'big_box_label';
          break;
        case ExpectedScanType.PALLET_LABEL:
          column = 'pallet_label';
          break;
        default:
          throw new BadRequestException('Передан код не контейнера');
      }

      const rows: PackagingRecord[] = await em.query(
        `
        SELECT
          id,
          code,
          small_box_label AS "smallBoxLabel",
          big_box_label AS "bigBoxLabel",
          pallet_label AS "palletLabel",
          tsd_id AS "tsdId",
          created_at AS "createdAt"
        FROM ${table}
        WHERE ${column} = $1
        LIMIT 1
      `,
        [packageLabel],
      );

      const packaging = this.mapPackagingRow(rows[0]);
      if (!packaging) {
        throw new NotFoundException('Упаковка не найдена в текущей агрегации');
      }

      return packaging;
    } catch (error) {
      this.logRepositoryError(
        'searchPackageInfo',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }

  async moveBox(
    boxLabel: string,
    palletLabel: string,
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<void> {
    return this.withOperationLogging(activeTask, 'moveBox', { boxLabel, palletLabel }, async () => {
      const table = this.getPackagingTable(activeTask);
      await this.getManager(manager).query(
        `UPDATE ${table} SET pallet_label = $1 WHERE big_box_label = $2`,
        [palletLabel, boxLabel],
      );
    });
  }

  async countPackageContents(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<number> {
    try {
      let column: string;
      switch (scanType) {
        case ExpectedScanType.SMALL_BOX_LABEL:
          column = 'small_box_label';
          break;
        case ExpectedScanType.BIG_BOX_LABEL:
          column = 'big_box_label';
          break;
        case ExpectedScanType.PALLET_LABEL:
          column = 'pallet_label';
          break;
        default:
          throw new BadRequestException('Невозможно посчитать содержимое упаковки');
      }

      const recordsCount = await this.countRows(
        activeTask,
        `${column} = $1`,
        [packageLabel],
        manager,
      );

      switch (scanType) {
        case ExpectedScanType.SMALL_BOX_LABEL:
          return recordsCount;

        case ExpectedScanType.BIG_BOX_LABEL:
          if (activeTask.aggregationLvl === 3) {
            return recordsCount / activeTask.piecesPerSmallBox;
          }
          return recordsCount;

        case ExpectedScanType.PALLET_LABEL:
          switch (activeTask.aggregationLvl) {
            case 1:
              return recordsCount;
            case 2:
              return recordsCount / activeTask.piecesPerBigBox;
            case 3:
              return recordsCount / (activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox);
            default:
              throw new InternalServerErrorException(
                `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
              );
          }
        default:
          throw new InternalServerErrorException(`Неизвестный тип контейнера: ${scanType}`);
      }
    } catch (error) {
      this.logRepositoryError(
        'countPackageContents',
        { tsdId: activeTask.tsdId, taskId: activeTask.taskId },
        error,
      );
      throw error;
    }
  }
  async getTaskPackagingStats(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<TaskPackagingStats> {
    const currentManager = this.getManager(manager);
    const table = this.getPackagingTable(activeTask);

    const rows: {
      code: string;
      small_box_label: string | null;
      big_box_label: string | null;
      pallet_label: string | null;
    }[] = await currentManager.query(
      `
      SELECT
        code,
        small_box_label,
        big_box_label,
        pallet_label
      FROM ${table}
      ORDER BY id
    `,
    );

    const aggregationLvl = Number(activeTask.aggregationLvl);

    const productsWithoutPackaging: string[] = [];
    const smallBoxesWithoutBigBox = new Set<string>();
    const bigBoxesWithoutPallet = new Set<string>();

    const smallBoxes = new Map<string, typeof rows>();
    const bigBoxes = new Map<string, typeof rows>();
    const pallets = new Map<string, typeof rows>();

    const addToGroup = (
      groups: Map<string, typeof rows>,
      label: string | null,
      row: (typeof rows)[number],
    ): void => {
      if (!label) {
        return;
      }

      const group = groups.get(label) ?? [];
      group.push(row);
      groups.set(label, group);
    };

    for (const row of rows) {
      switch (aggregationLvl) {
        case 1:
          if (!row.pallet_label) {
            productsWithoutPackaging.push(row.code);
          }
          break;

        case 2:
          if (!row.big_box_label) {
            productsWithoutPackaging.push(row.code);
          }

          if (row.big_box_label && !row.pallet_label) {
            bigBoxesWithoutPallet.add(row.big_box_label);
          }
          break;

        case 3:
          if (!row.small_box_label) {
            productsWithoutPackaging.push(row.code);
          }

          if (row.small_box_label && !row.big_box_label) {
            smallBoxesWithoutBigBox.add(row.small_box_label);
          }

          if (row.big_box_label && !row.pallet_label) {
            bigBoxesWithoutPallet.add(row.big_box_label);
          }
          break;

        default:
          throw new Error(`Unsupported aggregation level: ${aggregationLvl}`);
      }

      addToGroup(smallBoxes, row.small_box_label, row);
      addToGroup(bigBoxes, row.big_box_label, row);
      addToGroup(pallets, row.pallet_label, row);
    }

    const toFillStats = (
      groups: Map<string, typeof rows>,
      expectedCount: number,
      childLabel: 'product' | 'smallBox' | 'bigBox',
    ): ContainerFillStats[] => {
      return Array.from(groups.entries()).map(([label, groupRows]) => {
        let actualCount: number;
        let productCodes: string[];

        switch (childLabel) {
          case 'product':
            actualCount = groupRows.length;
            productCodes = groupRows.map((row) => row.code);
            break;

          case 'smallBox': {
            const childLabels = new Set(
              groupRows
                .map((row) => row.small_box_label)
                .filter((value): value is string => value !== null),
            );

            actualCount = childLabels.size;
            productCodes = groupRows.map((row) => row.code);
            break;
          }

          case 'bigBox': {
            const childLabels = new Set(
              groupRows
                .map((row) => row.big_box_label)
                .filter((value): value is string => value !== null),
            );

            actualCount = childLabels.size;
            productCodes = groupRows.map((row) => row.code);
            break;
          }
        }

        return {
          label,
          actualCount,
          expectedCount,
          isFull: actualCount === expectedCount,
          isOverfilled: actualCount > expectedCount,
          missingCount: Math.max(expectedCount - actualCount, 0),
          productCodes,
        };
      });
    };

    const smallBoxStats =
      aggregationLvl === 3 ? toFillStats(smallBoxes, activeTask.piecesPerSmallBox, 'product') : [];

    const bigBoxStats =
      aggregationLvl === 2
        ? toFillStats(bigBoxes, activeTask.piecesPerBigBox, 'product')
        : aggregationLvl === 3
          ? toFillStats(bigBoxes, activeTask.piecesPerBigBox, 'smallBox')
          : [];

    const palletStats =
      aggregationLvl === 1
        ? toFillStats(pallets, activeTask.piecesPerPallet, 'product')
        : toFillStats(pallets, activeTask.piecesPerPallet, 'bigBox');

    const allContainers = [...smallBoxStats, ...bigBoxStats, ...palletStats];

    const isValid =
      productsWithoutPackaging.length === 0 &&
      smallBoxesWithoutBigBox.size === 0 &&
      bigBoxesWithoutPallet.size === 0 &&
      allContainers.every((container) => container.isFull && !container.isOverfilled);

    return {
      totalRecords: rows.length,
      isValid,

      productsWithoutPackaging,
      smallBoxesWithoutBigBox: Array.from(smallBoxesWithoutBigBox),
      bigBoxesWithoutPallet: Array.from(bigBoxesWithoutPallet),

      productsWithoutPackagingCount: productsWithoutPackaging.length,
      smallBoxesWithoutBigBoxCount: smallBoxesWithoutBigBox.size,
      bigBoxesWithoutPalletCount: bigBoxesWithoutPallet.size,

      smallBoxes:
        aggregationLvl === 3
          ? toFillStats(smallBoxes, activeTask.piecesPerSmallBox, 'product')
          : [],

      bigBoxes:
        aggregationLvl === 2
          ? toFillStats(bigBoxes, activeTask.piecesPerBigBox, 'product')
          : aggregationLvl === 3
            ? toFillStats(bigBoxes, activeTask.piecesPerBigBox, 'smallBox')
            : [],

      pallets:
        aggregationLvl === 1
          ? toFillStats(pallets, activeTask.piecesPerPallet, 'product')
          : toFillStats(pallets, activeTask.piecesPerPallet, 'bigBox'),
    };
  }
}
