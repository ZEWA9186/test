import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { TaskCodes } from './task-codes';

@Entity('tasks')
export class TaskEntity {
  @Column({ name: 'gtin', type: 'varchar', length: 14, nullable: true })
  gtin: string;

  @Column({ name: 'name', type: 'text', nullable: true })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'itf_14', type: 'varchar', length: 14, nullable: true })
  ITF14: string;

  @Column({ name: 'label_box', type: 'varchar', nullable: true })
  labelBox: string;

  @Column({ name: 'label_pallet', type: 'varchar', nullable: true })
  labelPallet: string;

  @Column({ name: 'inscription_label', type: 'text', nullable: true })
  inscriptionLabel: string;

  @Column({ name: 'tech_conditions', type: 'varchar', nullable: true })
  techConditions: string;

  @Column({ name: 'gost', type: 'varchar', nullable: true })
  gost: string;

  @Column({ name: 'other_tech_conditions', type: 'varchar', nullable: true })
  otherTechConditions: string;

  @Column({ name: 'netto_unit', type: 'numeric', nullable: true })
  nettoUnit: number;

  @Column({ name: 'brutto_unit', type: 'numeric', nullable: true })
  bruttoUnit: number;

  @Column({ name: 'brutto_box', type: 'numeric', nullable: true })
  bruttoBox: number;

  @Column({ name: 'temp_cond_1', type: 'varchar', nullable: true })
  tempCond1: string;

  @Column({ name: 'temp_cond_2', type: 'varchar', nullable: true })
  tempCond2: string;

  @Column({ name: 'temp_cond_3', type: 'varchar', nullable: true })
  tempCond3: string;

  @Column({ name: 'temp_cond_4', type: 'varchar', nullable: true })
  tempCond4: string;

  @Column({ name: 'ad_info_1', type: 'text', nullable: true })
  adInfo1: string;

  @Column({ name: 'ad_info_2', type: 'text', nullable: true })
  adInfo2: string;

  @Column({ name: 'ad_info_3', type: 'text', nullable: true })
  adInfo3: string;

  @Column({ name: 'ad_info_4', type: 'text', nullable: true })
  adInfo4: string;

  @Column({ name: 'ad_info_5', type: 'text', nullable: true })
  adInfo5: string;

  @Column({ name: 'ad_info_6', type: 'text', nullable: true })
  adInfo6: string;

  @Column({ name: 'batch', type: 'varchar', nullable: true })
  batch: string;

  @Column({ name: 'packer', type: 'varchar', nullable: true })
  packer: string;

  @Column({ name: 'date_manufacture', type: 'date', nullable: true })
  date_manufacture: string;

  @Column({ name: 'date_expiration', type: 'date', nullable: true })
  date_expiration: string;

  @Column({ name: 'pieces_per_package', type: 'int', nullable: true })
  pieces_per_package: number;

  @Column({ name: 'packaging_per_pallet', type: 'int', nullable: true })
  packaging_per_pallet: number;

  @Column({ name: 'start_corob', type: 'int', nullable: true })
  startCorob: number;

  @Column({ name: 'start_pallet', type: 'int', nullable: true })
  startPallet: number;

  @Column({ name: 'work_sh', type: 'int', nullable: true })
  workSH: number;

  @Column({ name: 'line', type: 'int', array: true, nullable: true })
  line: number;

  @OneToMany(() => TaskCodes, (code) => code.task, { cascade: true })
  codes: TaskCodes[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id: number;
}
