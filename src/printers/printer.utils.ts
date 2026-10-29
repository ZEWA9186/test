import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as iconv from 'iconv-lite';

import { getTemplateDirectory } from '../config/config.paths';
import { getBoxNetto, getBoxNettoKG, getNettoUnitKG, generateLabel } from './helper';
import { EncodingType } from './types';
import type { TaskEntity } from '../task/entities/task.entity';

const PRINT_ENCODING = EncodingType.WIN1251;
const PRINT_DECODING = EncodingType.WIN1251;
//Информация для общих реплесментов + частные отдельно
interface LabelBuildOptions {
  templateName: string | null;
  packageCode: string;
  number: number;
  description: string;
  replacements: Record<string, string>;
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [placeholder, value]) => result.replaceAll(placeholder, value),
    template,
  );
}

async function readTemplate(templateName: string): Promise<string> {
  const templatePath = path.join(getTemplateDirectory(), `${templateName}.prn`);
  const data = await fs.readFile(templatePath);

  return iconv.decode(data, PRINT_DECODING);
}

async function buildLabelFile(options: LabelBuildOptions): Promise<Buffer> {
  const { templateName, packageCode, number, description, replacements } = options;

  if (!templateName) {
    throw new Error(`Не задана этикетка для ${description}`);
  }

  const template = await readTemplate(templateName);
  const sscc = generateLabel(packageCode, `${number}`);
  //общие реплесменты
  const rendered = applyTemplate(template, {
    '<gs1128_dis>': `(00)${sscc.slice(2)}`,
    '<gs1128_dm>': sscc,
    //номер упаковки
    '<nnn_pallet>': `${number}`,
    ...replacements,
  });

  return iconv.encode(rendered, PRINT_ENCODING);
}

export async function buildSmallBoxLabelFile(
  boxNumber: number,
  countInBox: number,
  task: TaskEntity,
): Promise<Buffer> {
  return buildLabelFile({
    templateName: task.smallBoxLabel,
    packageCode: '7',
    number: boxNumber,
    description: `малой коробки ${boxNumber}`,
    replacements: {
      '<nnn_pieces_per_package>': `${countInBox}`,
      '<nnn_netto_box>': `${getBoxNetto(task.nettoUnit, countInBox)}`,
      '<nnn_netto_box_kg>': `${getBoxNettoKG(task.nettoUnit, countInBox)}`,
      '<nnn_netto_unit_kg>': `${getNettoUnitKG(task.nettoUnit)}`,
    },
  });
}

export async function buildBigBoxLabelFile(
  boxNumber: number,
  countInBox: number,
  task: TaskEntity,
): Promise<Buffer> {
  return buildLabelFile({
    templateName: task.bigBoxLabel,
    packageCode: '8',
    number: boxNumber,
    description: `большой коробки ${boxNumber}`,
    replacements: {
      '<nnn_pieces_per_package>': `${countInBox}`,
      '<nnn_netto_box>': `${getBoxNetto(task.nettoUnit, countInBox)}`,
      '<nnn_netto_box_kg>': `${getBoxNettoKG(task.nettoUnit, countInBox)}`,
      '<nnn_netto_unit_kg>': `${getNettoUnitKG(task.nettoUnit)}`,
    },
  });
}

export async function buildPalletLabelFile(
  palletNumber: number,
  task: TaskEntity,
  itemsPerPallet: number | null,
): Promise<Buffer> {
  return buildLabelFile({
    templateName: task.palletLabel,
    packageCode: '9',
    number: palletNumber,
    description: `паллеты ${palletNumber}`,
    replacements: {
      '<nnn_items_per_pallet>': itemsPerPallet ? `${itemsPerPallet}` : '',
    },
  });
}

function sanitizeDmCode(codeData: string): string {
  return codeData.replaceAll('\u001d', '@').replaceAll('@', '$d029');
}

function buildCommandsFromTemplate(template: string, code: string): string[] {
  return applyTemplate(template, { '<GS1>': `$1${code}` })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function buildDmCodeCommands(codeData: string): Promise<string[]> {
  const template = await fs.readFile(path.join(getTemplateDirectory(), 'template.prn'), 'utf-8');

  return buildCommandsFromTemplate(template, sanitizeDmCode(codeData));
}

export async function buildDmBigCodeCommands(codeData: string): Promise<string[]> {
  const template = await fs.readFile(path.join(getTemplateDirectory(), 'templateBig.prn'), 'utf-8');

  return buildCommandsFromTemplate(template, sanitizeDmCode(codeData));
}

export function buildDmEmptyLabelCommands(): string[] {
  return [
    'SIZE 18.7 mm, 20.1 mm',
    'GAP 3 mm, 0 mm',
    'DIRECTION 0,0',
    'REFERENCE 0,0',
    'CLS',
    'PRINT 1,1',
  ];
}
