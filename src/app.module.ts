import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { CodeModule } from './code/code.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseProviders } from './database.providers';
import { Task1sModule } from './files1s/task1s.module';
import { LastPackageModule } from './last-package/last-package.module';
import { BackupModule } from './backup/backup.module';
import { AggregationModule } from './aggregation/aggregation.module';
import { TaskModule } from './task/task.module';
import { PrinterModule } from './printers/printer.module';
import { NomenclaturesModule } from './nomenclatures/nomenclatures.module';
import { AppGateway } from './app.gateway';
import { Module } from '@nestjs/common';
import { UserModule } from './users/users.module';
import { ConfigValidationService } from './config/config-validation.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseProviders,
    CodeModule,
    Task1sModule,
    LastPackageModule,
    BackupModule,
    AggregationModule,
    TaskModule,
    PrinterModule,
    NomenclaturesModule,
    AppGateway,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService, ConfigValidationService],
})
export class AppModule {}
