import {
  HttpException,
  HttpStatus,
  Injectable,
  LoggerService,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import {logger1S} from "../logger-winston/winston.config";
import {
  getJsonDirectory1S,
  getLineTaskDirectory,
  initDirectories
} from '../path.utils';
import * as dotenv from 'dotenv';
import {CodeService} from "../code/code.service";
import {TaskCheckResult} from "./dto/task-check-result";
import { Repository } from 'typeorm';
import { TaskEntity } from './entities/task.entity';
import { JsonValidationService } from './validate.json';
import { CodeEntity } from '../code/entities/code.entity';
import { TaskCodes } from './entities/task-codes';

dotenv.config();
const interval = Number(process.env.CHECK_1S_INTERVAL) || 60000;

@Injectable()
export class Task1sService implements OnModuleInit {
  private files: string[] = [];
  private filesIn: string[] = [];
  private checkInterval: NodeJS.Timeout;
  constructor(
    private readonly codeService: CodeService,
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly jsonValidationService: JsonValidationService,
    private readonly codeRepository: Repository<TaskCodes>,
  ) {}

  async onModuleInit() {
    await initDirectories();

    await this.checkFilesInDirectory();
    logger1S.debug('Запуск проверки файлов от 1С...');

    this.checkInterval = setInterval(
      () => this.checkFilesInDirectory(),
      interval,
    );
  }

  async onApplicationShutdown() {
    // Очищаем интервал при остановке приложения
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  async checkFilesInDirectory() {
    const directoryPath = getJsonDirectory1S();

    const allFiles = await fs.promises.readdir(directoryPath);
    this.filesIn = allFiles.filter((file) => file.endsWith('.in'));

    if (this.filesIn.length === 0) {
      return [{ success: false, message: 'Нет файлов заданий от 1С' }];
    }

    const validInFiles = this.filesIn.filter((fileIn) =>
      allFiles.includes(fileIn.replace('.in', '.json')),
    );
    const result = [];
    for (const fileIn of validInFiles) {
      result.push(await this.processSingleFile(fileIn, directoryPath));
    }
    return result;
  }

  async processApiTask(jsonParsed: any) {
    const result = await this.processTaskPayload(jsonParsed);
    if (!result.success) {
      throw new HttpException(result, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  private async processSingleFile(
    fileIn: string,
    directoryPath: string,
  ): Promise<TaskCheckResult> {
    const jsonFileName = fileIn.replace('.in', '.json');
    const jsonFilePath = path.join(directoryPath, jsonFileName);
    const inFilePath = path.join(directoryPath, fileIn);

    try {
      const jsonData = await fs.promises.readFile(jsonFilePath, 'utf-8');
      const jsonParsed = JSON.parse(jsonData.trim());

      const result = await this.processTaskPayload(jsonParsed);

      await fs.promises.writeFile(
        inFilePath,
        JSON.stringify(this.format1sResponse(result), null, 2),
      );

      const outFilePath = inFilePath.replace('.in', '.out');
      await fs.promises.rename(inFilePath, outFilePath);

      if (result.success) {
        return {
          success: true,
          message: `Файл ${jsonFileName} успешно проверен и сохранен`,
        };
      } else {
        return {
          success: false,
          items: result.items,
          errors: result.errors,
          message: `Файл ${jsonFileName} содержит ошибки валидации`,
        };
      }
    } catch (error: any) {
      logger1S.error(
        `Ошибка при обработке файла ${fileIn}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        errors: error.message,
        message: `Ошибка обработки ${fileIn}`,
      };
    }
  }

  private async processTaskPayload(jsonParsed: any): Promise<TaskCheckResult> {
    const { errors, items } =
      await this.jsonValidationService.validateJson(jsonParsed);

    const codesToCheck = Array.isArray(jsonParsed.codes)
      ? jsonParsed.codes
      : [];
    const existingCodes = await this.codeService.getCodes(codesToCheck);

    if (existingCodes.length > 0) {
      errors.push('Обнаружены дубликаты в базе данных');
      items.push('codes');
    }

    if (errors.length > 0) {
      return { success: false, errors, items };
    }

    const taskEntity = this.taskRepository.create({
      ...jsonParsed,
      codes: codesToCheck.map((codeStr: string) => ({ code: codeStr })),
    });

    try {
      const savedTask = await this.taskRepository.save(taskEntity);

      const targetDir = getLineTaskDirectory(jsonParsed.line);
      await fs.promises.mkdir(targetDir, { recursive: true });

      const newFileName = this.generateFilename(jsonParsed);
      const taskFilePath = path.join(targetDir, newFileName);

      await fs.promises.writeFile(
        taskFilePath,
        JSON.stringify(savedTask, null, 2).trim(),
      );

      return { success: true };
    } catch (err: any) {
      errors.push(
        `
        Ошибка сохранения в базу
        ${err.message}
      `,
      );
      logger1S.error(`Ошибка сохранения в базу, ${err.message}`);
      return { success: false, errors, items };
    }
  }

  private format1sResponse(result: TaskCheckResult) {
    return {
      errors: [
        { status: !result.success },
        ...(result.errors || []).map((err) => ({ message: err })),
      ],
      items: !result.success ? result.items : undefined,
    };
  }

  private generateFilename(jsonData: any): string {
    const gtin = jsonData.gtin || '';
    const itf14 = jsonData.ITF14 ? `_${jsonData.ITF14}` : '';
    const batch = jsonData.batch || '';

    const cleanGtin = gtin.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanItf14 = itf14.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanBatch = batch.replace(/[^a-zA-Z0-9_-]/g, '');

    return `${cleanGtin}${cleanItf14}_${cleanBatch}.json`;
  }

  public async getFiles(): Promise<string[]> {
    return this.files;
  }

  public async refreshFiles(): Promise<string[]> {
    await this.checkFilesInDirectory();
    const directoryPath = getJsonDirectory1S();
    const allFiles = await fs.promises.readdir(directoryPath);
    return allFiles.filter((file) => file.endsWith('.json'));
  }

  public async deleteCodes(taskId: number) {
    try {
      const result = await this.codeRepository.delete({ taskId });
      return {
        success: true,
        deletedCount: result.affected ?? 0,
      };
    } catch (err: any) {
      logger1S.error(
        `[TASK_CODES] Ошибка при удалении кодов для задачи ${taskId}:`,
        err.message,
      );
      throw err;
    }
  }
}