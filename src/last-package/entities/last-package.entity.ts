import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('last-package')
export class LastPackageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gtin: string;

  @Column()
  BoxNumber: number;

  @Column()
  PalletNumber: number;

  @Column()
  DateTask: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  BatchNumber: string;
}
