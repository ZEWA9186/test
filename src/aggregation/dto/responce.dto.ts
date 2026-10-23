import { ExpectedScanType } from '../entities/active-task.entity';

export class AggregationParentsDto {
  smallBox: string | null;
  bigBox: string | null;
  pallet: string | null;
}

export class AggregationInfoDto {
  scanType: ExpectedScanType;
  label: string | null;
  parents: AggregationParentsDto;
  contentsCount: number | null;
  contentsType: ExpectedScanType | null;
  aggregationLvl: number;
}
export interface ContainerFillStats {
  label: string;
  actualCount: number;
  expectedCount: number;
  isFull: boolean;
  isOverfilled: boolean;
  missingCount: number;
  productCodes: string[];
}

export interface TaskPackagingStats {
  totalRecords: number;
  isValid: boolean;

  productsWithoutPackaging: string[];
  smallBoxesWithoutBigBox: string[];
  bigBoxesWithoutPallet: string[];

  productsWithoutPackagingCount: number;
  smallBoxesWithoutBigBoxCount: number;
  bigBoxesWithoutPalletCount: number;

  smallBoxes: ContainerFillStats[];
  bigBoxes: ContainerFillStats[];
  pallets: ContainerFillStats[];
}

export class AggregationPositionDto {
  current!: number;
  limit!: number;
}

export class AggregationResponseDto {
  smallBox?: AggregationPositionDto | null;
  bigBox!: AggregationPositionDto | null;
  pallet!: AggregationPositionDto | null;

  expectedScan!: ExpectedScanType;
}
