import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { TaskEntity } from './entities/task.entity';
import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';
import { CodeValidationService } from '../validation/code-validation.service';
import { NomenclaturesService } from '../nomenclatures/nomenclatures.service';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,
    private readonly codeValidationService: CodeValidationService,
    private readonly nomenclaturesService: NomenclaturesService,
  ) {}

  async getAllTask(): Promise<TaskEntity[]> {
    return await this.taskRepository.find();
  }

  async getTaskById(id: number): Promise<TaskEntity | null> {
    return await this.taskRepository.findOne({
      where: { id },
    });
  }

  async createTask(data: any, nomenclatureId: number, numberValue?: number): Promise<TaskEntity> {
    const nomenclature = await this.nomenclaturesService.getNomenclatureById(nomenclatureId);
    //TODO привязка n числа кодов, а не всего файла, допривязка кодов.
    if (!nomenclature) {
      throw new NotFoundException(`Номенклатура с ID ${nomenclatureId} не найдена`);
    }

    const codeDir = process.env.CODES_DIRECTORY;

    if (!codeDir) {
      throw new Error('CODES_DIRECTORY environment variable not set');
    }

    const filePaths = (data.files ?? []).map((fileName: string) => path.join(codeDir, fileName));

    if (filePaths.length === 0) {
      throw new BadRequestException('Не выбраны файлы с кодами');
    }

    const codes = await this.readCodesFromFiles(filePaths, numberValue);

    const validationResult = await this.codeValidationService.cleanAndFilterCodes(
      codes,
      nomenclature.gtin,
    );

    if (validationResult.errors.length > 0) {
      throw new BadRequestException(validationResult.errors.join(', '));
    }

    const validCodes = validationResult.codes ?? [];

    if (validCodes.length === 0) {
      throw new BadRequestException('Нет валидных кодов, задача не будет создана');
    }

    const { files, ...taskData } = data;

    const taskDataForSave: DeepPartial<TaskEntity> = {
      ...nomenclature,
      ...taskData,
      codes: validCodes.map((code) => ({
        code,
      })),
    };

    const taskEntity = this.taskRepository.create(taskDataForSave);

    const savedTask = await this.taskRepository.save(taskEntity);

    await this.deleteTempFiles(filePaths);

    return savedTask;
  }

  async deleteTask(id: number): Promise<void> {
    const task = await this.getTaskById(id);

    if (!task) {
      throw new NotFoundException(`Задача с ID ${id} не найдена`);
    }

    await this.taskRepository.remove(task);
  }

  async appointTsds(tsdIds: number[], id: number): Promise<void> {
    const task = await this.getTaskById(id);

    if (!task) {
      throw new NotFoundException(`Задача с ID ${id} не найдена`);
    }

    await this.taskRepository.update(id, { tsdIds });
  }

  async getTaskInWorkForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);

    return tasks.filter((task) => task.activeTasks && task.activeTasks.length > 0);
  }

  async getTaskUnprocessedForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);

    return tasks.filter((task) => !task.activeTasks || task.activeTasks.length === 0);
  }

  async startTask(tsdId: number, taskId: number): Promise<void> {
    const task = await this.getTaskById(taskId);

    if (!task) {
      throw new NotFoundException(`Задача с ID ${taskId} не найдена`);
    }

    let activeTask = await this.activeTaskRepository.findOne({
      where: { tsdId },
    });

    if (!activeTask) {
      activeTask = this.activeTaskRepository.create({
        tsdId,
        gtin: task.gtin,
        ITF14: task.ITF14,
        batch: task.batch,
        dateManufacture: task.dateManufacture,
        dateExpiration: task.dateExpiration,
        aggregationLvl: task.aggregationLvl,
        piecesPerSmallBox: task.piecesPerSmallBox,
        piecesPerBigBox: task.piecesPerBigBox,
        piecesPerPallet: task.piecesPerPallet,
      });
    }

    activeTask.task = task;

    await this.activeTaskRepository.save(activeTask);
  }

  private async readCodesFromFiles(filePaths: string[], numberValue?: number): Promise<string[]> {
    const allCodes: string[] = [];

    for (const filePath of filePaths) {
      const absolutePath = path.resolve(filePath);

      // ПРОВЕРКА НАЛИЧИЯ ФАЙЛА
      if (!fs.existsSync(absolutePath)) {
        throw new NotFoundException(`Файл не найден: ${absolutePath}`);
      }

      const content = await fs.promises.readFile(absolutePath, 'utf-8');

      let codes = content
        .split(/\r?\n/)
        .map((line) => line.split('\t')[0])
        .map((code) => code.trim())
        .map((code) => this.parseQuotedValue(code))
        .filter((code) => code);

      if (numberValue) {
        codes = codes.slice(0, numberValue);
      }

      allCodes.push(...codes);
    }

    return allCodes;
  }

  private async deleteTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.promises.unlink(filePath);
      } catch {}
    }
  }

  private parseQuotedValue(value: string): string {
    if (!value) {
      return '';
    }

    if (!value.startsWith('"')) {
      return value;
    }

    return value.slice(1, -1).replace(/""/g, '"');
  }

  private async getTasksForTsd(tsdId: number): Promise<TaskEntity[]> {
    return await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.activeTasks', 'activeTask')
      .where(':tsdId = ANY(task.tsdIds)', { tsdId })
      .getMany();
  }
}
