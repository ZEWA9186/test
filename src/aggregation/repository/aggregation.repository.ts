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

export interface PackagingRecord {
  id: number;
  code: string;
  smallBoxLabel: string | null;
  bigBoxLabel: string | null;
  palletLabel: string | null;
  tsdId: number;
  createdAt: Date;
}

export interface TaskSmallBoxStats {
  label: string;
  productsCount: number;
  parentCount: number;
  hasMissingParent: boolean;
  productCodes: string[];
  parentCodes: string[];
  missingParentCodes: string[];
}

export interface TaskBigBoxStats {
  label: string;
  productsCount: number;
  smallBoxesCount: number;
  palletsCount: number;
  hasMissingPallet: boolean;
  productCodes: string[];
  smallBoxesCodes: string[];
  palletCodes: string[];
  missingPalletCodes: string[];
}

export interface TaskPalletStats {
  label: string;
  productsCount: number;
  bigBoxesCount: number;
  productCodes: string[];
  bigBoxesCodes: string[];
}

export interface TaskPackagingStats {
  totalRecords: number;
  withoutSmallBox: number;
  withoutBigBox: number;
  withoutPallet: number;
  withSmallBox: number;
  withBigBox: number;
  withPallet: number;
  withoutSmallBoxCodes: string[];
  withoutBigBoxCodes: string[];
  withoutPalletCodes: string[];
  smallBoxes: TaskSmallBoxStats[];
  bigBoxes: TaskBigBoxStats[];
  pallets: TaskPalletStats[];
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

  async getActiveTask(tsdId: number, manager?: EntityManager): Promise<ActiveTaskEntity> {
    const activeTask = await this.getActiveTaskRepository(manager).findOne({
      where: { tsdId },
    });

    if (!activeTask || !activeTask.taskId) {
      throw new NotFoundException(`Для ТСД ${tsdId} нет активной задачи`);
    }

    return activeTask;
  }

  async saveActiveTask(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<ActiveTaskEntity> {
    return this.getActiveTaskRepository(manager).save(activeTask);
  }

  async addProduct(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
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
  }

  /** Количество товаров в текущей открытой таре. */
  async getOpenProductCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
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
  }

  /** Количество закрытых малых коробок, ещё не помещённых в большую коробку. */
  async getClosedSmallBoxCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    this.validatePositiveCount(activeTask.piecesPerSmallBox, 'piecesPerSmallBox');

    const recordsCount = await this.countRows(
      activeTask,
      'tsd_id = $1 AND small_box_label IS NOT NULL AND big_box_label IS NULL',
      [activeTask.tsdId],
      manager,
    );

    return recordsCount / activeTask.piecesPerSmallBox;
  }

  /** Количество закрытых больших коробок, ещё не помещённых на паллету. */
  async getClosedBigBoxCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    const productsPerBigBox =
      activeTask.aggregationLvl === 2
        ? activeTask.piecesPerBigBox
        : activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox;

    this.validatePositiveCount(productsPerBigBox, 'число товаров в большой коробке');

    const recordsCount = await this.countRows(
      activeTask,
      'tsd_id = $1 AND big_box_label IS NOT NULL AND pallet_label IS NULL',
      [activeTask.tsdId],
      manager,
    );

    return recordsCount / productsPerBigBox;
  }

  /** Закрывает текущую тару, присваивая этикетку товарам внутри неё. */
  async setContainerLabel(
    activeTask: ActiveTaskEntity,
    containerType: ExpectedScanType,
    code: string,
    manager?: EntityManager,
  ): Promise<number> {
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
  }

  async deleteProduct(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<string> {
    const table = this.getPackagingTable(activeTask);
    const rows: Array<{ code: string }> = await this.getManager(manager).query(
      `DELETE FROM ${table} WHERE code = $1 RETURNING code`,
      [code],
    );

    if (!rows.length) {
      throw new NotFoundException(`Код ${code} не найден`);
    }

    return rows[0].code;
  }

  async deletePackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    manager?: EntityManager,
  ): Promise<string[]> {
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
  }

  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
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
  }

  async countProductsInPackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.countRows(
      activeTask,
      '(small_box_label = $1 OR big_box_label = $1 OR pallet_label = $1)',
      [packageLabel],
      manager,
    );
  }

  async searchProductInfo(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
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
  }

  async searchPackageInfo(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
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
  }

  async moveBox(
    boxLabel: string,
    palletLabel: string,
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<void> {
    const table = this.getPackagingTable(activeTask);
    await this.getManager(manager).query(
      `UPDATE ${table} SET pallet_label = $1 WHERE big_box_label = $2`,
      [palletLabel, boxLabel],
    );
  }

  async countPackageContents(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<number> {
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
          this.validatePositiveCount(activeTask.piecesPerSmallBox, 'piecesPerSmallBox');
          return recordsCount / activeTask.piecesPerSmallBox;
        }
        return recordsCount;

      case ExpectedScanType.PALLET_LABEL:
        switch (activeTask.aggregationLvl) {
          case 1:
            return recordsCount;
          case 2:
            this.validatePositiveCount(activeTask.piecesPerBigBox, 'piecesPerBigBox');
            return recordsCount / activeTask.piecesPerBigBox;
          case 3:
            this.validatePositiveCount(
              activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox,
              'число товаров на паллете',
            );
            return recordsCount / (activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox);
          default:
            throw new InternalServerErrorException(
              `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
            );
        }
      default:
        throw new InternalServerErrorException(`Неизвестный тип контейнера: ${scanType}`);
    }
  }

  /** Статистика по динамической таблице задания. */
  async getTaskPackagingStats(
    taskId: number,
    manager?: EntityManager,
  ): Promise<TaskPackagingStats> {
    const em = this.getManager(manager);
    const taskRows: Array<{ packagingTableName: string | null }> = await em.query(
      `SELECT packaging_table_name AS "packagingTableName" FROM tasks WHERE id = $1 LIMIT 1`,
      [taskId],
    );

    if (!taskRows.length) {
      throw new NotFoundException(`Задание ${taskId} не найдено`);
    }

    const tableName = taskRows[0].packagingTableName;
    if (!tableName) {
      throw new BadRequestException(`У задания ${taskId} не указана таблица фасовки`);
    }

    const table = this.packagingTableManager.getQuotedTableName(tableName);

    const totalsRows: Array<Record<string, string | number>> = await em.query(`
      SELECT
        COUNT(*) AS "totalRecords",
        COUNT(*) FILTER (WHERE small_box_label IS NULL) AS "withoutSmallBox",
        COUNT(*) FILTER (WHERE big_box_label IS NULL) AS "withoutBigBox",
        COUNT(*) FILTER (WHERE pallet_label IS NULL) AS "withoutPallet",
        COUNT(*) FILTER (WHERE small_box_label IS NOT NULL) AS "withSmallBox",
        COUNT(*) FILTER (WHERE big_box_label IS NOT NULL) AS "withBigBox",
        COUNT(*) FILTER (WHERE pallet_label IS NOT NULL) AS "withPallet"
      FROM ${table}
    `);

    const unassignedCodesRows: Array<{
      code: string;
      smallBoxLabel: string | null;
      bigBoxLabel: string | null;
      palletLabel: string | null;
    }> = await em.query(`
      SELECT
        code,
        small_box_label AS "smallBoxLabel",
        big_box_label AS "bigBoxLabel",
        pallet_label AS "palletLabel"
      FROM ${table}
    `);

    const withoutSmallBoxCodes: string[] = [];
    const withoutBigBoxCodes: string[] = [];
    const withoutPalletCodes: string[] = [];

    for (const row of unassignedCodesRows) {
      if (row.smallBoxLabel === null) withoutSmallBoxCodes.push(row.code);
      if (row.bigBoxLabel === null) withoutBigBoxCodes.push(row.code);
      if (row.palletLabel === null) withoutPalletCodes.push(row.code);
    }

    const smallBoxRows: Array<Record<string, unknown>> = await em.query(`
      SELECT
        small_box_label AS label,
        COUNT(*) AS "productsCount",
        COUNT(DISTINCT big_box_label) AS "parentCount",
        BOOL_OR(big_box_label IS NULL) AS "hasMissingParent",
        ARRAY_AGG(code) AS "productCodes",
        ARRAY_AGG(DISTINCT big_box_label) AS "parentCodes",
        ARRAY_AGG(code) FILTER (WHERE big_box_label IS NULL) AS "missingParentCodes"
      FROM ${table}
      WHERE small_box_label IS NOT NULL
      GROUP BY small_box_label
      ORDER BY small_box_label ASC
    `);

    const bigBoxRows: Array<Record<string, unknown>> = await em.query(`
      SELECT
        big_box_label AS label,
        COUNT(*) AS "productsCount",
        COUNT(DISTINCT small_box_label) AS "smallBoxesCount",
        COUNT(DISTINCT pallet_label) AS "palletsCount",
        BOOL_OR(pallet_label IS NULL) AS "hasMissingPallet",
        ARRAY_AGG(code) AS "productCodes",
        ARRAY_AGG(DISTINCT small_box_label) AS "smallBoxesCodes",
        ARRAY_AGG(DISTINCT pallet_label) AS "palletCodes",
        ARRAY_AGG(code) FILTER (WHERE pallet_label IS NULL) AS "missingPalletCodes"
      FROM ${table}
      WHERE big_box_label IS NOT NULL
      GROUP BY big_box_label
      ORDER BY big_box_label ASC
    `);

    const palletRows: Array<Record<string, unknown>> = await em.query(`
      SELECT
        pallet_label AS label,
        COUNT(*) AS "productsCount",
        COUNT(DISTINCT big_box_label) AS "bigBoxesCount",
        ARRAY_AGG(code) AS "productCodes",
        ARRAY_AGG(DISTINCT big_box_label) AS "bigBoxesCodes"
      FROM ${table}
      WHERE pallet_label IS NOT NULL
      GROUP BY pallet_label
      ORDER BY pallet_label ASC
    `);

    const toBoolean = (value: unknown): boolean => value === true || value === 'true';
    const toStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value.filter((item): item is string => typeof item === 'string');
    };
    const toNumber = (value: unknown): number => Number(value ?? 0);

    const totals = totalsRows[0];

    return {
      totalRecords: toNumber(totals?.totalRecords),
      withoutSmallBox: toNumber(totals?.withoutSmallBox),
      withoutBigBox: toNumber(totals?.withoutBigBox),
      withoutPallet: toNumber(totals?.withoutPallet),
      withSmallBox: toNumber(totals?.withSmallBox),
      withBigBox: toNumber(totals?.withBigBox),
      withPallet: toNumber(totals?.withPallet),
      withoutSmallBoxCodes,
      withoutBigBoxCodes,
      withoutPalletCodes,

      smallBoxes: smallBoxRows.map((row) => ({
        label: String(row.label),
        productsCount: toNumber(row.productsCount),
        parentCount: toNumber(row.parentCount),
        hasMissingParent: toBoolean(row.hasMissingParent),
        productCodes: toStringArray(row.productCodes),
        parentCodes: toStringArray(row.parentCodes),
        missingParentCodes: toStringArray(row.missingParentCodes),
      })),

      bigBoxes: bigBoxRows.map((row) => ({
        label: String(row.label),
        productsCount: toNumber(row.productsCount),
        smallBoxesCount: toNumber(row.smallBoxesCount),
        palletsCount: toNumber(row.palletsCount),
        hasMissingPallet: toBoolean(row.hasMissingPallet),
        productCodes: toStringArray(row.productCodes),
        smallBoxesCodes: toStringArray(row.smallBoxesCodes),
        palletCodes: toStringArray(row.palletCodes),
        missingPalletCodes: toStringArray(row.missingPalletCodes),
      })),

      pallets: palletRows.map((row) => ({
        label: String(row.label),
        productsCount: toNumber(row.productsCount),
        bigBoxesCount: toNumber(row.bigBoxesCount),
        productCodes: toStringArray(row.productCodes),
        bigBoxesCodes: toStringArray(row.bigBoxesCodes),
      })),
    };
  }

  private validatePositiveCount(value: number | null | undefined, fieldName: string): void {
    if (value == null || !Number.isFinite(value) || value <= 0) {
      throw new InternalServerErrorException(`Некорректное значение ${fieldName}: ${value}`);
    }
  }
}
