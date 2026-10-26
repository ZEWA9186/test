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
import { ContainerFillStats, TaskPackagingStats } from '../dto/responce.dto';
import { AggregationCounts } from '../entities/aggregation-counts';
import {
  AggregationRules,
  ContainerColumn,
  ContainerRule,
} from '../helper-service/aggregation.rules';

export interface PackagingRecord {
  id: number;
  code: string;
  smallBoxLabel: string | null;
  bigBoxLabel: string | null;
  palletLabel: string | null;
  tsdId: number;
  createdAt: Date;
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

  // ───────────────────────────── приватные хелперы ─────────────────────────────

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

  // ───────────────────────────── получение активной задачи ─────────────────────────────

  async getActiveTask(tsdId: number, manager?: EntityManager): Promise<ActiveTaskEntity> {
    const activeTask = await this.getActiveTaskRepository(manager).findOne({
      where: { tsdId },
    });

    if (!activeTask || !activeTask.taskId) {
      throw new NotFoundException(`Для ТСД ${tsdId} нет активной задачи`);
    }

    return activeTask;
  }

  async getActiveTaskForUpdate(tsdId: number, manager: EntityManager): Promise<ActiveTaskEntity> {
    const activeTask = await this.getActiveTaskRepository(manager).findOne({
      where: { tsdId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!activeTask || !activeTask.taskId) {
      throw new NotFoundException(`Для ТСД ${tsdId} нет активной задачи`);
    }

    return activeTask;
  }

  // ───────────────────────────── подсчёт / статистика ─────────────────────────────

  async getCounts(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<AggregationCounts> {
    const table = this.getPackagingTable(activeTask);
    const em = this.getManager(manager);
    const lvl = Number(activeTask.aggregationLvl);

    if (lvl === 1) {
      const rows = await em.query(
        `SELECT COUNT(*) FILTER (WHERE pallet_label IS NULL) AS "openProducts"
       FROM ${table} WHERE tsd_id = $1`,
        [activeTask.tsdId],
      );

      return {
        openProducts: Number(rows[0]?.openProducts ?? 0),
        closedSmallBoxes: 0,
        fullSmallBoxes: 0,
        partialSmallBoxes: 0,
        closedBigBoxes: 0,
      };
    }

    if (lvl === 2) {
      const rows = await em.query(
        `SELECT
         COUNT(*) FILTER (
           WHERE big_box_label IS NULL AND pallet_label IS NULL
         ) AS "openProducts",
         COUNT(DISTINCT big_box_label) FILTER (
           WHERE big_box_label IS NOT NULL AND pallet_label IS NULL
         ) AS "closedBigBoxes"
       FROM ${table}
       WHERE tsd_id = $1`,
        [activeTask.tsdId],
      );

      return {
        openProducts: Number(rows[0]?.openProducts ?? 0),
        closedSmallBoxes: 0,
        fullSmallBoxes: 0,
        partialSmallBoxes: 0,
        closedBigBoxes: Number(rows[0]?.closedBigBoxes ?? 0),
      };
    }

    const rows = await em.query(
      `WITH base AS (
       SELECT small_box_label, big_box_label, pallet_label
       FROM ${table}
       WHERE tsd_id = $1
     ),
     small AS (
       SELECT small_box_label, COUNT(*) AS products
       FROM base
       WHERE small_box_label IS NOT NULL
         AND big_box_label IS NULL
         AND pallet_label IS NULL
       GROUP BY small_box_label
     )
     SELECT
       (SELECT COUNT(*) FROM base
         WHERE small_box_label IS NULL
           AND big_box_label IS NULL
           AND pallet_label IS NULL) AS "openProducts",
       (SELECT COUNT(*) FROM small) AS "closedSmallBoxes",
       (SELECT COUNT(*) FROM small WHERE products = $2) AS "fullSmallBoxes",
       (SELECT COUNT(*) FROM small WHERE products <> $2) AS "partialSmallBoxes",
       (SELECT COUNT(DISTINCT big_box_label) FROM base
         WHERE big_box_label IS NOT NULL
           AND pallet_label IS NULL) AS "closedBigBoxes"`,
      [activeTask.tsdId, activeTask.piecesPerSmallBox],
    );

    return {
      openProducts: Number(rows[0]?.openProducts ?? 0),
      closedSmallBoxes: Number(rows[0]?.closedSmallBoxes ?? 0),
      fullSmallBoxes: Number(rows[0]?.fullSmallBoxes ?? 0),
      partialSmallBoxes: Number(rows[0]?.partialSmallBoxes ?? 0),
      closedBigBoxes: Number(rows[0]?.closedBigBoxes ?? 0),
    };
  }

  async getCountByLabel(
    label: string,
    outerType: ExpectedScanType,
    innerType: ExpectedScanType,
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    const table = this.getPackagingTable(activeTask);
    const outerColumn = AggregationRules.getColumnByScanType(outerType);
    const em = this.getManager(manager);

    if (innerType === ExpectedScanType.PRODUCT) {
      const rows: Array<{ count: string | number }> = await em.query(
        `SELECT COUNT(*) AS "count"
       FROM ${table}
       WHERE ${outerColumn} = $1
         AND tsd_id = $2`,
        [label, activeTask.tsdId],
      );
      return Number(rows[0]?.count ?? 0);
    }

    const innerColumn = AggregationRules.getColumnByScanType(innerType);

    const rows: Array<{ count: string | number }> = await em.query(
      `SELECT COUNT(DISTINCT ${innerColumn}) AS "count"
     FROM ${table}
     WHERE ${outerColumn} = $1
       AND ${innerColumn} IS NOT NULL
       AND tsd_id = $2`,
      [label, activeTask.tsdId],
    );

    return Number(rows[0]?.count ?? 0);
  }

  async getTaskPackagingStats(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<TaskPackagingStats> {
    if (!manager) {
      //Изоляция для разбиения на несколько методов
      return this.entityManager.transaction('REPEATABLE READ', (transactionManager) =>
        this.getTaskPackagingStats(activeTask, transactionManager),
      );
    }

    const rules = AggregationRules.getContainerRules(activeTask);
    const statsByScanType = new Map<ExpectedScanType, ContainerFillStats[]>();

    const totalRecords = await this.countTaskRows(activeTask, manager);
    const productsWithoutPackaging = await this.getCodesWithoutLabel(
      activeTask,
      rules[0].labelColumn,
      manager,
    );

    for (const rule of rules) {
      statsByScanType.set(
        rule.scanType,
        await this.getContainerStats(activeTask, rule, manager),
      );
    }

    const smallBoxRule = rules.find(
      (rule) => rule.scanType === ExpectedScanType.SMALL_BOX_LABEL,
    );
    const bigBoxRule = rules.find(
      (rule) => rule.scanType === ExpectedScanType.BIG_BOX_LABEL,
    );

    const smallBoxes = statsByScanType.get(ExpectedScanType.SMALL_BOX_LABEL) ?? [];
    const bigBoxes = statsByScanType.get(ExpectedScanType.BIG_BOX_LABEL) ?? [];
    const pallets = statsByScanType.get(ExpectedScanType.PALLET_LABEL) ?? [];

    const smallBoxesWithoutBigBox = smallBoxRule
      ? await this.getLabelsWithoutParent(activeTask, smallBoxRule, manager)
      : [];
    const bigBoxesWithoutPallet = bigBoxRule
      ? await this.getLabelsWithoutParent(activeTask, bigBoxRule, manager)
      : [];

    const allContainers = [...smallBoxes, ...bigBoxes, ...pallets];

    const isValid =
      productsWithoutPackaging.length === 0 &&
      smallBoxesWithoutBigBox.length === 0 &&
      bigBoxesWithoutPallet.length === 0 &&
      allContainers.every((container) => container.isFull && !container.isOverfilled);

    return {
      totalRecords,
      isValid,

      productsWithoutPackaging,
      smallBoxesWithoutBigBox,
      bigBoxesWithoutPallet,

      productsWithoutPackagingCount: productsWithoutPackaging.length,
      smallBoxesWithoutBigBoxCount: smallBoxesWithoutBigBox.length,
      bigBoxesWithoutPalletCount: bigBoxesWithoutPallet.length,

      smallBoxes,
      bigBoxes,
      pallets,
    };
  }

  private async countTaskRows(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    const table = this.getPackagingTable(activeTask);

    const rows: Array<{ count: number }> = await this.getManager(manager).query(
      `SELECT COUNT(*)::int AS "count" FROM ${table}`,
    );

    return Number(rows[0]?.count ?? 0);
  }

  private async getContainerStats(
    activeTask: ActiveTaskEntity,
    rule: ContainerRule,
    manager?: EntityManager,
  ): Promise<ContainerFillStats[]> {
    const table = this.getPackagingTable(activeTask);
    const labelColumn = rule.labelColumn;
    const childColumn = rule.childLabelColumn;
    const expectedCount = rule.limit;

    const actualCountSql = childColumn ? `COUNT(DISTINCT ${childColumn})` : 'COUNT(*)';

    const contentsSql = childColumn
      ? `COALESCE(
           json_agg(DISTINCT ${childColumn} ORDER BY ${childColumn})
             FILTER (WHERE ${childColumn} IS NOT NULL),
           '[]'::json
         )`
      : `json_agg(code ORDER BY id)`;

    const rows: Array<{
      label: string;
      actualCount: number | string;
      contents: string[] | null;
    }> = await this.getManager(manager).query(
      `
        SELECT
          ${labelColumn} AS "label",
          ${actualCountSql}::int AS "actualCount",
          ${contentsSql} AS "contents"
        FROM ${table}
        WHERE ${labelColumn} IS NOT NULL
        GROUP BY ${labelColumn}
        ORDER BY MIN(id)
      `,
    );

    return rows.map((row) => {
      const actualCount = Number(row.actualCount);

      return {
        label: row.label,
        actualCount,
        expectedCount,
        isFull: actualCount === expectedCount,
        isOverfilled: actualCount > expectedCount,
        missingCount: Math.max(expectedCount - actualCount, 0),
        contents: row.contents ?? [],
      };
    });
  }

  private async getCodesWithoutLabel(
    activeTask: ActiveTaskEntity,
    labelColumn: ContainerColumn,
    manager?: EntityManager,
  ): Promise<string[]> {
    const table = this.getPackagingTable(activeTask);

    const rows: Array<{ codes: string[] | null }> = await this.getManager(manager).query(
      `
        SELECT COALESCE(json_agg(code ORDER BY id), '[]'::json) AS "codes"
        FROM ${table}
        WHERE ${labelColumn} IS NULL
      `,
    );

    return rows[0]?.codes ?? [];
  }

  private async getLabelsWithoutParent(
    activeTask: ActiveTaskEntity,
    rule: ContainerRule,
    manager?: EntityManager,
  ): Promise<string[]> {
    const parentColumn = rule.parentLabelColumns[0];

    if (!parentColumn) {
      return [];
    }

    const table = this.getPackagingTable(activeTask);
    const labelColumn = rule.labelColumn;

    const rows: Array<{ labels: string[] | null }> = await this.getManager(manager).query(
      `
        SELECT COALESCE(
          json_agg(DISTINCT ${labelColumn} ORDER BY ${labelColumn}),
          '[]'::json
        ) AS "labels"
        FROM ${table}
        WHERE ${labelColumn} IS NOT NULL
          AND ${parentColumn} IS NULL
      `,
    );

    return rows[0]?.labels ?? [];
  }

  // ───────────────────────────── операции с товарами ─────────────────────────────

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

  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
    const table = this.getPackagingTable(activeTask);
    const em = this.getManager(manager);
    const column = AggregationRules.getColumnByScanType(packageType);

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

  // ───────────────────────────── операции с упаковками ─────────────────────────────

  async setContainerLabel(
    activeTask: ActiveTaskEntity,
    containerType: ExpectedScanType,
    code: string,
    manager?: EntityManager,
  ): Promise<number> {
    const table = this.getPackagingTable(activeTask);
    const em = this.getManager(manager);

    const rule = AggregationRules.getContainerRules(activeTask).find(
      (item) => item.scanType === containerType,
    );

    if (!rule) {
      throw new BadRequestException(
        `Тип тары ${containerType} недопустим для уровня агрегации ${activeTask.aggregationLvl}`,
      );
    }

    // 1. Этикетка не должна встречаться в этой таблице ни в одной роли.
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

    // 2. Колонка и условие «эти строки действительно принадлежат этой таре».
    const column = rule.labelColumn;
    const whereParts = [
      `${rule.labelColumn} IS NULL`,
      ...rule.parentLabelColumns.map((parentColumn) => `${parentColumn} IS NULL`),
      ...rule.lowerLevelLabelColumns.map((lowerColumn) => `${lowerColumn} IS NULL`),
    ];

    if (rule.childLabelColumn) {
      whereParts.push(`${rule.childLabelColumn} IS NOT NULL`);
    }

    const whereSql = whereParts.join(' AND ');

    // 3. Закрываем только строки текущего уровня.
    //    column и whereSql собраны только из фиксированного списка выше.
    const updatedRows: Array<{ updated: number }> = await em.query(
      `
      UPDATE ${table}
      SET ${column} = $1
      WHERE tsd_id = $2
        AND ${whereSql}
      RETURNING 1 AS updated
    `,
      [code, activeTask.tsdId],
    );

    if (updatedRows.length === 0) {
      throw new BadRequestException(
        `Нечего закрывать: для этикетки ${code} нет подходящих строк в текущей таре`,
      );
    }

    return updatedRows.length;
  }

  async moveBox(
    innerLabel: string,
    outerLabel: string,
    outerType: ExpectedScanType,
    innerType: ExpectedScanType,
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<void> {
    const table = this.getPackagingTable(activeTask);
    const outerColumn = AggregationRules.getColumnByScanType(outerType);
    const innerColumn = AggregationRules.getColumnByScanType(innerType);

    await this.getManager(manager).query(
      `
        UPDATE ${table}
        SET ${outerColumn} = $1
        WHERE ${innerColumn} = $2
      `,
      [outerLabel, innerLabel],
    );
  }

  async deletePackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    manager?: EntityManager,
  ): Promise<string[]> {
    const table = this.getPackagingTable(activeTask);

    type CodeRow = { code: string };

    const raw = await this.getManager(manager).query(
      `
        DELETE FROM ${table}
        WHERE small_box_label = $1
           OR big_box_label = $1
           OR pallet_label = $1
          RETURNING code
      `,
      [packageLabel],
    );

    const rows: CodeRow[] = Array.isArray(raw?.[0]) ? raw[0] : [];

    if (!rows.length) {
      throw new NotFoundException(`Упаковка ${packageLabel} не найдена`);
    }
    return rows.map((row: { code: string }) => row.code);
  }

  async searchPackageInfo(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingRecord> {
    const table = this.getPackagingTable(activeTask);
    const em = this.getManager(manager);
    const column = AggregationRules.getColumnByScanType(scanType);

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

  // ───────────────────────────── подсчёт содержимого упаковки ─────────────────────────────

  async countProductsInPackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    manager?: EntityManager,
  ): Promise<number> {
    const table = this.getPackagingTable(activeTask);

    const rows: Array<{ count: number | string }> = await this.getManager(manager).query(
      `SELECT COUNT(*)::int AS "count"
       FROM ${table}
       WHERE small_box_label = $1
          OR big_box_label = $1
          OR pallet_label = $1`,
      [packageLabel],
    );

    return Number(rows[0]?.count ?? 0);
  }

  async countPackageContents(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<number> {
    const table = this.getPackagingTable(activeTask);
    const column = AggregationRules.getColumnByScanType(scanType);
    const contentsType = AggregationRules.getContentsType(activeTask.aggregationLvl, scanType);

    if (!contentsType) {
      throw new BadRequestException('Невозможно посчитать содержимое упаковки');
    }

    const childColumn =
      contentsType === ExpectedScanType.PRODUCT
        ? 'code'
        : AggregationRules.getColumnByScanType(contentsType);

    const rows: Array<{ count: number | string }> = await this.getManager(manager).query(
      `SELECT COUNT(DISTINCT ${childColumn})::int AS "count"
       FROM ${table}
       WHERE ${column} = $1`,
      [packageLabel],
    );

    return Number(rows[0]?.count ?? 0);
  }
}
