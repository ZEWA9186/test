import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';
import { TaskEntity } from './entities/task.entity';
import { ValidationModule } from '../validation/validation.module';
import { NomenclaturesService } from '../nomenclatures/nomenclatures.service';
import { NomenclaturesModule } from '../nomenclatures/nomenclatures.module';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, ActiveTaskEntity]), ValidationModule, NomenclaturesModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
