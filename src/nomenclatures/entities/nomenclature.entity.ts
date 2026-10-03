import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('nomenclatures')
export class NomenclatureEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 14 })
  gtin: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'itf_14', length: 14, nullable: true })
  ITF14: string;

  @Column({ name: 'small_box_lable', nullable: true })
  smallBoxLabel: string;

  @Column({ name: 'big_box_lable', nullable: true })
  bigBoxLabel: string;

  @Column({ name: 'pallet_label', nullable: true })
  palletLabel: string;

  // TODO остальные поля, которые являются шаблоном
}
