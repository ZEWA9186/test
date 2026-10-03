import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NomenclatureEntity } from './entities/nomenclature.entity';
import { CreateNomenclatureDto } from './dto/create-nomenclature.dto';

@Injectable()
export class NomenclaturesService {
  constructor(
    @InjectRepository(NomenclatureEntity)
    private readonly nomenclatureRepository: Repository<NomenclatureEntity>,
  ) {}

  async getAllNomenclatures(): Promise<NomenclatureEntity[]> {
    return await this.nomenclatureRepository.find();
  }

  async getNomenclatureById(id: number): Promise<NomenclatureEntity | null> {
    return await this.nomenclatureRepository.findOne({
      where: { id },
    });
  }

  async createNomenclature(data: CreateNomenclatureDto): Promise<NomenclatureEntity> {
    const nomenclature = this.nomenclatureRepository.create(data);

    return await this.nomenclatureRepository.save(nomenclature);
  }

  async deleteNomenclature(id: number): Promise<void> {
    const nomenclature = await this.getNomenclatureById(id);

    if (!nomenclature) {
      throw new NotFoundException(`Номенклатура с ID ${id} не найдена`);
    }

    await this.nomenclatureRepository.remove(nomenclature);
  }
}
