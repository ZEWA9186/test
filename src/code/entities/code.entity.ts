import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class CodeEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string;
}