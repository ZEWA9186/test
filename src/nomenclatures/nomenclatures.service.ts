import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { NomenclatureEntity } from './entities/nomenclature.entity';

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

  async createNomenclature(data: DeepPartial<NomenclatureEntity>): Promise<NomenclatureEntity> {
    const nomenclature = this.nomenclatureRepository.create(data);

    return await this.nomenclatureRepository.save(nomenclature);
  }

  async updateNomenclature(data: NomenclatureEntity): Promise<NomenclatureEntity> {
    return await this.nomenclatureRepository.save(data);
  }

  async deleteNomenclature(id: number): Promise<void> {
    const nomenclature = await this.getNomenclatureById(id);

    if (!nomenclature) {
      throw new NotFoundException(`Номенклатура с ID ${id} не найдена`);
    }

    await this.nomenclatureRepository.remove(nomenclature);
  }
}
