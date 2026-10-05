import { Module } from '@nestjs/common';
import { NomenclaturesController } from './nomenclatures.controller';
import { NomenclaturesService } from './nomenclatures.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NomenclatureEntity } from './entities/nomenclature.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NomenclatureEntity])],
  controllers: [NomenclaturesController],
  providers: [NomenclaturesService],
  exports: [NomenclaturesService],
})
export class NomenclaturesModule {}
