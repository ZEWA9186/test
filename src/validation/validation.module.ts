import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../task/entities/task.entity';
import { TaskCodesEntity } from '../task/entities/task-codes.entity';
import { JsonValidationService } from './json-validate.service';
import { CodeValidationService } from './code-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, TaskCodesEntity])],
  providers: [JsonValidationService, CodeValidationService],
  exports: [JsonValidationService, CodeValidationService],
})
export class ValidationModule {}
