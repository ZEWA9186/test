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

  @Get(':id')
  async getTaskById(@Param('id', ParseIntPipe) id: number) {
    return await this.taskService.getTaskById(id);
  }

  @Post()
  async createTask(@Body() body: any) {
    const { nomenclatureId, numberValue, ...data } = body;

    return await this.taskService.createTask(data, nomenclatureId, numberValue);
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

  @Get('tsd/:tsdId/in-work')
  async getTaskInWorkForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
    return await this.taskService.getTaskInWorkForTsd(tsdId);
  }

  @Get('tsd/:tsdId/unprocessed')
  async getTaskUnprocessedForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
    return await this.taskService.getTaskUnprocessedForTsd(tsdId);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async startTask(
    @Param('id', ParseIntPipe) taskId: number,
    @Body('tsdId', ParseIntPipe) tsdId: number,
  ) {
    await this.taskService.startTask(tsdId, taskId);
  }
}
