import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { PackagingEntity } from './packaging.entity';
import { TaskEntity } from '../../files1s/entities/task.entity';

export enum ExpectedScanType {
  PRODUCT = 'PRODUCT',
  SMALL_BOX_LABEL = 'SMALL_BOX_LABEL',
  BIG_BOX_LABEL = 'BIG_BOX_LABEL',
  PALLET_LABEL = 'PALLET_LABEL',
}

@Entity('active_tasks')
export class ActiveTaskEntity {
  @PrimaryColumn({ name: 'tsd_id' })
  tsdId: number;

  @Column({ name: 'gtin', nullable: true })
  gtin: string;

  @Column({ name: 'pieces_per_small_box', nullable: true })
  piecesPerSmallBox: number;

  @Column({ name: 'pieces_per_big_box', nullable: true })
  piecesPerBigBox: number;

  @Column({ name: 'pieces_per_pallet', nullable: true })
  piecesPerPallet: number;

  @Column({
    name: 'expected_scan',
    type: 'enum',
    enum: ExpectedScanType,
    default: ExpectedScanType.PRODUCT,
  })
  expectedScan: ExpectedScanType;

  @Column({ name: 'aggregation_lvl', nullable: true })
  aggregationLvl: number;

  // Какая задача сейчас запущена на этом ТСД (Много ТСД могут ссылаться на 1 задачу)
  @ManyToOne(() => TaskEntity, (task) => task.activeTasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  // Упаковки, которые этот конкретный ТСД успел насканить в рамках своей работы
  @OneToMany(() => PackagingEntity, (packaging) => packaging.activeTask)
  packagingTable: PackagingEntity[];
}
