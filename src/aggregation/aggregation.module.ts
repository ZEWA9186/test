import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AggregationController } from './aggregation.controller';
import { AggregationService } from './aggregation.service';
import { ActiveTaskEntity } from './entities/active-task.entity';
import { PackagingEntity } from './entities/packaging.entity';
import { CodeModule } from '../code/code.module';
import { AggregationRules } from './helper-service/aggregation.rules';
import { AggregationRepository } from './repository/aggregation.repository';
import { AggregationProductService } from './helper-service/aggregation-product.service';
import { AggregationContainerService } from './helper-service/aggregation-container.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActiveTaskEntity, PackagingEntity]),
    CodeModule,
  ],
  controllers: [AggregationController],
  providers: [
    AggregationService,
    AggregationRules,
    AggregationRepository,
    AggregationProductService,
    AggregationContainerService,
  ],
  exports: [AggregationService],
})
export class AggregationModule {}
