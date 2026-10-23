import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AggregationController } from './aggregation.controller';
import { AggregationService } from './aggregation.service';
import { ActiveTaskEntity } from './entities/active-task.entity';
import { CodeModule } from '../code/code.module';
import { AggregationRules } from './helper-service/aggregation.rules';
import { AggregationRepository } from './repository/aggregation.repository';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';
import { PackagingTableManager } from './repository/packaging-table-manager.service';
import { ValidationModule } from '../validation/validation.module';
import { AggregationProgressService } from './helper-service/aggregation-progress.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveTaskEntity]), CodeModule, ValidationModule],
  controllers: [AggregationController],
  providers: [
    AggregationService,
    AggregationRules,
    AggregationRepository,
    AggregationProductService,
    AggregationContainerService,
    PackagingTableManager,
    AggregationProgressService,
  ],
  exports: [AggregationService, PackagingTableManager],
})
export class AggregationModule {}
