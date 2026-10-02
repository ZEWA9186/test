// task.controller.ts
import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { TaskService } from './task.service';

@Controller('tasks')
export class TaskController {
    constructor(private readonly taskService: TaskService) {}

    /**
     * Получить список всех задач
     */
    @Get()
    async getAllTasks() {
        return await this.taskService.getAllTask();
    }

    /**
     * Получить задачу по ID
     */
    @Get(':id')
    async getTaskById(@Param('id', ParseIntPipe) id: number) {
        return await this.taskService.getTaskById(id);
    }

    /**
     * Назначить список ТСД на задачу
     */
    @Post(':id/appoint-tsds')
    @HttpCode(HttpStatus.NO_CONTENT)
    async appointTsds(
        @Param('id', ParseIntPipe) id: number,
        @Body() tsdIds: number[],
    ) {
        await this.taskService.appointTsds(tsdIds, id);
    }

    /**
     * Получить список задач в работе для конкретного ТСД
     */
    @Get('tsd/:tsdId/in-work')
    async getTaskInWorkForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
        return await this.taskService.getTaskInWorkForTsd(tsdId);
    }

    /**
     * Получить список незятых/необработанных задач для конкретного ТСД
     */
    @Get('tsd/:tsdId/unprocessed')
    async getTaskUnprocessedForTsd(@Param('tsdId', ParseIntPipe) tsdId: number) {
        return await this.taskService.getTaskUnprocessedForTsd(tsdId);
    }

    /**
     * Запустить выполнение задачи на ТСД
     */
    @Post(':id/start')
    @HttpCode(HttpStatus.OK)
    async startTask(
        @Param('id', ParseIntPipe) taskId: number,
        @Body('tsdId') tsdId: number,
    ) {
        await this.taskService.startTask(tsdId, taskId);
        return { success: true };
    }
}