import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { join } from 'path';

import { getJsonDirectory1SRecord, getLocalReportsDirectory } from '../../config/config.paths';

import { TaskEntity } from '../entities/task.entity';
import { ReportRecord, ReportRepository } from './report.repository';

dotenv.config();

interface ReportSmallBox {
  name: string;
  products: string[];
}

interface ReportBoxWithSmallBoxes {
  name: string;
  smallBoxes: string[];
}

interface ReportBoxWithProducts {
  name: string;
  products: string[];
}

interface ReportPallet {
  name: string;
  boxes: string[];
}

type ReportObject = Record<string, unknown>;

@Injectable()
export class ReportService {
  private readonly localReportsDirectory: string;
  private readonly reserveJsonDirectory: string;
  private readonly record1SFileDirectory: string | null;
  private readonly recordTXTFileDirectory: string;

  constructor(private readonly reportRepository: ReportRepository) {
    this.localReportsDirectory = getLocalReportsDirectory();
    this.record1SFileDirectory = getJsonDirectory1SRecord();
    this.recordTXTFileDirectory = this.localReportsDirectory;
  }

  /** Формирует отчёт и сохраняет его так же, как старая реализация. */
  async buildAndSaveReport(task: TaskEntity): Promise<ReportObject> {
    const records = await this.reportRepository.getAllReport(task);
    const report = this.createTermetReport(task, records);
    const fileName = this.getReportFileName(task.id);

    // Основной JSON-файл.
    await this.writeToRecordsFile(report, path.join(this.localReportsDirectory, fileName));

    try {
      await this.createCodesTextFile(
        records.map((record) => record.code),
        task.id,
      );
    } catch (error) {
      console.error(`Не удалось создать TXT-файл с кодами задания ${task.id}`, error);
    }

    await this.saveExternalCopy(report, fileName);

    return report;
  }

  private createTermetReport(task: TaskEntity, records: ReportRecord[]): ReportObject {
    const header = this.createDefaultHeader(task);
    const hasSmallBoxes = records.some((record) => Boolean(record.smallBoxLabel));

    const palletsMap = new Map<string, Set<string>>();

    for (const record of records) {
      if (!record.palletLabel) {
        continue;
      }

      const boxes = palletsMap.get(record.palletLabel) ?? new Set<string>();

      if (record.bigBoxLabel) {
        boxes.add(record.bigBoxLabel);
      }

      palletsMap.set(record.palletLabel, boxes);
    }

    const pallets: ReportPallet[] = Array.from(palletsMap.entries()).map(([name, boxes]) => ({
      name,
      boxes: Array.from(boxes),
    }));

    if (hasSmallBoxes) {
      const smallBoxesMap = new Map<string, string[]>();
      const boxesMap = new Map<string, Set<string>>();

      for (const record of records) {
        if (record.smallBoxLabel) {
          const products = smallBoxesMap.get(record.smallBoxLabel) ?? [];
          products.push(record.code);
          smallBoxesMap.set(record.smallBoxLabel, products);
        }

        if (record.bigBoxLabel) {
          const smallBoxes = boxesMap.get(record.bigBoxLabel) ?? new Set<string>();

          if (record.smallBoxLabel) {
            smallBoxes.add(record.smallBoxLabel);
          }

          boxesMap.set(record.bigBoxLabel, smallBoxes);
        }
      }

      const smallBoxes: ReportSmallBox[] = Array.from(smallBoxesMap.entries()).map(
        ([name, products]) => ({
          name,
          products,
        }),
      );

      const boxes: ReportBoxWithSmallBoxes[] = Array.from(boxesMap.entries()).map(
        ([name, smallBoxes]) => ({
          name,
          smallBoxes: Array.from(smallBoxes),
        }),
      );

      return {
        ...header,
        units: {
          smallBoxes,
          boxes,
          pallets,
        },
      };
    }

    const boxesMap = new Map<string, string[]>();

    for (const record of records) {
      if (!record.bigBoxLabel) {
        continue;
      }

      const products = boxesMap.get(record.bigBoxLabel) ?? [];
      products.push(record.code);
      boxesMap.set(record.bigBoxLabel, products);
    }

    const boxes: ReportBoxWithProducts[] = Array.from(boxesMap.entries()).map(
      ([name, products]) => ({
        name,
        products,
      }),
    );

    return {
      ...header,
      units: {
        boxes,
        pallets,
      },
    };
  }

  private createDefaultHeader(task: TaskEntity) {
    return {
      docId: task.docId || '20240724-2401',
      level: task.aggregationLvl,
      gtin: task.gtin,
      ManufactureDate: task.dateManufacture || '',
      BBD: task.dateExpiration || '',
      Batch: task.batch || '',
      description: task.description || '',
    };
  }

  private getReportFileName(taskId: number): string {
    return `task_${taskId}_records.json`;
  }

  private async saveExternalCopy(data: ReportObject, fileName: string): Promise<void> {
    try {
      if (!this.record1SFileDirectory) {
        return;
      }

      await this.writeToRecordsFile(data, path.join(this.record1SFileDirectory, fileName));
    } catch (error) {
      console.error(`Не удалось сохранить отчёт во внешний источник: ${fileName}`, error);

      const reservePath = path.join(this.reserveJsonDirectory, fileName);

      console.warn(`Сохраняем резервную копию отчёта: ${reservePath}`);

      await this.writeToRecordsFile(data, reservePath);
    }
  }

  private async createCodesTextFile(codes: string[], taskId: number): Promise<void> {
    if (codes.length === 0) {
      console.warn(`Для задания ${taskId} нет кодов для TXT-файла`);
      return;
    }

    const filePath = join(this.recordTXTFileDirectory, `task_${taskId}_codes.txt`);

    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, codes.join('\n'), 'utf8');

    console.info(`TXT-файл с кодами создан: ${filePath}`);
  }

  async writeToRecordsFile(data: unknown, filePath: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
