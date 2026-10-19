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
import { Gs1ParserModule } from '../gs1-parser/gs1-parser.module';
import { PackagingTableManager } from './repository/packaging-table-manager.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveTaskEntity]), CodeModule, Gs1ParserModule],
  controllers: [AggregationController],
  providers: [
    AggregationService,
    AggregationRules,
    AggregationRepository,
    AggregationProductService,
    AggregationContainerService,
    PackagingTableManager,
  ],
  exports: [AggregationService, PackagingTableManager],
})
export class AggregationModule {}
