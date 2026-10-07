import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterConfigRepository } from './printer-config.repository';
import { PrinterController } from './printer.controller';
import { PrinterConfig } from './printer-config.entity';
import { printerLogger } from '../logger-winston/winston.config';
import { TemplateModule } from '../template/template.module';
import { PrinterDMService } from './printers-helper/printerDM.service';
import { PrinterConfigService } from './printers-helper/printer-config.service';
import { PrinterConnectionService } from './printers-helper/printer-connection.service';
import { PrinterMonitoringService } from './printers-helper/printer-monitoring.service';
import { PrinterQueueService } from './printers-helper/printer-queue.service';
import { TaskModule } from '../task/task.module';
import { AppGateway } from '../app.gateway';
import { LastPackageModule } from '../last-package/last-package.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrinterConfig]),
    TemplateModule,
    TaskModule,
    LastPackageModule,
  ],
  controllers: [PrinterController],
  providers: [
    PrinterService,
    PrinterConfigRepository,
    PrinterDMService,
    { provide: 'winston', useValue: printerLogger },
    PrinterConfigService,
    PrinterConnectionService,
    PrinterMonitoringService,
    PrinterQueueService,
    AppGateway,
  ],
  exports: [PrinterService, PrinterConfigRepository],
})
export class PrinterModule {}
