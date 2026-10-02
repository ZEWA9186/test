import { Module } from '@nestjs/common';
import { PrinterService } from './printer.service';
import { AppGateway } from 'src/app.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrinterConfigRepository } from './printer-config.repository';
import { PrinterController } from './printer.controller';
import { PrinterConfig } from './printer-config.entity';
import { printerLogger } from 'src/logger-winston/winston.config';
import { TemplateModule } from 'src/template/template.module';
import { PrinterDMService } from './printerDM.service';
import { GatawayModule } from 'src/Gateway.module';
import { PrinterDemacService } from './TTO/printer_demac.service';

@Module({
  imports: [TypeOrmModule.forFeature([PrinterConfig]), TemplateModule, GatawayModule],
  controllers: [PrinterController],
  providers: [
    PrinterService,
    PrinterConfigRepository,
    PrinterDMService,
    PrinterDemacService,
    { provide: 'winston', useValue: printerLogger },
  ],
  exports: [PrinterService, PrinterConfigRepository, PrinterDemacService],
})
export class PrinterModule {}
