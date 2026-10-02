import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TaskEntity } from './entities/task.entity';
import { Repository } from 'typeorm';
import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,
  ) {}

  async getAllTask() {
    return await this.taskRepository.find();
  }

  async getTaskById(id: number) {
    return await this.taskRepository.findOne({
      where: { id },
    });
  }

  async appointTsds(tsdIds: number[], id: number): Promise<void> {
    await this.taskRepository.update(id, { tsdIds });
  }

  async getTaskInWorkForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);
    // Задание в работе, если есть хотя бы одна запись в activeTasks (любой ТСД ее взял)
    return tasks.filter(
      (task) => task.activeTasks && task.activeTasks.length > 0,
    );
  }

  async getTaskUnprocessedForTsd(tsdId: number): Promise<TaskEntity[]> {
    const tasks = await this.getTasksForTsd(tsdId);
    // Задание не запущенно, если записей в activeTasks нет вообще
    return tasks.filter(
      (task) => !task.activeTasks || task.activeTasks.length === 0,
    );
  }

  async startTask(tsdId: number, taskId: number): Promise<void> {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`Задача с ID ${taskId} не найдена`);
    }

    // Фиксация работы конкретного ТСД над задачей
    let activeTask = await this.activeTaskRepository.findOne({
      where: { tsdId },
    });

    if (!activeTask) {
      activeTask = this.activeTaskRepository.create({
        tsdId,
        gtin: task.gtin,
        aggregationLvl: task.aggregationLvl,
        piecesPerSmallBox: task.piecesPerSmallBox,
        piecesPerBigBox: task.piecesPerBigBox,
        piecesPerPallet: task.piecesPerPallet,
      });
    }

    activeTask.task = task;
    await this.activeTaskRepository.save(activeTask);
  }

  private async getTasksForTsd(tsdId: number): Promise<TaskEntity[]> {
    return await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.activeTasks', 'activeTask')
      .where(':tsdId = ANY(task.tsdIds)', { tsdId })
      .getMany();
  }
}