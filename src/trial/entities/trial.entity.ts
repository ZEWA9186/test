import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TrialEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true, nullable: false, name: 'line_ip' })
    lineIp: string;

    @Column({ type: 'int', default: 86400, name: 'remaining_minutes' })
    remainingMinutes: number;
    
    @Column({ type: 'boolean', nullable: false, name: 'is_trial' })
    isTrial: boolean;
}