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

  async updateSmallBoxNumber() {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .update(LastPackageEntity)
      .set({ smallBoxNumber: () => '"smallBoxNumber" + 1' })
      .returning('smallBoxNumber')
      .execute();

    return result.raw[0].smallBoxNumber;
  }

  async updateBigBoxNumber() {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .update(LastPackageEntity)
      .set({ bigBoxNumber: () => '"bigBoxNumber" + 1' })
      .returning('bigBoxNumber')
      .execute();

    return result.raw[0].bigBoxNumber;
  }

  async updatePalletNumber() {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .update(LastPackageEntity)
      .set({ palletNumber: () => '"palletNumber" + 1' })
      .returning('palletNumber')
      .execute();

    return result.raw[0].palletNumber;
  }
}
