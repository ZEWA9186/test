import { Module } from '@nestjs/common';
import { Task1sController } from './task1s.controller';
import { Task1sService } from './task1s.service';
import {TypeOrmModule} from "@nestjs/typeorm";
import {TaskEntity} from "./entities/task.entity";
import {TaskCodesEntity} from "./entities/task-codes.entity";
import {JsonValidationService} from "./json-validate.service";
import {CodeValidationService} from "./code-validation.service";

@Module({
    imports: [
        TypeOrmModule.forFeature(
        [TaskEntity, TaskCodesEntity]
        ),
    ],
    controllers: [Task1sController],
    providers: [
        Task1sService,
        JsonValidationService,
        CodeValidationService
    ],
    exports: [Task1sService],
})
export class Task1sModule {}