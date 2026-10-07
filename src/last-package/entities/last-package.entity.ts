import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Index(['gtin', 'dateTask', 'batchNumber'], { unique: true })
@Entity('last_package')
export class LastPackageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gtin: string;

  @Column({ name: 'small_box_number', nullable: true })
  smallBoxNumber: number;

  @Column({ name: 'big_box_number', nullable: true })
  bigBoxNumber: number;

  @Column({ name: 'pallet_number', nullable: true })
  palletNumber: number;

  @Column({ name: 'date_task' })
  dateTask: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'batch_number' })
  batchNumber: string;
}
