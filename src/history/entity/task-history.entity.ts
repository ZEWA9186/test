import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';

import { TaskHistoryPackagingEntity } from './task-history-packaging.entity';

@Index('IDX_task_history_closed_at', ['closedAt'])
@Index('IDX_task_history_date_manufacture', ['dateManufacture'])
@Index('IDX_task_history_batch', ['batch'])
@Index('IDX_task_history_gtin', ['gtin'])
@Index('IDX_task_history_name', ['name'])
@Entity('task_history')
export class TaskHistoryEntity {
  // ID исходного задания из tasks.id.
  @PrimaryColumn({ type: 'int' })
  id: number;

  @CreateDateColumn({ name: 'closed_at', type: 'timestamptz' })
  closedAt: Date;

  @Column({ name: 'date_manufacture', type: 'date', nullable: true })
  dateManufacture: string | null;

  @Column({ type: 'varchar', nullable: true })
  batch: string | null;

  @Column({ type: 'varchar', length: 14, nullable: true })
  gtin: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  // Остальные параметры задания, не вынесенные в отдельные колонки.
  @Column({ name: 'task_snapshot', type: 'jsonb' })
  taskSnapshot: Record<string, unknown>;

  // Коды, которые остались неиспользованными при завершении задания.
  @Column({
    name: 'unused_codes',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  unusedCodes: string[];

  @OneToMany(() => TaskHistoryPackagingEntity, (record) => record.history)
  packagingRecords: TaskHistoryPackagingEntity[];
}
