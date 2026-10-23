import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { TaskEntity } from '../entities/task.entity';

export interface ReportRecord {
  id: number;
  code: string;
  smallBoxLabel: string | null;
  bigBoxLabel: string | null;
  palletLabel: string | null;
  tsdId: number;
  createdAt: Date;
}

@Injectable()
export class ReportRepository {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  /** Возвращает все записи фасовки задания для формирования отчёта. */
  async getAllReport(task: TaskEntity): Promise<ReportRecord[]> {
    if (!task) {
      throw new BadRequestException('Не указана таблица фасовки задания');
    }
    const table = `"${task.packagingTableName}"`;
    try {
      return await this.entityManager.query(
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
          ORDER BY id
        `,
      );
    } catch (error) {
      console.error('Ошибка получения записей для отчёта', {
        table,
        error: error instanceof Error ? error.message : error,
      });

      throw error;
    }
  }
}
