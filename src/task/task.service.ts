import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { TaskEntity } from './entities/task.entity';
import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';
import { CodeValidationService } from '../validation/code-validation.service';
import { NomenclaturesService } from '../nomenclatures/nomenclatures.service';
import { TaskCodesEntity } from './entities/task-codes.entity';
import { PackagingTableManager } from '../aggregation/repository/packaging-table-manager.service';
import { ReportService } from './reports/report.service';
import { getCodesDirectory } from '../config/config.paths';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,
    private readonly codeValidationService: CodeValidationService,
    private readonly nomenclaturesService: NomenclaturesService,
    @InjectRepository(TaskCodesEntity)
    private readonly taskCodesRepository: Repository<TaskCodesEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly packagingTableManager: PackagingTableManager,
    private readonly reportService: ReportService,
  ) {}
  async getAllTask(): Promise<TaskEntity[]> {
    return await this.taskRepository.find({
      where: { isHistory: false },
    });
  }

  async getHistoryTasks(): Promise<TaskEntity[]> {
    return await this.taskRepository.find({
      where: { isHistory: true },
    });
  }

  async getTaskById(id: number): Promise<TaskEntity | null> {
    return await this.taskRepository.findOne({
      where: { id },
    });
  }

  async getCodesByTaskId(taskId: number): Promise<string[]> {
    const codes = await this.taskCodesRepository.find({
      where: { taskId },
    });

    return codes.map((code) => code.code);
  }

  async createTask(data: any, nomenclatureId: number, numberValue?: number): Promise<TaskEntity> {
    const nomenclature = await this.nomenclaturesService.getNomenclatureById(nomenclatureId);

    if (!nomenclature) {
      throw new NotFoundException(`Номенклатура с ID ${nomenclatureId} не найдена`);
    }

    const codeDir = getCodesDirectory();

    const { files, ...taskData } = data;
    const filePaths: string = path.join(codeDir, files);

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

    const taskDataForSave: DeepPartial<TaskEntity> = {
      ...nomenclature,
      ...taskData,
      isActive: false,
      isHistory: false,
      packagingTableName: null,
      codes: validCodes.map((code) => ({ code })),
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

  /** Обычные задания, которые сейчас выполняются на назначенном ТСД. */
  async getTaskInWorkForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);

    return tasks.filter((task) => task.isActive && !task.isHistory);
  }

  /** Обычные задания, которые ещё не запускались или ожидают запуска. */
  async getTaskUnprocessedForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);

    return tasks.filter((task) => !task.isActive && !task.isHistory);
  }

  /** Исторические задания, назначенные этому ТСД. */
  async getTaskHistoryForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);

    return tasks.filter((task) => task.isHistory && !task.isActive);
  }

  /**
   * Запускает обычное задание. Первым запуском создаётся таблица фасовки;
   * следующие ТСД, подключённые к этому заданию, используют её же.
   */
  async startTask(tsdId: number, taskId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const activeTaskRepository = manager.getRepository(ActiveTaskEntity);

      const task = await taskRepository.findOne({
        where: { id: taskId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException(`Задача с ID ${taskId} не найдена`);
      }

      this.ensureTaskAssignedToTsd(task, tsdId);

      if (task.isHistory) {
        throw new ConflictException('Историческое задание нужно открывать через startHistoryTask');
      }

      let tableName: string;

      if (task.isActive) {
        if (!task.packagingTableName) {
          throw new ConflictException(`У активного задания ${task.id} не указана таблица фасовки`);
        }

        tableName = task.packagingTableName;
      } else {
        if (task.packagingTableName) {
          throw new ConflictException(`У неактивного задания ${task.id} осталась таблица фасовки`);
        }

        tableName = await this.packagingTableManager.createTable(manager, task.gtin);

        task.isActive = true;
        task.isHistory = false;
        task.packagingTableName = tableName;
        await taskRepository.save(task);
      }

      const activeTask = activeTaskRepository.create({
        tsdId,
        taskId: task.id,
        gtin: task.gtin,
        aggregationLvl: task.aggregationLvl,
        piecesPerSmallBox: task.piecesPerSmallBox,
        piecesPerBigBox: task.piecesPerBigBox,
        piecesPerPallet: task.piecesPerPallet,
        packagingTableName: tableName,
      });

      await activeTaskRepository.save(activeTask);
    });
  }

  /**
   * Открывает существующую историческую фасовку на одном ТСД.
   * Новая таблица не создаётся, TaskEntity.isActive не изменяется.
   */
  async startHistoryTask(tsdId: number, taskId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const activeTaskRepository = manager.getRepository(ActiveTaskEntity);

      const task = await taskRepository.findOne({
        where: { id: taskId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException(`Задача с ID ${taskId} не найдена`);
      }

      this.ensureTaskAssignedToTsd(task, tsdId);

      if (!task.isHistory || task.isActive) {
        throw new ConflictException(
          `Задание ${taskId} не является завершённым историческим заданием`,
        );
      }

      // Одну историческую фасовку одновременно открывает только один ТСД.
      const assignedTask = await activeTaskRepository.findOne({
        where: { taskId },
      });

      if (assignedTask) {
        throw new ConflictException(`Историческое задание ${taskId} уже открыто на другом ТСД`);
      }

      const activeTask = activeTaskRepository.create({
        tsdId,
        taskId: task.id,
        gtin: task.gtin,
        aggregationLvl: task.aggregationLvl,
        piecesPerSmallBox: task.piecesPerSmallBox,
        piecesPerBigBox: task.piecesPerBigBox,
        piecesPerPallet: task.piecesPerPallet,
        packagingTableName: task.packagingTableName,
      });

      await activeTaskRepository.save(activeTask);
    });
  }

  /** Завершает обычное задание, сохраняет отчёт и переводит задание в историю. */
  async completeTask(tsdId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const activeTaskRepository = manager.getRepository(ActiveTaskEntity);

      const activeTask = await activeTaskRepository.findOne({
        where: { tsdId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activeTask?.taskId) {
        throw new NotFoundException(`Для ТСД ${tsdId} не найдено активное задание`);
      }

      const task = await taskRepository.findOne({
        where: { id: activeTask.taskId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!task) {
        throw new NotFoundException(`Задание ${activeTask.taskId} не найдено`);
      }

      await this.reportService.buildAndSaveReport(task);

      task.isActive = false;
      task.isHistory = true;
      await taskRepository.save(task);

      await activeTaskRepository.delete({ taskId: task.id });
    });
  }

  async getActiveTaskIdByTsdId(tsdId: number): Promise<number> {
    const result = await this.activeTaskRepository
      .createQueryBuilder('activeTask')
      .select('activeTask.task_id', 'taskId')
      .where('activeTask.tsdId = :tsdId', { tsdId })
      .getRawOne<{ taskId: number | null }>();

    if (!result) {
      throw new BadRequestException('Нет активной задачи');
    }

    if (result.taskId == null) {
      throw new BadRequestException('Для ТСД не назначена задача');
    }

    return Number(result.taskId);
  }

  async getProductsInBigBox(id: number): Promise<number> {
    const task = await this.taskRepository.findOne({ where: { id } });

    if (task && task.piecesPerSmallBox && task.piecesPerBigBox) {
      return task.piecesPerBigBox * task.piecesPerSmallBox;
    }

    throw new NotFoundException(`Неправильная конфигурация задания ${id}`);
  }

  async getProductsCount(id: number): Promise<number> {
    return this.taskCodesRepository.count({ where: { taskId: id } });
  }

  async getProductsInPalletId(id: number): Promise<number> {
    const task = await this.taskRepository.findOne({ where: { id } });

    if (task && task.piecesPerSmallBox && task.piecesPerBigBox && task.piecesPerPallet) {
      return task.piecesPerBigBox * task.piecesPerSmallBox * task.piecesPerPallet;
    }

    throw new NotFoundException(`Неправильная конфигурация задания ${id}`);
  }

  private ensureTaskAssignedToTsd(task: TaskEntity, tsdId: number): void {
    if (!task.tsdIds?.includes(tsdId)) {
      throw new BadRequestException(`Задание ${task.id} не назначено на ТСД ${tsdId}`);
    }
  }

  private async readCodesFromFiles(filePath: string, numberValue?: number): Promise<string[]> {
    const allCodes: string[] = [];

    const absolutePath = path.resolve(filePath);

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

    return allCodes;
  }

  private async deleteTempFiles(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // Не прерываем создание задания, если временный файл уже удалён.
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
      .where(':tsdId = ANY(task.tsdIds)', { tsdId })
      .getMany();
  }
}
