import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { TaskService } from './task.service';

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  async getAllTasks() {
    return await this.taskService.getAllTask();
  }

  @Get('history')
  async getHistoryTasks() {
    return await this.taskService.getHistoryTasks();
  }

  @Get('tsd/:tsdId/history')
  async getHistoryTasksForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
    return await this.taskService.getTaskHistoryForTsd(tsdId);
  }

  @Post('tsd/:tsdId/history/:id/start')
  @HttpCode(HttpStatus.OK)
  async startHistoryTask(
    @Param('tsdId', ParseIntPipe) tsdId: number,
    @Param('id', ParseIntPipe) taskId: number,
  ) {
    return this.taskService.startHistoryTask(tsdId, taskId);
  }

  @Get('tsd/:tsdId/in-work')
  async getTaskInWorkForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
    return await this.taskService.getTaskInWorkForTsd(tsdId);
  }

  @Get('tsd/:tsdId/unprocessed')
  async getTaskUnprocessedForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
    return await this.taskService.getTaskUnprocessedForTsd(tsdId);
  }

  @Get(':id')
  async getTaskById(@Param('id', ParseIntPipe) id: number) {
    return await this.taskService.getTaskById(id);
  }

  @Post()
  async createTask(@Body() body: any) {
    const { nomenclatureId, numberValue, ...data } = body;

    return await this.taskService.createTask(data, nomenclatureId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(@Param('id', ParseIntPipe) id: number) {
    await this.taskService.deleteTask(id);
  }

  @Post(':id/appoint-tsds')
  @HttpCode(HttpStatus.NO_CONTENT)
  async appointTsds(@Param('id', ParseIntPipe) id: number, @Body('tsdIds') tsdIds: number[]) {
    await this.taskService.appointTsds(tsdIds, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startTask(
    @Param('id', ParseIntPipe) taskId: number,
    @Body('tsdId', ParseIntPipe) tsdId: number,
  ) {
    await this.taskService.startTask(tsdId, taskId);
  }

  @Get('tsd/active/:tsdId')
  @HttpCode(HttpStatus.OK)
  async activeTask(@Param('tsdId', ParseIntPipe) tsdId: number) {
    return await this.taskService.getActiveTaskIdByTsdId(tsdId);
  }

  @Post(':tsdId/complete')
  @HttpCode(HttpStatus.OK)
  async completeTask(@Param('tsdId', ParseIntPipe) tsdId: number) {
    await this.taskService.completeTask(tsdId);
  }
}
