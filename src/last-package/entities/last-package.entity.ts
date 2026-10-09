import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('last_package')
export class LastPackageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'small_box_number', nullable: true })
  smallBoxNumber: number;

  @Column({ name: 'big_box_number', nullable: true })
  bigBoxNumber: number;

  @Column({ name: 'pallet_number', nullable: true })
  palletNumber: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
