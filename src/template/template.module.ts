import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { Templates } from './template.entity';
import { TemplatesRepository } from './template.repository';
import { templateLogger } from '../logger-winston/winston.config';

@Module({
  imports: [TypeOrmModule.forFeature([Templates])],
  controllers: [TemplateController],
  providers: [
    TemplateService,
    TemplatesRepository,
    { provide: 'winston', useValue: templateLogger },
  ],
  exports: [TemplateService, TemplatesRepository],
})
export class TemplateModule { }