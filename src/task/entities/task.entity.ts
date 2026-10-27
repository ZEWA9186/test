import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { TaskCodesEntity } from './task-codes.entity';

@Entity('tasks')
export class TaskEntity {
  @Column({ name: 'gtin', type: 'varchar', length: 14, nullable: true })
  gtin: string;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name: string;

  @Column({ name: 'docId', type: 'varchar', nullable: true })
  docId: string;

  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string;

  @Column({ name: 'itf_14', type: 'varchar', length: 14, nullable: true })
  ITF14: string;

  @Column({ name: 'ean_13', type: 'varchar', length: 14, nullable: true })
  EAN13: string;

  @Column({ name: 'small_box_lable', type: 'varchar', nullable: true })
  smallBoxLabel: string;

  @Column({ name: 'big_box_lable', type: 'varchar', nullable: true })
  bigBoxLabel: string;

  @Column({ name: 'pallet_label', type: 'varchar', nullable: true })
  palletLabel: string;

  @Column({ name: 'gost', type: 'varchar', nullable: true })
  gost: string;

  @Column({ name: 'netto_unit', type: 'varchar', nullable: true })
  nettoUnit: string;

  @Column({ name: 'brutto_unit', type: 'varchar', nullable: true })
  bruttoUnit: string;

  @Column({ name: 'brutto_box', type: 'varchar', nullable: true })
  bruttoBox: string;

  @Column({ name: 'ad_info_1', type: 'varchar', nullable: true })
  adInfo1: string;

  @Column({ name: 'batch', type: 'varchar', nullable: true })
  batch: string;

  @Column({ name: 'packer', type: 'varchar', nullable: true })
  packer: string;

  @Column({ name: 'date_manufacture', type: 'varchar', nullable: true })
  dateManufacture: string;

  @Column({ name: 'date_expiration', type: 'varchar', nullable: true })
  dateExpiration: string;

  @Column({ name: 'pieces_per_small_box', type: 'int', nullable: true })
  piecesPerSmallBox: number;

  @Column({ name: 'pieces_per_big_box', type: 'int', nullable: true })
  piecesPerBigBox: number;

  @Column({ name: 'pieces_per_pallet', type: 'int', nullable: true })
  piecesPerPallet: number;

  @Column({ name: 'aggregation_lvl', type: 'int', nullable: true })
  aggregationLvl: number;

  @OneToMany(() => TaskCodesEntity, (code) => code.task, { cascade: true })
  codes: TaskCodesEntity[];

  @Column({ name: 'tsdIds', type: 'int', array: true, nullable: true })
  tsdIds: number[];

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({
    name: 'packaging_table_name',
    type: 'varchar',
    length: 63,
    nullable: true,
  })
  packagingTableName: string | null;

  @Column({ name: 'is_history', type: 'boolean', default: false })
  isHistory: boolean;

  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id: number;
}
