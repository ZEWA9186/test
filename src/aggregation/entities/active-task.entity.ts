import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TaskEntity } from '../../task/entities/task.entity';

export enum ExpectedScanType {
  PRODUCT = 'PRODUCT',
  SMALL_BOX_LABEL = 'SMALL_BOX_LABEL',
  BIG_BOX_LABEL = 'BIG_BOX_LABEL',
  PALLET_LABEL = 'PALLET_LABEL',
}

@Entity('active_tasks')
export class ActiveTaskEntity {
  @PrimaryColumn({ name: 'tsd_id', type: 'int' })
  tsdId: number;

  @Column({ name: 'gtin', nullable: true })
  gtin: string;

  @Column({ name: 'itf_14', type: 'varchar', length: 14, nullable: true })
  ITF14: string;

  @Column({ name: 'batch', type: 'varchar', nullable: true })
  batch: string;

  @Column({ name: 'date_manufacture', type: 'varchar', nullable: true })
  dateManufacture: string;

  @Column({ name: 'date_expiration', type: 'varchar', nullable: true })
  dateExpiration: string;

  @Column({ name: 'pieces_per_small_box', nullable: true, type: 'int' })
  piecesPerSmallBox: number;

  @Column({ name: 'pieces_per_big_box', nullable: true, type: 'int' })
  piecesPerBigBox: number;

  @Column({ name: 'pieces_per_pallet', nullable: true, type: 'int' })
  piecesPerPallet: number;

  @Column({
    name: 'expected_scan',
    type: 'enum',
    enum: ExpectedScanType,
    default: ExpectedScanType.PRODUCT,
  })
  expectedScan: ExpectedScanType;

  @Column({ name: 'aggregation_lvl', nullable: true, type: 'int' })
  aggregationLvl: number;

  // Какая задача сейчас запущена на этом ТСД (Много ТСД могут ссылаться на 1 задачу)
  @ManyToOne(() => TaskEntity, (task) => task.activeTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;
}
