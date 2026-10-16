import type { TaskHistoryPackagingEntity } from '../history/entity/task-history-packaging.entity';

export type AggregationLevel = 1 | 2 | 3;

/** Только те данные задания, которые реально используются в форматах отчёта. */
export interface ReportTaskData {
  id: number;
  docId: string;
  gtin: string;
  ITF14: string | null;
  batch: string;
  dateManufacture: string | null;
  dateExpiration: string | null;
  orderIdentifier: string;
  name: string;
  description: string;
  aggregationLvl: AggregationLevel;
  /** Историческое имя поля внешнего формата Termet. */
  lavel: string;
}

export interface ReportUnit {
  name: string;
  products: string[];
  /** Дополнительный уровень для заданий агрегации 3. */
  smallBoxes?: ReportUnit[];
}

export interface ReportPallet {
  name: string;
  boxes: string[];
}

/** Внутренняя модель упаковок, из неё сервис выбирает нужный внешний формат. */
export interface ReportPackages {
  /** Для уровня 1 — паллеты с товарами; для уровней 2/3 — большие коробки. */
  boxes: ReportUnit[];
  smallBoxes: ReportUnit[];
  bigBoxes: ReportUnit[];
  pallets: ReportPallet[];
}

export interface DatabyNode {
  Barcode: string;
  Level: number;
  NumberInTask: number;
  Weight: null;
  ChildBarcodes: DatabyNode[];
}

export interface SKMarkUnit {
  Level: number;
  Aggregate: string;
  Labels: string[];
}

const dateOnly = (value: string | Date | null | undefined): string | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Некорректная дата в архивном задании');
    }
    return value.toISOString().slice(0, 10);
  }

  const input = String(value).trim();
  const isoMatch = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(input);
  if (isoMatch) {
    return isoMatch[1];
  }

  const dotMatch = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);
  if (dotMatch) {
    return `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
  }

  throw new Error(`Неверный формат даты: "${input}". Ожидается YYYY-MM-DD или DD.MM.YYYY`);
};

const unique = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

const groupByLabel = (
  records: TaskHistoryPackagingEntity[],
  getLabel: (record: TaskHistoryPackagingEntity) => string | null,
): Map<string, TaskHistoryPackagingEntity[]> => {
  const groups = new Map<string, TaskHistoryPackagingEntity[]>();

  for (const record of records) {
    const label = getLabel(record);
    if (!label) continue;

    const group = groups.get(label);
    if (group) {
      group.push(record);
    } else {
      groups.set(label, [record]);
    }
  }

  return groups;
};

export const createReportHeaderDataby = (
  task: ReportTaskData,
  startMonitoringDate: string,
  endMonitoringDate: string,
): Record<string, unknown> => ({
  ExporterCode: 0,
  Code: 0,
  ClaimNumber: 0,
  PartnerCode: null,
  MarkTemplateCode: 0,
  LineCode: 2,
  StartTime: startMonitoringDate,
  CloseTime: endMonitoringDate,
  Attributes: [
    { IsMarkReport: false, Code: 4, Value: task.gtin || null },
    { IsMarkReport: false, Code: 5, Value: task.ITF14 || task.gtin || null },
    { IsMarkReport: false, Code: 1, Value: task.batch || null },
    { IsMarkReport: false, Code: 2, Value: dateOnly(task.dateManufacture) },
    { IsMarkReport: false, Code: 3, Value: dateOnly(task.dateExpiration) },
  ],
});

export const createReportHeaderSKMark = (
  startMonitoringDate: string,
  endMonitoringDate: string,
  total: { totalCodes: number; totalBoxes: number; totalPallets: number },
  task: ReportTaskData,
): Record<string, unknown> => ({
  DocId: task.docId || `SK-mark-${task.id}`,
  StartDate: startMonitoringDate,
  EndDate: endMonitoringDate,
  QuantityOfProducts: total.totalCodes,
  QuantityOfPacks: total.totalBoxes,
  QuantityOfPalets: total.totalPallets,
  Gtin: task.gtin || '',
  // В исходном SKMark даты передавались в формате задания без преобразования.
  ManufactureDate: task.dateManufacture || '',
  BBD: task.dateExpiration || '',
  Batch: task.batch || '',
  OrderIdentifier: task.orderIdentifier || '',
});

export const createDefaultHeader = (
  task: ReportTaskData,
  startMonitoringDate: string,
  endMonitoringDate: string,
): Record<string, unknown> => ({
  docId: task.docId || String(task.id),
  StartDate: startMonitoringDate,
  lavel: task.lavel,
  EndDate: endMonitoringDate,
  gtin: task.gtin,
  // Termet тоже получает исходное представление дат, как и в прежнем helper.
  ManufactureDate: task.dateManufacture || '',
  BBD: task.dateExpiration || '',
  Batch: task.batch,
  description: task.description,
});

export const generateFullReportDataby = (barcodesArray: DatabyNode[]): Record<string, unknown> => ({
  TaskMarks: [{ Barcodes: barcodesArray }],
});

/**
 * Восстанавливает упаковки из сохранённых этикеток.
 * Внешняя Termet-структура остаётся прежней: плоский массив на уровне 1,
 * объект { boxes, pallets } на уровнях 2 и 3. Для уровня 3 малая коробка
 * добавлена внутрь соответствующей большой коробки, не меняя верхний контракт.
 */
export const createReportPackages = (
  records: TaskHistoryPackagingEntity[],
  aggregationLevel: AggregationLevel,
): ReportPackages => {
  const smallBoxGroups = groupByLabel(records, (record) => record.smallBoxLabel);
  const bigBoxGroups = groupByLabel(records, (record) => record.bigBoxLabel);
  const palletGroups = groupByLabel(records, (record) => record.palletLabel);

  const smallBoxes: ReportUnit[] = [...smallBoxGroups.entries()].map(([name, rows]) => ({
    name,
    products: rows.map((row) => row.code),
  }));

  const bigBoxes: ReportUnit[] = [...bigBoxGroups.entries()].map(([name, rows]) => {
    const box: ReportUnit = {
      name,
      products:
        aggregationLevel === 2
          ? rows.map((row) => row.code)
          : rows.filter((row) => !row.smallBoxLabel).map((row) => row.code),
    };

    if (aggregationLevel === 3) {
      box.smallBoxes = [...groupByLabel(rows, (row) => row.smallBoxLabel).entries()].map(
        ([smallBoxName, smallBoxRows]) => ({
          name: smallBoxName,
          products: smallBoxRows.map((row) => row.code),
        }),
      );
    }

    return box;
  });

  const pallets: ReportPallet[] = [...palletGroups.entries()].map(([name, rows]) => ({
    name,
    boxes: aggregationLevel >= 2 ? unique(rows.map((row) => row.bigBoxLabel)) : [],
  }));

  // В старом контракте Termet для уровня 1 используется плоский массив boxes.
  // На этом уровне единственный агрегат — паллета, содержащая непосредственно товары.
  const boxes: ReportUnit[] =
    aggregationLevel === 1
      ? [...palletGroups.entries()].map(([name, rows]) => ({
          name,
          products: rows.map((row) => row.code),
        }))
      : bigBoxes;

  return {
    boxes,
    smallBoxes,
    bigBoxes,
    pallets,
  };
};

/** Формирует Units в формате SKMark: каждый родитель содержит этикетки непосредственных детей. */
export const createSKMarkReport = (
  records: TaskHistoryPackagingEntity[],
  aggregationLevel: AggregationLevel,
): SKMarkUnit[] => {
  const units: SKMarkUnit[] = [];
  const smallBoxGroups = groupByLabel(records, (record) => record.smallBoxLabel);
  const bigBoxGroups = groupByLabel(records, (record) => record.bigBoxLabel);
  const palletGroups = groupByLabel(records, (record) => record.palletLabel);

  const addUnits = (
    groups: Map<string, TaskHistoryPackagingEntity[]>,
    level: number,
    labels: (rows: TaskHistoryPackagingEntity[]) => string[],
  ): void => {
    for (const [label, rows] of groups) {
      units.push({ Level: level, Aggregate: label, Labels: labels(rows) });
    }
  };

  if (aggregationLevel === 1) {
    addUnits(palletGroups, 1, (rows) => rows.map((row) => row.code));
    return units;
  }

  if (aggregationLevel === 2) {
    addUnits(bigBoxGroups, 1, (rows) => rows.map((row) => row.code));
    addUnits(palletGroups, 2, (rows) => unique(rows.map((row) => row.bigBoxLabel)));
    return units;
  }

  addUnits(smallBoxGroups, 1, (rows) => rows.map((row) => row.code));
  addUnits(bigBoxGroups, 2, (rows) => unique(rows.map((row) => row.smallBoxLabel)));
  addUnits(palletGroups, 3, (rows) => unique(rows.map((row) => row.bigBoxLabel)));

  return units;
};

const makeDatabyNode = (barcode: string, level: number, numberInTask: number): DatabyNode => ({
  Barcode: barcode,
  Level: level,
  NumberInTask: numberInTask,
  Weight: null,
  ChildBarcodes: [],
});

/** Восстанавливает дерево Databy только по этикеткам, сохранённым в архиве. */
export const createDatabyBarcodes = (
  records: TaskHistoryPackagingEntity[],
  aggregationLevel: AggregationLevel,
): DatabyNode[] => {
  const palletNodes = new Map<string, DatabyNode>();
  const bigBoxNodes = new Map<string, DatabyNode>();
  const smallBoxNodes = new Map<string, DatabyNode>();
  const containerNumbers = new Map<string, number>();
  let nextContainerNumber = 1;

  const getContainerNumber = (key: string): number => {
    let value = containerNumbers.get(key);
    if (value === undefined) {
      value = nextContainerNumber++;
      containerNumbers.set(key, value);
    }
    return value;
  };

  for (const record of records) {
    // Без этикетки паллеты нельзя достоверно поместить запись в дерево Databy.
    if (!record.palletLabel) continue;

    let palletNode = palletNodes.get(record.palletLabel);
    if (!palletNode) {
      palletNode = makeDatabyNode(
        record.palletLabel,
        aggregationLevel,
        getContainerNumber(`pallet:${record.palletLabel}`),
      );
      palletNodes.set(record.palletLabel, palletNode);
    }

    let targetNode = palletNode;

    if (aggregationLevel >= 2 && record.bigBoxLabel) {
      let bigBoxNode = bigBoxNodes.get(record.bigBoxLabel);
      if (!bigBoxNode) {
        bigBoxNode = makeDatabyNode(
          record.bigBoxLabel,
          aggregationLevel - 1,
          getContainerNumber(`big:${record.bigBoxLabel}`),
        );
        bigBoxNodes.set(record.bigBoxLabel, bigBoxNode);
        palletNode.ChildBarcodes.push(bigBoxNode);
      }
      targetNode = bigBoxNode;
    }

    if (aggregationLevel === 3 && record.smallBoxLabel) {
      let smallBoxNode = smallBoxNodes.get(record.smallBoxLabel);
      if (!smallBoxNode) {
        smallBoxNode = makeDatabyNode(
          record.smallBoxLabel,
          1,
          getContainerNumber(`small:${record.smallBoxLabel}`),
        );
        smallBoxNodes.set(record.smallBoxLabel, smallBoxNode);
        targetNode.ChildBarcodes.push(smallBoxNode);
      }
      targetNode = smallBoxNode;
    }

    targetNode.ChildBarcodes.push({
      Barcode: record.code,
      Level: 0,
      NumberInTask: record.id,
      Weight: null,
      ChildBarcodes: [],
    });
  }

  return [...palletNodes.values()];
};
