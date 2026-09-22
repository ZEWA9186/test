import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LastPackageEntity } from './last-package.entity';
import { Repository } from 'typeorm';

@Injectable()
export class LastPackageService {
  constructor(
    @InjectRepository(LastPackageEntity)
    private lastPackageEntityRepository: Repository<LastPackageEntity>,
  ) {}

  async addNoteAndTook(
    gtin: string,
    DateTask: any,
    BatchNumber: string,
  ): Promise<{
    boxNumber: any;
    palletNumber: any;
  }> {
    const result = await this.lastPackageEntityRepository.findOne({
      where: { gtin, DateTask, BatchNumber },
    });
    if (result === null) {
      const data = this.lastPackageEntityRepository.create({
        gtin: gtin,
        BoxNumber: 1,
        PalletNumber: 1,
        DateTask: DateTask,
        BatchNumber: BatchNumber,
      });
      const saveBox = await this.lastPackageEntityRepository.save(data);
      return {
        boxNumber: saveBox.BoxNumber,
        palletNumber: saveBox.PalletNumber,
      };
    } else {
      return {
        boxNumber: result.BoxNumber,
        palletNumber: result.PalletNumber,
      };
    }
  }

  async updateBoxNumber(gtin, DateTask, BoxNumber, BatchNumber) {
    await this.lastPackageEntityRepository.update(
      { gtin: gtin, DateTask: DateTask, BatchNumber: BatchNumber },
      {
        BoxNumber: BoxNumber,
      },
    );
  }

  async updatePalletNumber(gtin, DateTask, PalletNumber, BatchNumber) {
    await this.lastPackageEntityRepository.update(
      { gtin: gtin, DateTask: DateTask, BatchNumber: BatchNumber },
      {
        PalletNumber: PalletNumber,
      },
    );
  }
}
