import {HttpException, HttpStatus, Injectable, OnModuleInit} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import {logger1S} from "../logger-winston/winston.config";
import {
  getJsonDirectory1S,
  getLineTaskDirectory,
  initDirectories
} from '../path.utils';
import { validateJson } from './validate.json';
import * as dotenv from 'dotenv';
import {CodeService} from "../code/code.service";

dotenv.config();
const interval = /*+process.env.CHECK_1S_INTERVAL*/ 6000;

@Injectable()
export class Task1sService implements OnModuleInit {
  private files: string[] = [];
  private filesIn: string[] = [];
  private checkInterval: NodeJS.Timeout;


  constructor(private readonly codeService: CodeService) {
  }

  async onModuleInit() {
    await initDirectories();

    await this.checkFilesInDirectory();
    logger1S.debug('Запуск проверки файлов от 1С...');
    // Затем проверка каждую минуту (60000 мс)
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

  // async checkFilesInDirectory() {
  //   const directoryPath = getJsonDirectory1S();
  //   const taskDirectoryPath = getTaskJsonDirectory();
  //   const results: { success: boolean; message: string }[] = [];
  //
  //   console.log(results, 'checkFilesInDirectory');
  //
  //   try {
  //     // Создаем папку для заданий если ее нет
  //     await fs.promises.mkdir(taskDirectoryPath, { recursive: true });
  //     console.log('------------start 1S check');
  //
  //     // Получаем списки файлов
  //     const allFiles = await fs.promises.readdir(directoryPath);
  //     this.files = allFiles.filter((file) => file.endsWith('.json'));
  //     this.filesIn = allFiles.filter((file) => file.endsWith('.in'));
  //
  //     // Проверяем наличие файлов заданий
  //     if (this.filesIn.length === 0) {
  //       return {
  //         success: false,
  //         message: 'Нет файлов заданий от 1С (.in файлов)',
  //         details: [],
  //       };
  //     }
  //
  //     // Проверяем наличие соответствующих json файлов
  //     const validInFiles = this.filesIn.filter((fileIn) =>
  //       this.files.includes(fileIn.replace('.in', '.json')),
  //     );
  //
  //     if (validInFiles.length === 0) {
  //       return {
  //         success: false,
  //         message: 'Нет соответствующих JSON файлов для обработки',
  //         details: this.filesIn.map((fileIn) => ({
  //           file: fileIn,
  //           message: `Отсутствует JSON файл для ${fileIn}`,
  //         })),
  //       };
  //     }
  //
  //     // Обрабатываем все валидные пары файлов
  //     for (const fileIn of validInFiles) {
  //       const jsonFileName = fileIn.replace('.in', '.json');
  //       const jsonFilePath = path.join(directoryPath, jsonFileName);
  //       const inFilePath = path.join(directoryPath, fileIn);
  //
  //       try {
  //         // Чтение и валидация JSON
  //         const jsonData = await fs.promises.readFile(jsonFilePath, 'utf-8');
  //         let jsonParsed = null;
  //
  //         try {
  //           jsonParsed = JSON.parse(jsonData.trim());
  //         } catch (err : any) {
  //           const errorMessage = `Ошибка парсинга JSON файла ${jsonFileName}: ${err.message}`;
  //           this.logger.warn(errorMessage, { error: err });
  //
  //           // Добавляем ошибку в массив результатов
  //           results.push({
  //             success: false,
  //             message: errorMessage,
  //           });
  //         }
  //
  //         console.log(results, 'sadsadadsa108');
  //
  //         const { errors, items } = await validateJson(jsonParsed);
  //
  //         const codesToCheck = Array.isArray(jsonParsed.codes) ? jsonParsed.codes : [];
  //         const existingCodes = await this.codeService.getCodes(codesToCheck);
  //
  //         if (existingCodes.length > 0) {
  //           errors.push(`Обнаружены дубликаты в базе данных: ${existingCodes.slice(0, 3).join(', ')}...`);
  //           items.push('codes');
  //         }
  //
  //         // Запись результата валидации в .in файл
  //         await fs.promises.writeFile(
  //           inFilePath,
  //           JSON.stringify(
  //             {
  //               errors: [{ status: errors.length > 0 }],
  //               items: errors.length > 0 ? items : undefined,
  //             },
  //             null,
  //             2,
  //           ),
  //         );
  //
  //         // Переименование .in в .out
  //         const outFilePath = inFilePath.replace('.in', '.out');
  //         await fs.promises.rename(inFilePath, outFilePath);
  //
  //         if (errors.length === 0) {
  //           const targetLines: number[] = (Array.isArray(jsonParsed.line)
  //               ? jsonParsed.line
  //               : [jsonParsed.line]).map(Number);
  //
  //           const codes: string[] = jsonParsed.codes;
  //
  //           const codesPerLine: number[] = (jsonParsed.codesPerLine).map(Number);
  //
  //           const codeChunks = this.splitArrayIntoChunks(codes, codesPerLine);
  //
  //           for (let i = 0; i < targetLines.length; i++) {
  //             const lineNum = targetLines[i];
  //
  //             // Получаем путь через утилиту (она сама проверит .env и выбросит ошибку, если ключа нет)
  //             const targetDir = getLineTaskDirectory(lineNum);
  //
  //             // Создаем директорию линии, если её нет
  //             await fs.promises.mkdir(targetDir, { recursive: true });
  //
  //             const { codes, codesPerLine, lines, ...restJson } = jsonParsed;
  //
  //             const lineTaskPayload = {
  //               ...restJson,
  //               codes: codeChunks[i]
  //             };
  //
  //             const newFileName = this.generateFilename(lineTaskPayload);
  //             const taskFilePath = path.join(targetDir, newFileName);
  //
  //             const cleanedJsonData = JSON.stringify(lineTaskPayload, null, 2).trim();
  //             await fs.promises.writeFile(taskFilePath, cleanedJsonData);
  //           }
  //
  //           const message = `Файл ${jsonFileName} успешно разделен на ${targetLines.length} линий и сохранен`;
  //           results.push({ success: true, message });
  //         } else {
  //           results.push({
  //             success: false,
  //             message: `Файл ${jsonFileName} содержит ошибки валидации (исходный файл сохранен)`,
  //           });
  //         }
  //       } catch (error : any) {
  //         results.push({
  //           success: false,
  //           message: `Ошибка обработки файла ${fileIn}: ${error.message}`,
  //         });
  //       }
  //     }
  //     console.log(results, 'sadsadadsa155');
  //
  //     return {
  //       success: results.some((r) => r.success),
  //       message: results.some((r) => r.success)
  //         ? 'Обработка файлов завершена'
  //         : 'Все файлы содержат ошибки',
  //       details: results,
  //       processedCount: results.length,
  //     };
  //   } catch (err : any) {
  //     return {
  //       success: false,
  //       message: `Системная ошибка: ${err.message}`,
  //       details: [],
  //     };
  //   }
  // }

  async checkFilesInDirectory() {
    const directoryPath = getJsonDirectory1S();
    const results = [];


    const allFiles = await fs.promises.readdir(directoryPath);
    this.filesIn = allFiles.filter((file) => file.endsWith('.in'));

    if (this.filesIn.length === 0) {
      return {success: false, message: 'Нет файлов заданий от 1С'};
    }

    const validInFiles = this.filesIn.filter((fileIn) =>
        allFiles.includes(fileIn.replace('.in', '.json')),
    );

    for (const fileIn of validInFiles) {
      const jsonFileName = fileIn.replace('.in', '.json');
      const jsonFilePath = path.join(directoryPath, jsonFileName);
      const inFilePath = path.join(directoryPath, fileIn);

      try {
        const jsonData = await fs.promises.readFile(jsonFilePath, 'utf-8');
        const jsonParsed = JSON.parse(jsonData.trim());

        const result = await this.processTaskPayload(jsonParsed);

        await fs.promises.writeFile(
            inFilePath,
            JSON.stringify(
                {
                  errors: [{status: !result.success}],
                  items: !result.success ? result.items : undefined,
                },
                null,
                2,
            ),
        );

        // Переименовываем в .out
        const outFilePath = inFilePath.replace('.in', '.out');
        await fs.promises.rename(inFilePath, outFilePath);

        if (result.success) {
          results.push({
            success: true,
            message: `Файл ${jsonFileName} успешно разделен на ${result.targetLinesCount} линий`
          });
        } else {
          results.push({success: false, message: `Файл ${jsonFileName} содержит ошибки валидации`});
        }
      } catch (error: any) {
        logger1S.error(`Ошибка при обработке файла ${fileIn}: ${error.message}`, error.stack);
        results.push({success: false, message: `Ошибка обработки ${fileIn}: ${error.message}`});
      }
    }

    return {success: true, details: results};
  }

  async processTaskPayload(jsonParsed: any): Promise<{ success: boolean; errors: string[]; items: string[]; targetLinesCount?: number }> {

    const { errors, items } = await validateJson(jsonParsed);

    const codesToCheck = Array.isArray(jsonParsed.codes) ? jsonParsed.codes : [];
    const existingCodes = await this.codeService.getCodes(codesToCheck);

    if (existingCodes.length > 0) {
      errors.push(`Обнаружены дубликаты в базе данных`);
      items.push('codes');
    }

    if (errors.length > 0) {
      return { success: false, errors, items };
    }

    const targetLines: number[] = (Array.isArray(jsonParsed.lines) ? jsonParsed.lines : [jsonParsed.lines]).map(Number);    const codes: string[] = jsonParsed.codes;
    const codesPerLine: number[] = (jsonParsed.codesPerLine).map(Number);

    const codeChunks = this.splitArrayByLineCounts(codes, codesPerLine);

    for (let i = 0; i < targetLines.length; i++) {
      const lineNum = targetLines[i];
      const targetDir = getLineTaskDirectory(lineNum);

      await fs.promises.mkdir(targetDir, { recursive: true });

      const { codes: _, codesPerLine: __, lines: ___, ...restJson } = jsonParsed;

      const lineTaskPayload = {
        ...restJson,
        codes: codeChunks[i]
      };

      const newFileName = this.generateFilename(lineTaskPayload);
      const taskFilePath = path.join(targetDir, newFileName);

      await fs.promises.writeFile(taskFilePath, JSON.stringify(lineTaskPayload, null, 2).trim());
    }

    return { success: true, errors: [], items: [], targetLinesCount: targetLines.length };
  }

  async processApiTask(jsonParsed: any) {
    const result = await this.processTaskPayload(jsonParsed);
    if (!result.success) {
      throw new HttpException(
          {
            errors: result.errors,
            items: result.items,
          },
          HttpStatus.BAD_REQUEST,
      );
    }
    return;
  }

  private generateFilename(jsonData: any): string {
    const gtin = jsonData.gtin || '';
    const itf14 = jsonData.ITF14 ? `_${jsonData.ITF14}` : '';
    const batch = jsonData.batch || '';

    const cleanGtin = gtin.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanItf14 = itf14.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanBatch = batch.replace(/[^a-zA-Z0-9_-]/g, '');
    const id = Date.now()

    return `${cleanGtin}${cleanItf14}_${cleanBatch}_${id}.json`;
  }

  public async getFiles(): Promise<string[]> {
    return this.files;
  }

  public async refreshFiles(): Promise<string[]> {
    await this.checkFilesInDirectory();
    return this.files;
  }

  private splitArrayByLineCounts(array: string[], codesPerLine: number[]): string[][] {
    const result: string[][] = [];
    let currentIndex = 0;

    for (const count of codesPerLine) {
      const chunk = array.slice(currentIndex, currentIndex + count);
      result.push(chunk);
      currentIndex += count;
    }

    return result;
  }
}