import { ExpectedScanType } from '../entities/active-task.entity';

const SCAN_TYPE_LABELS: Record<ExpectedScanType, string> = {
  [ExpectedScanType.PRODUCT]: 'товар',
  [ExpectedScanType.SMALL_BOX_LABEL]: 'малая коробка',
  [ExpectedScanType.BIG_BOX_LABEL]: 'коробка',
  [ExpectedScanType.PALLET_LABEL]: 'паллета',
};

export function getScanTypeLabel(scanType: ExpectedScanType): string {
  return SCAN_TYPE_LABELS[scanType] ?? scanType;
}

export type GrammaticalCase =
  'genitive' | 'dative' | 'accusative' | 'instrumental' | 'prepositional';

const SCAN_TYPE_FORMS_BY_CASE: Record<ExpectedScanType, Record<GrammaticalCase, string>> = {
  [ExpectedScanType.PRODUCT]: {
    genitive: 'товара',
    dative: 'товару',
    accusative: 'товар',
    instrumental: 'товаром',
    prepositional: 'товаре',
  },
  [ExpectedScanType.SMALL_BOX_LABEL]: {
    genitive: 'малой коробки',
    dative: 'малой коробке',
    accusative: 'малую коробку',
    instrumental: 'малой коробкой',
    prepositional: 'малой коробке',
  },
  [ExpectedScanType.BIG_BOX_LABEL]: {
    genitive: 'коробки',
    dative: 'коробке',
    accusative: 'коробку', // «положите в коробку»
    instrumental: 'коробкой',
    prepositional: 'коробке', // «найдено в коробке»
  },
  [ExpectedScanType.PALLET_LABEL]: {
    genitive: 'паллеты',
    dative: 'паллете',
    accusative: 'паллету',
    instrumental: 'паллетой',
    prepositional: 'паллете',
  },
};

export function getScanTypeLabelInCase(
  scanType: ExpectedScanType,
  grammaticalCase: GrammaticalCase = 'prepositional',
): string {
  return SCAN_TYPE_FORMS_BY_CASE[scanType]?.[grammaticalCase] ?? getScanTypeLabel(scanType);
}

export function getScanTypeLabelPrepositional(scanType: ExpectedScanType): string {
  return getScanTypeLabelInCase(scanType, 'prepositional');
}
