import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';

import { NomenclaturesService } from './nomenclatures.service';
import { NomenclatureEntity } from './entities/nomenclature.entity';
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto';

@Controller('nomenclatures')
export class NomenclaturesController {
  constructor(private readonly nomenclaturesService: NomenclaturesService) {}

  @Get()
  async getAllNomenclatures(): Promise<NomenclatureEntity[]> {
    return await this.nomenclaturesService.getAllNomenclatures();
  }

  @Get(':id')
  async getNomenclatureById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NomenclatureEntity | null> {
    return await this.nomenclaturesService.getNomenclatureById(id);
  }

  @Post()
  async createNomenclature(@Body() data: CreateNomenclatureDto): Promise<NomenclatureEntity> {
    return await this.nomenclaturesService.createNomenclature(data);
  }

  @Post('updateNomenclature')
  async updateNomenclature(@Body() data: NomenclatureEntity): Promise<NomenclatureEntity> {
    return await this.nomenclaturesService.updateNomenclature(data);
  }

  @Post(':id')
  async deleteNomenclature(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.nomenclaturesService.deleteNomenclature(id);

    return {
      message: 'Номенклатура успешно удалена',
    };
  }
}
