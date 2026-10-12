import { ExpectedScanType } from '../entities/active-task.entity';

export class AggregationParentsDto {
  smallBox: string | null;
  bigBox: string | null;
  pallet: string | null;
}

export class AggregationInfoDto {
  scanType: ExpectedScanType;
  code: string;
  number: string | null;
  parents: AggregationParentsDto;
  contentsCount: number | null;
  contentsType: ExpectedScanType | null;
}
