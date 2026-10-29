import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterConfigRepository } from './printer-config.repository';
import { PrinterController } from './printer.controller';
import { PrinterConfig } from './printer-config.entity';
import { printerLogger } from '../logger-winston/winston.config';
import { PrinterConfigService } from './printers-helper/printer-config.service';
import { PrinterConnectionService } from './printers-helper/printer-connection.service';
import { PrinterTransportService } from './printers-helper/printer-transport.service';
import { PrinterMonitoringService } from './printers-helper/printer-monitoring.service';
import { TaskModule } from '../task/task.module';
import { AppGateway } from '../app.gateway';
import { LastPackageModule } from '../last-package/last-package.module';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterConfig]), TaskModule, LastPackageModule],
  controllers: [PrinterController],
  providers: [
    PrinterService,
    PrinterConfigRepository,
    { provide: 'winston', useValue: printerLogger },
    PrinterConfigService,
    PrinterConnectionService,
    PrinterTransportService,
    PrinterMonitoringService,
    AppGateway,
  ],
  exports: [PrinterService, PrinterConfigRepository],
})
export class PrinterModule {}
