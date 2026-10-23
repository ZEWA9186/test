import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaskController } from './task.controller';
import { TaskService } from './task.service';

import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';
import { TaskEntity } from './entities/task.entity';
import { TaskCodesEntity } from './entities/task-codes.entity';

import { ValidationModule } from '../validation/validation.module';
import { NomenclaturesModule } from '../nomenclatures/nomenclatures.module';
import { AggregationModule } from '../aggregation/aggregation.module';
import { ReportService } from './reports/report.service';
import { ReportRepository } from './reports/report.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, ActiveTaskEntity, TaskCodesEntity]),
    ValidationModule,
    NomenclaturesModule,
    AggregationModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, ReportService, ReportRepository],
  exports: [TaskService],
})
export class TaskModule {}
