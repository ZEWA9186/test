import { ExpectedScanType } from '../entities/active-task.entity';

const SCAN_TYPE_LABELS: Record<ExpectedScanType, string> = {
  [ExpectedScanType.PRODUCT]: 'товар',
  [ExpectedScanType.SMALL_BOX_LABEL]: 'малый короб',
  [ExpectedScanType.BIG_BOX_LABEL]: 'большой короб',
  [ExpectedScanType.PALLET_LABEL]: 'паллета',
};

/** Человекочитаемое название типа скана для сообщений фронту. */
export function getScanTypeLabel(scanType: ExpectedScanType): string {
  return SCAN_TYPE_LABELS[scanType] ?? scanType;
}
