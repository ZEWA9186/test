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

  async updateBoxNumber(gtin: string, dateTask: string, batchNumber: string) {
    const existing = await this.lastPackageEntityRepository.findOne({
      where: { gtin, dateTask, batchNumber },
    });

    const result = existing ?? this.lastPackageEntityRepository.create({
        gtin,
        boxNumber: 1,
        dateTask,
        batchNumber,
      });
    result.boxNumber += 1;

    const saved = await this.lastPackageEntityRepository.save(result);
    return saved.boxNumber;
  }

  async updatePalletNumber(gtin: string, dateTask: string, batchNumber: string) {

    const existing = await this.lastPackageEntityRepository.findOne({
      where: { gtin, dateTask, batchNumber },
    });

      const result = existing ?? this.lastPackageEntityRepository.create({
        gtin,
        palletNumber: 1,
        dateTask,
        batchNumber,
      });
      result.palletNumber += 1;

    const saved = await this.lastPackageEntityRepository.save(result);
    return saved.palletNumber;
  }
}
