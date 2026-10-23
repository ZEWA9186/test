import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../task/entities/task.entity';
import { TaskCodesEntity } from '../task/entities/task-codes.entity';
import { JsonValidationService } from './json-validate.service';
import { CodeValidationService } from './code-validation.service';
import { Gs1ParserService } from './gs1-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, TaskCodesEntity])],
  providers: [JsonValidationService, CodeValidationService, Gs1ParserService],
  exports: [JsonValidationService, CodeValidationService, Gs1ParserService],
})
export class ValidationModule {}
