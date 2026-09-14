import {Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class CodeEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ unique: true})
    code: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}