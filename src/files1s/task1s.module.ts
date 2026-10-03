import { Module } from '@nestjs/common';
import { Task1sController } from './task1s.controller';
import { Task1sService } from './task1s.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../task/entities/task.entity';
import { TaskCodesEntity } from '../task/entities/task-codes.entity';
import { ValidationModule } from '../validation/validation.module';


@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, TaskCodesEntity]), ValidationModule],
  controllers: [Task1sController],
  providers: [Task1sService],
  exports: [Task1sService],
})
export class Task1sModule {}
