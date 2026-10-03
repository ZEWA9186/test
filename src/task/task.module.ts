import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveTaskEntity } from '../aggregation/entities/active-task.entity';
import { TaskEntity } from './entities/task.entity';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, ActiveTaskEntity]), ValidationModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
