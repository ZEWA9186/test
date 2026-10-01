import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { logger1S } from '../logger-winston/winston.config';
import {
  getJsonDirectory1S,
  getLineTaskDirectory,
  initDirectories,
} from '../path.utils';
import * as dotenv from 'dotenv';
import { TaskCheckResult } from './dto/task-check-result';
import { Repository } from 'typeorm';
import { TaskEntity } from './entities/task.entity';
import { JsonValidationService } from './validation/json-validate.service';
import { TaskCodesEntity } from './entities/task-codes.entity';
import { InjectRepository } from '@nestjs/typeorm';

dotenv.config();
const interval = Number(process.env.CHECK_1S_INTERVAL) || 60000;

@Injectable()
export class Task1sService implements OnModuleInit {
  private files: string[] = [];
  private filesIn: string[] = [];
  private checkInterval: NodeJS.Timeout;

  private processingQueue: Promise<any> = Promise.resolve();

  // Очередь для изоляции
  private async enqueueTask<T>(taskFn: () => Promise<T>): Promise<T> {
    const queuedTask = this.processingQueue.then(() => taskFn());
    this.processingQueue = queuedTask.catch(() => {});
    return queuedTask;
  }

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly jsonValidationService: JsonValidationService,
    @InjectRepository(TaskCodesEntity)
    private readonly taskCodesEntityRepository: Repository<TaskCodesEntity>,
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

  public async processApiTask(jsonParsed: any) {
    const result = await this.processTaskPayload(jsonParsed);
    if (!result.success) {
      throw new HttpException(result, HttpStatus.BAD_REQUEST);
    }
    return result;
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

  public async deleteTask(id: number) {
    try {
      await this.taskRepository.delete({ id });
      return;
    } catch (err: any) {
      logger1S.error(`Ошибка при удалении задачи ${id}:`, err.message);
      throw new InternalServerErrorException(err);
    }
  }

  public async checkFilesInDirectory() {
    const startTime = performance.now();
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
    logger1S.info(`Время выполнения checkFilesInDirectory:`, (startTime - performance.now()).toFixed(2));
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
    return this.enqueueTask(async () => {
      const { codes, errors, items } =
        await this.jsonValidationService.validateJson(jsonParsed);

      if (errors.length > 0) {
        return { success: false, errors, items };
      }

      try {
        const rawCodes: string[] =
          codes && codes.length > 0 ? codes : jsonParsed.codes;

        const taskEntity = this.taskRepository.create({
          ...jsonParsed,
          codes: rawCodes.map((codeStr) => ({ code: codeStr })),
        });

        await this.taskRepository.save(taskEntity);

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
    });
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
}
