import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class TrialEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: 'int' ,unique: true })
    lineNumber: number;

    @Column({ type: 'timestamp'})
    startDate: Date;

    @Column({ type: 'timestamp'})
    endDate: Date;

    @Column({ type: 'boolean' , nullable: false })
    isTrial: boolean;
}