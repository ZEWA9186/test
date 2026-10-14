import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LastPackageEntity } from './entities/last-package.entity';
import { Repository } from 'typeorm';

@Injectable()
export class LastPackageService {
  constructor(
    @InjectRepository(LastPackageEntity)
    private lastPackageEntityRepository: Repository<LastPackageEntity>,
  ) {}

  async updateSmallBoxNumber(): Promise<number> {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .update(LastPackageEntity)
      .set({ smallBoxNumber: () => '"small_box_number" + 1' })
      .returning('small_box_number')
      .execute();

    return Number(result.raw[0].small_box_number);
  }

  async updateBigBoxNumber(): Promise<number> {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .update(LastPackageEntity)
      .set({ bigBoxNumber: () => '"big_box_number" + 1' })
      .returning('big_box_number')
      .execute();

    return Number(result.raw[0].big_box_number);
  }

  async updatePalletNumber(): Promise<number> {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .update(LastPackageEntity)
      .set({ palletNumber: () => '"pallet_number" + 1' })
      .returning('pallet_number')
      .execute();

    return Number(result.raw[0].pallet_number);
  }
}
