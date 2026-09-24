import {Controller, Post, Body, HttpStatus, HttpCode, Get} from '@nestjs/common';
import { Task1sService } from './task1s.service';
import {TaskCheckResult} from "./dto/task-check-result";

@Controller('task-1s')
export class Task1sController {
    constructor(private readonly task1sService: Task1sService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async processTask(@Body() jsonParsed: any): Promise<TaskCheckResult> {
       return await this.task1sService.processApiTask(jsonParsed);
    }

    @Get('check')
    async checkFilesInDirectory(): Promise<TaskCheckResult[]> {
        return await this.task1sService.checkFilesInDirectory();
    }

    @Get()
    async getFiles(): Promise<string[]> {
        return this.task1sService.getFiles();
    }

    @Get('refresh')
    async refreshFiles(): Promise<string[]> {
        return this.task1sService.refreshFiles();
    }
}