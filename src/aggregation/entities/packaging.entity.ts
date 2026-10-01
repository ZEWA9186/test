import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from '../../files1s/entities/task.entity';
import { ActiveTaskEntity } from './active-task.entity';

@Entity('packaging')
export class PackagingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  smallBoxLabel: string;

  @Column({ nullable: true })
  bigBoxLabel: string;

  @Column({ nullable: true })
  palletLabel: string;

  @Column({ name: 'tsd_id' })
  tsdId: number;

  @ManyToOne(
    () => ActiveTaskEntity,
    (activeTask) => activeTask.packagingTable,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'tsd_id', referencedColumnName: 'tsdId' })
  activeTask: ActiveTaskEntity;

  @ManyToOne(() => TaskEntity, (task) => task.packages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task: TaskEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
