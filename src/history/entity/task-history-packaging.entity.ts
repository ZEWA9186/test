import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { TaskHistoryEntity } from './task-history.entity';

@Index('IDX_history_packaging_history_id', ['historyId'])
@Index('IDX_history_packaging_code', ['code'])
@Index('IDX_history_packaging_small_box', ['smallBoxLabel'])
@Index('IDX_history_packaging_big_box', ['bigBoxLabel'])
@Index('IDX_history_packaging_pallet', ['palletLabel'])
@Entity('task_history_packaging')
export class TaskHistoryPackagingEntity {
  // Копируем packaging.id.
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'history_id', type: 'int' })
  historyId: number;

  @ManyToOne(() => TaskHistoryEntity, (history) => history.packagingRecords, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'history_id', referencedColumnName: 'id' })
  history: TaskHistoryEntity;

  @Column({ type: 'text' })
  code: string;

  @Column({ name: 'small_box_label', type: 'text', nullable: true })
  smallBoxLabel: string | null;

  @Column({ name: 'big_box_label', type: 'text', nullable: true })
  bigBoxLabel: string | null;

  @Column({ name: 'pallet_label', type: 'text', nullable: true })
  palletLabel: string | null;

  @Column({ name: 'tsd_id', type: 'int' })
  tsdId: number;

  // Это время исходной записи, а не момент её архивации.
  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
