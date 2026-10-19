import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum ExpectedScanType {
  PRODUCT = 'PRODUCT',
  SMALL_BOX_LABEL = 'SMALL_BOX_LABEL',
  BIG_BOX_LABEL = 'BIG_BOX_LABEL',
  PALLET_LABEL = 'PALLET_LABEL',
}

@Entity('active_tasks')
export class ActiveTaskEntity {
  @PrimaryColumn({ name: 'tsd_id', type: 'int' })
  tsdId: number;

  @Column({ name: 'task_id', type: 'int', nullable: true })
  taskId: number | null;

  @Column({ name: 'gtin', nullable: true })
  gtin: string;

  @Column({ name: 'pieces_per_small_box', nullable: true, type: 'int' })
  piecesPerSmallBox: number;

  @Column({ name: 'pieces_per_big_box', nullable: true, type: 'int' })
  piecesPerBigBox: number;

  @Column({ name: 'pieces_per_pallet', nullable: true, type: 'int' })
  piecesPerPallet: number;

  @Column({
    name: 'expected_scan',
    type: 'enum',
    enum: ExpectedScanType,
    default: ExpectedScanType.PRODUCT,
  })
  expectedScan: ExpectedScanType;

  @Column({ name: 'aggregation_lvl', nullable: true, type: 'int' })
  aggregationLvl: number;

  @Column({
    name: 'packaging_table_name',
    type: 'varchar',
    length: 63,
    nullable: true,
  })
  packagingTableName: string | null;
}
