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

  async updateSmallBoxNumber(gtin: string, dateTask: string, batchNumber: string) {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .insert()
      .into(LastPackageEntity)
      .values({
        gtin,
        dateTask,
        batchNumber,
        smallBoxNumber: 1,
      })
      .onConflict(
        `("gtin", "dateTask", "batchNumber") DO UPDATE SET "smallBoxNumber" = "last_package_entity"."smallBoxNumber" + 1`,
      )
      .returning('smallBoxNumber')
      .execute();

    return result.raw[0].smallBoxNumber;
  }

  async updateBigBoxNumber(gtin: string, dateTask: string, batchNumber: string) {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .insert()
      .into(LastPackageEntity)
      .values({
        gtin,
        dateTask,
        batchNumber,
        bigBoxNumber: 1,
      })
      .onConflict(
        `("gtin", "dateTask", "batchNumber") DO UPDATE SET "bigBoxNumber" = "last_package_entity"."bigBoxNumber" + 1`,
      )
      .returning('bigBoxNumber')
      .execute();

    return result.raw[0].bigBoxNumber;
  }

  async updatePalletNumber(gtin: string, dateTask: string, batchNumber: string) {
    const result = await this.lastPackageEntityRepository
      .createQueryBuilder()
      .insert()
      .into(LastPackageEntity)
      .values({
        gtin,
        dateTask,
        batchNumber,
        palletNumber: 1,
      })
      .onConflict(
        `("gtin", "dateTask", "batchNumber") DO UPDATE SET "palletNumber" = "last_package_entity"."palletNumber" + 1`,
      )
      .returning('palletNumber')
      .execute();

    return result.raw[0].palletNumber;
  }
}
