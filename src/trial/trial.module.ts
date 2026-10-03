import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrialEntity } from './entities/trial.entity';
import { TrialService } from './trial.service';
import { TrialHeaderMiddleware } from './trial-header.middleware';


@Module({
  imports: [TypeOrmModule.forFeature([TrialEntity])],
  providers: [TrialService, TrialHeaderMiddleware],
  exports: [TrialService],
})
export class TrialModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TrialHeaderMiddleware).forRoutes('code');
  }
}
