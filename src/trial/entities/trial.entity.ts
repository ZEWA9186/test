import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TrialEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'int', unique: true, nullable: false })
    lineNumber: number;

    @Column({ type: 'int', default: 86400 })
    remainingMinutes: number;
    
    @Column({ type: 'boolean', nullable: false, default: true })
    isTrial: boolean;
}