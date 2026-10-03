import { Module } from '@nestjs/common';
import { NomenclaturesController } from './nomenclatures.controller';
import { NomenclaturesService } from './nomenclatures.service';

@Module({
  controllers: [NomenclaturesController],
  providers: [NomenclaturesService],
  exports: [NomenclaturesService],
})
export class NomenclaturesModule {}
