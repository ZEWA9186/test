import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { join } from 'path';
import { Logger } from 'winston';

import { FTPService } from 'src/ftp/ftp.service';
import { reportLogger } from 'src/logger-winston/winston.config';
import { getLocalReportsDirectory, getReserveFilesDirectory } from 'src/path.util';
import { ReportType } from './types';
import { ArchivedReportData, ReportRepository } from './report.repository';
import {
  AggregationLevel,
  createDefaultHeader,
  createDatabyBarcodes,
  createReportHeaderDataby,
  createReportHeaderSKMark,
  createReportPackages,
  createSKMarkReport,
  generateFullReportDataby,
  ReportTaskData,
} from './reports-helper';

dotenv.config();

type TaskSnapshot = Record<string, unknown>;

type ReportObject = Record<string, unknown>;

@Injectable()
export class ReportService {
  private readonly reportType: ReportType;
  private readonly isFTP: boolean;
  private readonly localReportsDirectory: string;
  private readonly reserveJsonDirectory: string;
  private readonly record1SFileDirectory: string | null;
  private readonly recordTXTFileDirectory: string;

  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly ftpService: FTPService,
    @Inject('winston') private readonly logger: Logger = reportLogger,
  ) {
    this.reportType = (process.env.REPORT_TYPE as ReportType) || ReportType.Termet;
    this.isFTP = process.env.IS_FTP === 'true';

    this.localReportsDirectory = getLocalReportsDirectory();
    this.reserveJsonDirectory = getReserveFilesDirectory();
    this.record1SFileDirectory = process.env.FILES_DIRECTORY_1S_RECORD || null;
    this.recordTXTFileDirectory =
      process.env.FILES_DIRECTORY_TXT_RECORD || this.localReportsDirectory;
  }

  /** Формирует отчёт по ID уже архивированного задания. */
  async buildReport(
    taskId: number,
    startMonitoringDate?: string,
    endMonitoringDate?: string,
  ): Promise<ReportObject> {
    const source = await this.loadArchivedTask(taskId);
    return this.createReport(source, startMonitoringDate, endMonitoringDate);
  }

  /** Формирует и сохраняет отчёт, не обращаясь к уже удалённым рабочим таблицам. */
  async buildAndSaveReport(
    taskId: number,
    startMonitoringDate?: string,
    endMonitoringDate?: string,
  ): Promise<ReportObject> {
    const source = await this.loadArchivedTask(taskId);
    const report = this.createReport(source, startMonitoringDate, endMonitoringDate);
    const fileName = this.getReportFileName(taskId);

    await this.writeToRecordsFile(report, path.join(this.localReportsDirectory, fileName));

    try {
      await this.createCodesTextFile(source.records.map((record) => record.code), taskId);
    } catch (error) {
      this.logger.error(`Не удалось создать TXT-файл с кодами задания ${taskId}`, error);
    }

    await this.saveExternalCopy(report, fileName);
    return report;
  }

  private async loadArchivedTask(taskId: number): Promise<ArchivedReportData> {
    if (!Number.isInteger(taskId) || taskId <= 0) {
      throw new BadRequestException(`Некорректный ID задания: ${taskId}`);
    }

    const source = await this.reportRepository.getReportData(taskId);
    if (!source) {
      throw new NotFoundException(`Архивное задание ${taskId} не найдено`);
    }

    return source;
  }

  private createReport(
    source: ArchivedReportData,
    startMonitoringDate?: string,
    endMonitoringDate?: string,
  ): ReportObject {
    const task = this.mapHistoryToTask(source);
    const startDate = startMonitoringDate || this.getStartDate(source);
    const endDate = endMonitoringDate || this.toDateTime(source.history.closedAt);

    switch (this.reportType) {
      case ReportType.Databy:
        return this.buildDatabyReport(task, source, startDate, endDate);
      case ReportType.SKMark:
        return this.buildSKMarkReport(task, source, startDate, endDate);
      default:
        return this.buildTermetReport(task, source, startDate, endDate);
    }
  }

  private buildDatabyReport(
    task: ReportTaskData,
    source: ArchivedReportData,
    startDate: string,
    endDate: string,
  ): ReportObject {
    const header = createReportHeaderDataby(task, startDate, endDate);
    const barcodes = createDatabyBarcodes(source.records, task.aggregationLvl);

    // Нижний регистр units сохранён для совместимости с прежним сервисом.
    return {
      ...header,
      units: generateFullReportDataby(barcodes),
    };
  }

  private buildSKMarkReport(
    task: ReportTaskData,
    source: ArchivedReportData,
    startDate: string,
    endDate: string,
  ): ReportObject {
    const packages = createReportPackages(source.records, task.aggregationLvl);
    const units = createSKMarkReport(source.records, task.aggregationLvl);
    const header = createReportHeaderSKMark(
      startDate,
      endDate,
      {
        totalCodes: source.records.length,
        // Уровень 1 — товар -> паллета, поэтому коробок нет.
        totalBoxes: packages.smallBoxes.length + packages.bigBoxes.length,
        totalPallets: packages.pallets.length,
      },
      task,
    );

    return {
      Type: 'Mark',
      MarkList: [
        {
          ...header,
          Units: units,
          Unused: {
            unusedCodes: source.history.unusedCodes ?? [],
          },
        },
      ],
    };
  }

  private buildTermetReport(
    task: ReportTaskData,
    source: ArchivedReportData,
    startDate: string,
    endDate: string,
  ): ReportObject {
    const header = createDefaultHeader(task, startDate, endDate);
    const packages = createReportPackages(source.records, task.aggregationLvl);

    // Не меняем верхний контракт Termet: уровень 1 — массив boxes,
    // уровни 2/3 — объект с boxes и pallets. В уровне 3 малые коробки
    // находятся внутри своей большой коробки.
    const units =
      task.aggregationLvl === 1
        ? packages.boxes
        : {
            boxes: packages.boxes,
            pallets: packages.pallets,
          };

    return {
      ...header,
      units,
    };
  }

  /** Преобразует поля сущности архива в небольшой тип, нужный форматам отчёта. */
  private mapHistoryToTask(source: ArchivedReportData): ReportTaskData {
    const { history } = source;
    const snapshot = (history.taskSnapshot ?? {}) as TaskSnapshot;
    const aggregationLevel = Number(snapshot.aggregationLvl);

    if (aggregationLevel !== 1 && aggregationLevel !== 2 && aggregationLevel !== 3) {
      throw new BadRequestException(
        `В архиве задания ${history.id} некорректный уровень агрегации: ${String(snapshot.aggregationLvl)}`,
      );
    }

    return {
      id: history.id,
      docId: this.stringValue(snapshot.docId) ?? String(history.id),
      gtin: history.gtin ?? this.stringValue(snapshot.gtin) ?? '',
      ITF14: this.stringValue(snapshot.ITF14),
      batch: history.batch ?? this.stringValue(snapshot.batch) ?? '',
      dateManufacture: history.dateManufacture,
      dateExpiration:
        this.stringValue(snapshot.dateExpiration) ?? this.stringValue(snapshot.date_expiration),
      orderIdentifier: this.stringValue(snapshot.orderIdentifier) ?? '',
      name: history.name ?? this.stringValue(snapshot.name) ?? '',
      description: this.stringValue(snapshot.description) ?? history.name ?? '',
      aggregationLvl: aggregationLevel as AggregationLevel,
      // Поле написано именно так в старом контракте Termet.
      lavel: String(aggregationLevel),
    };
  }

  private stringValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return String(value);
  }

  private getStartDate(source: ArchivedReportData): string {
    if (source.records.length > 0) {
      return this.toDateTime(source.records[0].createdAt);
    }
    return this.toDateTime(source.history.closedAt);
  }

  private toDateTime(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Некорректная дата в архиве: ${String(value)}`);
    }
    return date.toISOString();
  }

  private getReportFileName(taskId: number): string {
    return `task_${taskId}_records.json`;
  }

  private async saveExternalCopy(data: ReportObject, fileName: string): Promise<void> {
    try {
      if (this.isFTP) {
        await this.ftpService.uploadFile(data, fileName);
        return;
      }

      if (!this.record1SFileDirectory) {
        return;
      }

      await this.writeToRecordsFile(data, path.join(this.record1SFileDirectory, fileName));
    } catch (error) {
      this.logger.error(`Не удалось сохранить отчёт во внешний источник: ${fileName}`, error);
      const reservePath = path.join(this.reserveJsonDirectory, fileName);
      this.logger.warn(`Сохраняем резервную копию отчёта: ${reservePath}`);
      await this.writeToRecordsFile(data, reservePath);
    }
  }

  private async createCodesTextFile(codes: string[], taskId: number): Promise<void> {
    if (codes.length === 0) {
      this.logger.warn(`Для задания ${taskId} нет кодов для TXT-файла`);
      return;
    }

    const filePath = join(this.recordTXTFileDirectory, `task_${taskId}_codes.txt`);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, codes.join('\n'), 'utf8');
    this.logger.info(`TXT-файл с кодами создан: ${filePath}`);
  }

  async writeToRecordsFile(data: unknown, filePath: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
