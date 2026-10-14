import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';

import { ActiveTaskEntity, ExpectedScanType } from '../entities/active-task.entity';
import { PackagingEntity } from '../entities/packaging.entity';

@Injectable()
export class AggregationRepository {
  constructor(
    @InjectRepository(ActiveTaskEntity)
    private readonly activeTaskRepository: Repository<ActiveTaskEntity>,

    @InjectRepository(PackagingEntity)
    private readonly packagingRepository: Repository<PackagingEntity>,
  ) {}

  private getActiveTaskRepository(manager?: EntityManager): Repository<ActiveTaskEntity> {
    return manager ? manager.getRepository(ActiveTaskEntity) : this.activeTaskRepository;
  }

  private getPackagingRepository(manager?: EntityManager): Repository<PackagingEntity> {
    return manager ? manager.getRepository(PackagingEntity) : this.packagingRepository;
  }

  async getActiveTask(tsdId: number, manager?: EntityManager): Promise<ActiveTaskEntity> {
    const activeTask = await this.getActiveTaskRepository(manager).findOne({
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

  async saveActiveTask(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<ActiveTaskEntity> {
    return this.getActiveTaskRepository(manager).save(activeTask);
  }

  async addProduct(
    activeTask: ActiveTaskEntity,
    code: string,
    manager?: EntityManager,
  ): Promise<PackagingEntity> {
    return this.getPackagingRepository(manager).save({
      code,
      tsdId: activeTask.tsdId,
      task: activeTask.task,
    });
  }

  /**
   * Количество товаров в текущей открытой таре.
   */
  async getOpenProductCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    const repository = this.getPackagingRepository(manager);

    const criteria = {
      tsdId: activeTask.tsdId,
      task: {
        id: activeTask.task.id,
      },
    };

    switch (activeTask.aggregationLvl) {
      case 1:
        return repository.count({
          where: {
            ...criteria,
            palletLabel: IsNull(),
          },
        });

      case 2:
        return repository.count({
          where: {
            ...criteria,
            bigBoxLabel: IsNull(),
          },
        });

      case 3:
        return repository.count({
          where: {
            ...criteria,
            smallBoxLabel: IsNull(),
          },
        });

      default:
        throw new InternalServerErrorException(
          `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
        );
    }
  }

  /**
   * Количество закрытых малых коробок,
   * ещё не помещённых в большую коробку.
   *
   * Одна PackagingEntity = один товар.
   */
  async getClosedSmallBoxCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    const recordsCount = await this.getPackagingRepository(manager).count({
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
   * Количество закрытых больших коробок,
   * ещё не помещённых на паллету.
   *
   * Одна PackagingEntity = один товар.
   */
  async getClosedBigBoxCount(
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<number> {
    const recordsCount = await this.getPackagingRepository(manager).count({
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
   * Закрывает текущую тару, присваивая этикетку товарам внутри неё.
   */
  async setContainerLabel(
    activeTask: ActiveTaskEntity,
    containerType: ExpectedScanType,
    code: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repository = this.getPackagingRepository(manager);

    const criteria = {
      tsdId: activeTask.tsdId,
      task: {
        id: activeTask.task.id,
      },
    };

    const exists = await repository.exists({
      where: [{ smallBoxLabel: code }, { bigBoxLabel: code }, { palletLabel: code }],
    });

    if (exists) {
      throw new BadRequestException(`Этикетка ${code} уже зарегистрирована в фасовке`);
    }

    switch (containerType) {
      case ExpectedScanType.SMALL_BOX_LABEL: {
        const result = await repository.update(
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
        const result = await repository.update(
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
        const result = await repository.update(
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
        throw new BadRequestException(`Неподдерживаемый тип контейнера: ${containerType}`);
    }
  }

  async deleteProduct(code: string, manager?: EntityManager): Promise<string> {
    const repository = this.getPackagingRepository(manager);

    const result = await repository
      .createQueryBuilder()
      .delete()
      .from(PackagingEntity)
      .where('code = :code', { code })
      .returning(['code'])
      .execute();

    const deletedCode = result.raw[0]?.code as string | undefined;

    if (!deletedCode) {
      throw new NotFoundException(`Код ${code} не найден`);
    }

    return deletedCode;
  }

  async deletePackage(packageLabel: string, manager?: EntityManager): Promise<string[]> {
    const repository = this.getPackagingRepository(manager);

    const result = await repository
      .createQueryBuilder()
      .delete()
      .from(PackagingEntity)
      .where(
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
      throw new NotFoundException(`Упаковка ${packageLabel}`);
    }

    return result.raw.map((row: { code: string }) => row.code);
  }

  async addProductIntoPackage(
    activeTask: ActiveTaskEntity,
    code: string,
    packageLabel: string,
    packageType: ExpectedScanType,
    manager?: EntityManager,
  ): Promise<PackagingEntity> {
    const repository = this.getPackagingRepository(manager);

    const criteria = {
      task: {
        id: activeTask.task.id,
      },
    };

    let existingPackage: PackagingEntity | null;

    switch (packageType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        existingPackage = await repository.findOne({
          where: {
            ...criteria,
            smallBoxLabel: packageLabel,
          },
        });
        break;

      case ExpectedScanType.BIG_BOX_LABEL:
        existingPackage = await repository.findOne({
          where: {
            ...criteria,
            bigBoxLabel: packageLabel,
          },
        });
        break;

      case ExpectedScanType.PALLET_LABEL:
        existingPackage = await repository.findOne({
          where: {
            ...criteria,
            palletLabel: packageLabel,
          },
        });
        break;

      default:
        throw new BadRequestException(`Неизвестный тип тары: ${packageType}`);
    }

    if (!existingPackage) {
      throw new NotFoundException(`Тара ${packageLabel} не найдена в текущей задаче`);
    }

    return repository.save({
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
    manager?: EntityManager,
  ): Promise<number> {
    const criteria = {
      task: {
        id: activeTask.task.id,
      },
    };

    return this.getPackagingRepository(manager).count({
      where: [
        {
          ...criteria,
          smallBoxLabel: packageLabel,
        },
        {
          ...criteria,
          bigBoxLabel: packageLabel,
        },
        {
          ...criteria,
          palletLabel: packageLabel,
        },
      ],
    });
  }

  async searchProductInfo(activeTask: ActiveTaskEntity, code: string): Promise<PackagingEntity> {
    const product = await this.getPackagingRepository().findOne({
      where: {
        task: {
          id: activeTask.task.id,
        },
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
    const repository = this.getPackagingRepository();

    const criteria = {
      task: {
        id: activeTask.task.id,
      },
    };

    let packaging: PackagingEntity | null = null;

    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        packaging = await repository.findOne({
          where: {
            ...criteria,
            smallBoxLabel: packageLabel,
          },
        });
        break;

      case ExpectedScanType.BIG_BOX_LABEL:
        packaging = await repository.findOne({
          where: {
            ...criteria,
            bigBoxLabel: packageLabel,
          },
        });
        break;

      case ExpectedScanType.PALLET_LABEL:
        packaging = await repository.findOne({
          where: {
            ...criteria,
            palletLabel: packageLabel,
          },
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

  async moveBox(
    boxLabel: string,
    palletLabel: string,
    activeTask: ActiveTaskEntity,
    manager?: EntityManager,
  ): Promise<void> {
    const criteria = {
      task: {
        id: activeTask.task.id,
      },
    };

    await this.getPackagingRepository(manager).update(
      {
        ...criteria,
        bigBoxLabel: boxLabel,
      },
      {
        palletLabel,
      },
    );
  }

  async countPackageContents(
    activeTask: ActiveTaskEntity,
    packageLabel: string,
    scanType: ExpectedScanType,
  ): Promise<number> {
    const repository = this.getPackagingRepository();

    const criteria = {
      task: {
        id: activeTask.task.id,
      },
    };

    let recordsCount: number;

    switch (scanType) {
      case ExpectedScanType.SMALL_BOX_LABEL:
        // Маленькая коробка содержит товары.
        return repository.count({
          where: {
            ...criteria,
            smallBoxLabel: packageLabel,
          },
        });

      case ExpectedScanType.BIG_BOX_LABEL:
        recordsCount = await repository.count({
          where: {
            ...criteria,
            bigBoxLabel: packageLabel,
          },
        });

        // Уровень 2: большая коробка содержит товары.
        // Уровень 3: большая коробка содержит маленькие коробки.
        return activeTask.aggregationLvl === 3
          ? recordsCount / activeTask.piecesPerSmallBox
          : recordsCount;

      case ExpectedScanType.PALLET_LABEL:
        recordsCount = await repository.count({
          where: {
            ...criteria,
            palletLabel: packageLabel,
          },
        });

        switch (activeTask.aggregationLvl) {
          case 1:
            return recordsCount;

          case 2:
            return recordsCount / activeTask.piecesPerBigBox;

          case 3:
            return recordsCount / (activeTask.piecesPerSmallBox * activeTask.piecesPerBigBox);

          default:
            throw new InternalServerErrorException(
              `Неизвестный уровень агрегации: ${activeTask.aggregationLvl}`,
            );
        }

      default:
        throw new BadRequestException('Невозможно посчитать содержимое упаковки');
    }
  }
}
