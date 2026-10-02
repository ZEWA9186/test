import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    PrimaryGeneratedColumn,
} from 'typeorm';
import {TaskEntity} from './task.entity';

@Entity('task_codes')
export class TaskCodesEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({name: 'code', type: 'varchar', unique: true})
    code: string;

    // Внешний ключ на задачу (обязателен, чтобы знать, к какому заданию относится код)
    @Column({name: 'task_id', type: 'int', nullable: false})
    taskId: number;

    @ManyToOne(() => TaskEntity, (task) => task.codes, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'task_id'})
    task: TaskEntity;

    @CreateDateColumn({name: 'created_at'})
    createdAt: Date;
}
