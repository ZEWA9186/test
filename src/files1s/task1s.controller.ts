import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { Task1sService } from './task1s.service';

@Controller('task-1s')
export class Task1sController {
    constructor(private readonly task1sService: Task1sService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async processTask(@Body() jsonParsed: any) {
        await this.task1sService.processApiTask(jsonParsed);
    }
}