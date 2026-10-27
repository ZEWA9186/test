import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('nomenclatures')
export class NomenclatureEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'gtin', type: 'varchar', length: 14, nullable: true })
  gtin: string;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name: string;

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
}
