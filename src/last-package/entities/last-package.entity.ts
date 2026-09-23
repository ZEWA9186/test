import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('last_package')
export class LastPackageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gtin: string;

  @Column()
  boxNumber: number;

  @Column()
  palletNumber: number;

  @Column()
  dateTask: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  batchNumber: string;
}
