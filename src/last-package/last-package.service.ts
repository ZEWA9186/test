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
    const existing = await this.lastPackageEntityRepository.findOne({
      where: { gtin, dateTask, batchNumber },
    });

    const result =
      existing ??
      this.lastPackageEntityRepository.create({
        gtin,
        smallBoxNumber: 0,
        dateTask,
        batchNumber,
      });
    result.smallBoxNumber += 1;

    const saved = await this.lastPackageEntityRepository.save(result);
    return saved.smallBoxNumber;
  }

  async updateBigBoxNumber(gtin: string, dateTask: string, batchNumber: string) {
    const existing = await this.lastPackageEntityRepository.findOne({
      where: { gtin, dateTask, batchNumber },
    });

    const result =
      existing ??
      this.lastPackageEntityRepository.create({
        gtin,
        bigBoxNumber: 0,
        dateTask,
        batchNumber,
      });
    result.bigBoxNumber += 1;

    const saved = await this.lastPackageEntityRepository.save(result);
    return saved.bigBoxNumber;
  }

  async updatePalletNumber(gtin: string, dateTask: string, batchNumber: string) {
    const existing = await this.lastPackageEntityRepository.findOne({
      where: { gtin, dateTask, batchNumber },
    });

    const result =
      existing ??
      this.lastPackageEntityRepository.create({
        gtin,
        palletNumber: 0,
        dateTask,
        batchNumber,
      });
    result.palletNumber += 1;

    const saved = await this.lastPackageEntityRepository.save(result);
    return saved.palletNumber;
  }
}
