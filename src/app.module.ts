import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TrialModule } from './trial/trial.module';
import { CodeModule } from './code/code.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseProviders } from './database.providers';
import { Task1sModule } from './files1s/task1s.module';
import { LastPackageModule } from './last-package/last-package.module';
import { BackupModule } from './backup/backup.module';
import {AggregationModule} from "./aggregation/aggregation.module";
import {TaskModule} from "./task/task.module";
import { PrinterModule } from './printers/printer.module';
import { NomenclaturesModule } from './nomenclatures/nomenclatures.module';
import { AppGateway } from './app.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseProviders,
    TrialModule,
    CodeModule,
    Task1sModule,
    LastPackageModule,
    BackupModule,
    AggregationModule,
    TaskModule,
    PrinterModule,
    NomenclaturesModule,
    AppGateway
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
