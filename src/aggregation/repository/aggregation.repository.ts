import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { PackagingEntity } from '../entities/packaging.entity';

interface ContainerLabels {
  smallBoxLabel: string | null;
  bigBoxLabel: string | null;
  palletLabel: string | null;
}

@Injectable()
export class AggregationRepository {
  constructor(
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,

    @InjectRepository(PackagingEntity)
    private readonly packagingRepository: Repository<PackagingEntity>,
  ) {}

  async getActiveTask(tsdId: number): Promise<ActiveTaskEntity> {
    const activeTask = await this.activeTaskRepository.findOne({
      where: { tsdId },
      relations: {
        task: true,
      },
    });

    if (!activeTask) {
      throw new NotFoundException(`Для ТСД ${tsdId} нет активной задачи`);
    }

    return activeTask;
  }

  async saveActiveTask(activeTask: ActiveTaskEntity): Promise<ActiveTaskEntity> {
    return this.activeTaskRepository.save(activeTask);
  }

  async addProduct(activeTask: ActiveTaskEntity, code: string): Promise<PackagingEntity> {
    return this.packagingRepository.save({
      code,
      tsdId: activeTask.tsdId,
      task: activeTask.task,
    });
  }

  /**
   * Количество товаров в текущей открытой таре.
   */
  async getOpenProductCount(activeTask: ActiveTaskEntity): Promise<number> {
    switch (activeTask.aggregationLvl) {
      case 1:
        return this.packagingRepository.count({
          where: {
            tsdId: activeTask.tsdId,
            task: {
              id: activeTask.task.id,
            },
            palletLabel: IsNull(),
          },
        });

      case 2:
        return this.packagingRepository.count({
          where: {
            tsdId: activeTask.tsdId,
            task: {
              id: activeTask.task.id,
            },
            bigBoxLabel: IsNull(),
          },
        });

      case 3:
        return this.packagingRepository.count({
          where: {
            tsdId: activeTask.tsdId,
            task: {
              id: activeTask.task.id,
            },
            smallBoxLabel: IsNull(),
          },
        });

      default:
        throw new Error(`Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`);
    }
  }

  /**
   * Количество закрытых малых коробок
   * в текущей открытой большой коробке.
   *
   * Одна PackagingEntity = один товар.
   */
  async getClosedSmallBoxCount(activeTask: ActiveTaskEntity): Promise<number> {
    const recordsCount = await this.packagingRepository.count({
      where: {
        tsdId: activeTask.tsdId,
        task: {
          id: activeTask.task.id,
        },
        smallBoxLabel: Not(IsNull()),
        bigBoxLabel: IsNull(),
      },
    });

    return recordsCount / activeTask.piecesPerSmallBox;
  }

  /**
   * Количество закрытых больших коробок
   * на текущей открытой паллете.
   *
   * Одна PackagingEntity = один товар.
   */
  async getClosedBigBoxCount(activeTask: ActiveTaskEntity): Promise<number> {
    const recordsCount = await this.packagingRepository.count({
      where: {
        tsdId: activeTask.tsdId,
        task: {
          id: activeTask.task.id,
        },
        bigBoxLabel: Not(IsNull()),
        palletLabel: IsNull(),
      },
    });

    const productsPerBigBox =
      activeTask.aggregationLvl === 2
        ? activeTask.piecesPerBigBox
        : activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox;

    return recordsCount / productsPerBigBox;
  }

  /**
   * Закрывает текущую тару.
   */
  async setContainerLabel(
    activeTask: ActiveTaskEntity,
    containerType: ExpectedScanType,
    code: string,
  ): Promise<number> {
    const criteria = {
      tsdId: activeTask.tsdId,
      task: {
        id: activeTask.task.id,
      },
    };

    switch (containerType) {
      case ExpectedScanType.SMALL_BOX_LABEL: {
        const result = await this.packagingRepository.update(
          {
            ...criteria,
            smallBoxLabel: IsNull(),
          },
          {
            smallBoxLabel: code,
          },
        );

        return result.affected ?? 0;
      }

      case ExpectedScanType.BIG_BOX_LABEL: {
        const result = await this.packagingRepository.update(
          {
            ...criteria,
            bigBoxLabel: IsNull(),
          },
          {
            bigBoxLabel: code,
          },
        );

        return result.affected ?? 0;
      }

      case ExpectedScanType.PALLET_LABEL: {
        const result = await this.packagingRepository.update(
          {
            ...criteria,
            palletLabel: IsNull(),
          },
          {
            palletLabel: code,
          },
        );

        return result.affected ?? 0;
      }

      default:
        throw new Error(`Неподдерживаемый тип контейнера: ${containerType}`);
    }
  }

  async deleteProductAndResetExpectedScan(tsdId: number, code: string): Promise<string> {
    const result = await this.packagingRepository
      .createQueryBuilder()
      .delete()
      .from(PackagingEntity)
      .where('tsd_id = :tsdId', { tsdId })
      .andWhere('code = :code', { code })
      .returning(['code'])
      .execute();

    const deletedCode = result.raw[0]?.code as string | undefined;

    if (!deletedCode) {
      throw new NotFoundException(`Код ${code} не найден для ТСД ${tsdId}`);
    }

    const activeTask = await this.getActiveTask(tsdId);
    activeTask.expectedScan = ExpectedScanType.PRODUCT;

    await this.saveActiveTask(activeTask);

    return deletedCode;
  }

  async deletePackageAndResetExpectedScan(tsdId: number, packageLabel: string): Promise<string[]> {
    const result = await this.packagingRepository
      .createQueryBuilder()
      .delete()
      .from(PackagingEntity)
      .where('tsd_id = :tsdId', { tsdId })
      .andWhere(
        `(
      small_box_label = :packageLabel OR
      big_box_label = :packageLabel OR
      pallet_label = :packageLabel
    )`,
        { packageLabel },
      )
      .returning(['code'])
      .execute();

    if (!result.affected) {
      throw new NotFoundException(`Код ${packageLabel} не найден для ТСД ${tsdId}`);
    }

    const activeTask = await this.getActiveTask(tsdId);
    activeTask.expectedScan = ExpectedScanType.PRODUCT;

    await this.saveActiveTask(activeTask);

    return result.raw.map((row: { code: string }) => row.code);
  }

  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
  ): Promise<PackagingEntity> {
    const criteria = {
      tsdId: activeTask.tsdId,
      task: {
        id: activeTask.task.id,
      },
    };

    let existingPackage: PackagingEntity | null;

    switch (packageType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        existingPackage = await this.packagingRepository.findOne({
          where: { ...criteria, smallBoxLabel: packageLabel },
        });
        break;

      case ExpectedScanType.BIG_BOX_LABEL:
        existingPackage = await this.packagingRepository.findOne({
          where: { ...criteria, bigBoxLabel: packageLabel },
        });
        break;

      case ExpectedScanType.PALLET_LABEL:
        existingPackage = await this.packagingRepository.findOne({
          where: { ...criteria, palletLabel: packageLabel },
        });
        break;

      default:
        throw new NotFoundException(`Неизвестный тип тары: ${packageType}`);
    }

    if (!existingPackage) {
      throw new NotFoundException(`Тара ${packageLabel} не найдена в текущей задаче`);
    }

    return this.packagingRepository.save({
      code,
      tsdId: activeTask.tsdId,
      task: activeTask.task,
      smallBoxLabel: existingPackage.smallBoxLabel,
      bigBoxLabel: existingPackage.bigBoxLabel,
      palletLabel: existingPackage.palletLabel,
    });
  }

  async countProductsInPackage(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
  ): Promise<number> {
    const criteria = {
      tsdId: activeTask.tsdId,
      task: {
        id: activeTask.task.id,
      },
    };
    return this.packagingRepository.count({
      where: [
        { ...criteria, smallBoxLabel: packageLabel },
        { ...criteria, bigBoxLabel: packageLabel },
        { ...criteria, palletLabel: packageLabel },
      ],
    });
  }
  async searchProductInfo(activeTask: ActiveTaskEntity, code: string): Promise<PackagingEntity> {
    const product = await this.packagingRepository.findOne({
      where: {
        tsdId: activeTask.tsdId,
        task: { id: activeTask.task.id },
        code,
      },
    });

    if (!product) {
      throw new NotFoundException('Товар не найден в текущей агрегации');
    }

    return product;
  }

  async searchPackageInfo(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
  ): Promise<PackagingEntity> {
    const criteria = {
      tsdId: activeTask.tsdId,
      task: { id: activeTask.task.id },
    };

    let packaging: PackagingEntity | null = null;

    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        packaging = await this.packagingRepository.findOne({
          where: { ...criteria, smallBoxLabel: packageLabel },
        });
        break;

      case ExpectedScanType.BIG_BOX_LABEL:
        packaging = await this.packagingRepository.findOne({
          where: { ...criteria, bigBoxLabel: packageLabel },
        });
        break;

      case ExpectedScanType.PALLET_LABEL:
        packaging = await this.packagingRepository.findOne({
          where: { ...criteria, palletLabel: packageLabel },
        });
        break;

      default:
        throw new BadRequestException('Передан код не контейнера');
    }

    if (!packaging) {
      throw new NotFoundException('Упаковка не найдена в текущей агрегации');
    }

    return packaging;
  }

  async countPackageContents(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
  ): Promise<number> {
    const criteria = {
      tsdId: activeTask.tsdId,
      task: { id: activeTask.task.id },
    };

    let recordsCount: number;

    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        recordsCount = await this.packagingRepository.count({
          where: { ...criteria, smallBoxLabel: packageLabel },
        });

        // В маленькой коробке лежат товары.
        return recordsCount;

      case ExpectedScanType.BIG_BOX_LABEL:
        recordsCount = await this.packagingRepository.count({
          where: { ...criteria, bigBoxLabel: packageLabel },
        });

        // Уровень 2: большая коробка содержит товары.
        // Уровень 3: большая коробка содержит маленькие коробки.
        return activeTask.aggregationLvl === 3
          ? recordsCount / activeTask.piecesPerSmallBox
          : recordsCount;

      case ExpectedScanType.PALLET_LABEL:
        recordsCount = await this.packagingRepository.count({
          where: { ...criteria, palletLabel: packageLabel },
        });

        switch (activeTask.aggregationLvl) {
          case 1:
            // Паллет содержит товары.
            return recordsCount;

          case 2:
            // Паллет содержит большие коробки с товарами.
            return recordsCount / activeTask.piecesPerBigBox;

          case 3:
            // Паллет содержит большие коробки с маленькими коробками.
            return recordsCount / (activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox);

          default:
            throw new InternalServerErrorException(
              `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
            );
        }

      default:
        throw new BadRequestException('Невозможно посчитать содержимое товара');
    }
  }
}
