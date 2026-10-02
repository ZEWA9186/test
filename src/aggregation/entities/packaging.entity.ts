import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { TaskEntity } from '../../task/entities/task.entity';

@Index(['task', 'tsdId', 'smallBoxLabel'])
@Index(['task', 'tsdId', 'bigBoxLabel'])
@Index(['task', 'tsdId', 'palletLabel'])
@Entity('packaging')
export class PackagingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column({ name: 'small_box_label', nullable: true })
  smallBoxLabel: string;

  @Column({ name: 'big_box_label', nullable: true })
  bigBoxLabel: string;

  @Column({ name: 'pallet_label', nullable: true })
  palletLabel: string;

  @Column({
    name: 'tsd_id',
    type: 'int',
  })
  tsdId: number;

  @ManyToOne(() => TaskEntity, (task) => task.packages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
