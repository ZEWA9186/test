import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as iconv from 'iconv-lite';
import { GS1Parser } from '@valentynb/gs1-parser';

import { getTemplateDirectory } from '../config/config.paths';
import { generateLabel } from './helper';
import { EncodingType } from './types';
import type { TaskEntity } from '../task/entities/task.entity';

const gs1Parser = new GS1Parser();

export interface DmPrintCode {
  code: string;
  date: string;
  id?: number;
}

const PRINT_ENCODING = EncodingType.WIN1251;
const PRINT_DECODING = EncodingType.WIN1251;
interface LabelBuildOptions {
  templateName: string | null;
  packageCode: string;
  number: number;
  description: string;
  date?: string;
  batch?: string;
  id?: string;
}

interface CommonReplacementsInput {
  sscc?: string;
  gs1?: string;
  gs1Dis?: string;
  date?: string;
  batch?: string;
  id?: string;
}
//Заглушка
const NUMBER_PLACEHOLDER = '001';

/** Единый набор плейсхолдеров для всех типов этикеток. */
function buildCommonReplacements(values: CommonReplacementsInput): Record<string, string> {
  return {
    '<SSCC>': values.sscc ?? '',
    '<SSCC_dis>': values.sscc ? `(00)${values.sscc.slice(2)}` : '',
    '<GS1>': values.gs1 ?? '',
    '<GS1_dis>': values.gs1Dis ?? '',
    '<DATE>': values.date ?? '',
    '<PARTY>': values.batch ?? '',
    '<NUMBER>': values.id ?? NUMBER_PLACEHOLDER,
  };
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
  const { templateName, packageCode, number, description, date, batch, id } = options;

  if (!templateName) {
    throw new Error(`Не задана этикетка для ${description}`);
  }

  const template = await readTemplate(templateName);
  const sscc = generateLabel(packageCode, `${number}`);
  const rendered = applyTemplate(template, buildCommonReplacements({ sscc, date, batch, id }));

  return iconv.encode(rendered, PRINT_ENCODING);
}

export async function buildSmallBoxLabelFile(boxNumber: number, task: TaskEntity): Promise<Buffer> {
  return buildLabelFile({
    templateName: task.smallBoxLabel,
    packageCode: '7',
    number: boxNumber,
    description: `малой коробки ${boxNumber}`,
    date: task.dateManufacture.slice(3),
    batch: task.batch,
    id: String(boxNumber),
  });
}

export async function buildBigBoxLabelFile(boxNumber: number, task: TaskEntity): Promise<Buffer> {
  return buildLabelFile({
    templateName: task.bigBoxLabel,
    packageCode: '8',
    number: boxNumber,
    description: `большой коробки ${boxNumber}`,
    date: task.dateManufacture.slice(3),
    batch: task.batch,
    id: String(boxNumber),
  });
}

export async function buildPalletLabelFile(
  palletNumber: number,
  task: TaskEntity,
): Promise<Buffer> {
  return buildLabelFile({
    templateName: task.palletLabel,
    packageCode: '9',
    number: palletNumber,
    description: `паллеты ${palletNumber}`,
    date: task.dateManufacture.slice(3),
    batch: task.batch,
    id: String(palletNumber),
  });
}

function sanitizeDmCode(codeData: string): string {
  return codeData.replaceAll('\u001d', '@').replaceAll('@', '$d029');
}

function formatDmHumanReadable(code: string): string {
  try {
    const humanReadable = gs1Parser.decode(code).denormalized || code;

    // ^FB в ZPL переносит строку по пробелам. Добавляем пробел
    // каждые 11 символов, чтобы переносы были предсказуемыми.
    return humanReadable.replace(/(.{11})(?=.)/g, '$1 ');
  } catch {
    return code.replace(/(.{11})(?=.)/g, '$1 ');
  }
}

function buildCommandsFromTemplate(
  template: string,
  replacements: Record<string, string>,
): string[] {
  return applyTemplate(template, replacements)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildDmValues(code: DmPrintCode): Record<string, string> {
  return buildCommonReplacements({
    gs1: `$1${sanitizeDmCode(code.code)}`,
    gs1Dis: formatDmHumanReadable(code.code),
    date: code.date,
    id: String(code.id),
  });
}

export async function buildDmCodeCommands(code: DmPrintCode): Promise<string[]> {
  const template = await fs.readFile(path.join(getTemplateDirectory(), 'template.prn'), 'utf-8');

  return buildCommandsFromTemplate(template, buildDmValues(code));
}

export async function buildDmBigCodeCommands(code: DmPrintCode): Promise<string[]> {
  const template = await fs.readFile(path.join(getTemplateDirectory(), 'templateBig.prn'), 'utf-8');

  return buildCommandsFromTemplate(template, buildDmValues(code));
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
