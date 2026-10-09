import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { TaskCodesEntity } from './task-codes.entity';
import { PackagingEntity } from '../../aggregation/entities/packaging.entity';
import { ActiveTaskEntity } from '../../aggregation/entities/active-task.entity';

@Entity('tasks')
export class TaskEntity {
  @Column({ name: 'gtin', type: 'varchar', length: 14, nullable: true })
  gtin: string;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name: string;

  @Column({ name: 'description', type: 'varchar', nullable: true })
  description: string;

  @Column({ name: 'itf_14', type: 'varchar', length: 14, nullable: true })
  ITF14: string;

  @Column({ name: 'small_box_lable', type: 'varchar', nullable: true })
  smallBoxLabel: string;

  @Column({ name: 'big_box_lable', type: 'varchar', nullable: true })
  bigBoxLabel: string;

  @Column({ name: 'pallet_label', type: 'varchar', nullable: true })
  palletLabel: string;

  @Column({ name: 'inscription_label', type: 'varchar', nullable: true })
  inscriptionLabel: string;

  @Column({ name: 'tech_conditions', type: 'varchar', nullable: true })
  techConditions: string;

  @Column({ name: 'gost', type: 'varchar', nullable: true })
  gost: string;

  @Column({ name: 'other_tech_conditions', type: 'varchar', nullable: true })
  otherTechConditions: string;

  @Column({ name: 'netto_unit', type: 'varchar', nullable: true })
  nettoUnit: string;

  @Column({ name: 'brutto_unit', type: 'varchar', nullable: true })
  bruttoUnit: string;

  @Column({ name: 'brutto_box', type: 'varchar', nullable: true })
  bruttoBox: string;

  @Column({ name: 'temp_cond_1', type: 'varchar', nullable: true })
  tempCond1: string;

  @Column({ name: 'temp_cond_2', type: 'varchar', nullable: true })
  tempCond2: string;

  @Column({ name: 'temp_cond_3', type: 'varchar', nullable: true })
  tempCond3: string;

  @Column({ name: 'temp_cond_4', type: 'varchar', nullable: true })
  tempCond4: string;

  @Column({ name: 'ad_info_1', type: 'varchar', nullable: true })
  adInfo1: string;

  @Column({ name: 'ad_info_2', type: 'varchar', nullable: true })
  adInfo2: string;

  @Column({ name: 'ad_info_3', type: 'varchar', nullable: true })
  adInfo3: string;

  @Column({ name: 'ad_info_4', type: 'varchar', nullable: true })
  adInfo4: string;

  @Column({ name: 'ad_info_5', type: 'varchar', nullable: true })
  adInfo5: string;

  @Column({ name: 'ad_info_6', type: 'varchar', nullable: true })
  adInfo6: string;

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

  @Column({ name: 'start_corob', type: 'varchar', nullable: true })
  startCorob: string;

  @Column({ name: 'start_pallet', type: 'varchar', nullable: true })
  startPallet: string;

  @Column({ name: 'work_sh', type: 'varchar', nullable: true })
  workSH: string;

  @Column({ name: 'aggregation_lvl', type: 'int', nullable: true })
  aggregationLvl: number;

  @OneToMany(() => TaskCodesEntity, (code) => code.task, { cascade: true })
  codes: TaskCodesEntity[];

  @Column({ name: 'tsdIds', type: 'int', array: true, nullable: true })
  tsdIds: number[];

  @OneToMany(() => ActiveTaskEntity, (activeTask) => activeTask.task, {
    cascade: true,
  })
  activeTasks: ActiveTaskEntity[];

  // Все упакованные коды по этой задаче со всех ТСД
  @OneToMany(() => PackagingEntity, (packaging) => packaging.task)
  packages: PackagingEntity[];

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @PrimaryGeneratedColumn('increment', { name: 'id' })
  id: number;
}
