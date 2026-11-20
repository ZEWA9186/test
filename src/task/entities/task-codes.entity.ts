import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskEntity } from './task.entity';

@Entity('task_codes')
export class TaskCodesEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'code', type: 'varchar', unique: true })
  code: string;

  // Связь с задачей — по externalId, потому что tasks.id больше не unique.
  @Column({ name: 'external_id', type: 'uuid' })
  externalId: string;

  @ManyToOne(() => TaskEntity, (task) => task.codes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'external_id', referencedColumnName: 'externalId' })
  task: TaskEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
