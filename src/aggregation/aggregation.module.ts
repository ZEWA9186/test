import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AggregationController } from './aggregation.controller';
import { AggregationService } from './service/aggregation.service';
import { ActiveTaskEntity } from './entities/active-task.entity';
import { CodeModule } from '../code/code.module';
import { AggregationRepository } from './repository/aggregation.repository';
import { PackagingTableManager } from './repository/packaging-table-manager.service';
import { ValidationModule } from '../validation/validation.module';
import { TaskCodesEntity } from '../task/entities/task-codes.entity';
import { AggregationManualService } from './service/aggregation-manual.service';
import { AggregationReportService } from './service/aggregation-report.service';
import { AggregationSharedService } from './service/aggregation-shared.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActiveTaskEntity, TaskCodesEntity]),
    CodeModule,
    ValidationModule,
  ],
  controllers: [AggregationController],
  providers: [
    AggregationSharedService,
    AggregationService,
    AggregationManualService,
    AggregationReportService,
    AggregationRepository,
    PackagingTableManager,
  ],
  exports: [AggregationService, PackagingTableManager],
})
export class AggregationModule {}
