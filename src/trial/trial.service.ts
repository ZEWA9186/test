import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { TrialEntity } from './entities/trial.entity';
import { trialLogger } from '../logger-winston/winston.config';
import { CreateLineDto } from './dto/create-line.dto';
import { UpdateLineDto } from './dto/update-line.dto';

@Injectable()
export class TrialService {
  constructor(
    @InjectRepository(TrialEntity)
    private readonly trialRepository: Repository<TrialEntity>,
  ) {}

  async validateLineTrial(lineIp: string) {
    const lineState = await this.trialRepository.findOneBy({ lineIp });

    if (!lineState) {
    //   trialLogger.warn('Ошибка Сервера');
      throw new NotFoundException('Ошибка Сервера');
    }

    if (!lineState.isTrial) {
      return;
    }

    const isValid = lineState.remainingMinutes > 0;

    if (!isValid) {
      trialLogger.warn('Ошибка Сервера');
      throw new ForbiddenException(`Ошибка Сервера`);
    }
    return isValid;
  }

  @Cron('*/15 * * * *')
  async handleTrialDeduction() {
    try {
      const result = await this.trialRepository.update(
        { isTrial: true, remainingMinutes: MoreThan(0) },
        { remainingMinutes: () => 'GREATEST(0, "remaining_minutes" - 15)' },
      );

      if (result.affected) {
        // trialLogger.info('Ошибка Сервера');
      }
    } catch (error: any) {
      trialLogger.error(`Ошибка Сервера`);
    }
  }

  // async addLine(dto: CreateLineDto) {
  //     try {
  //         const result = await this.trialRepository.save(dto);
  //
  //         trialLogger.info(`Добавлена новая линия: ${result.lineNumber}`);
  //
  //         return {
  //             message: 'Линия успешно добавлена',
  //             lineNumber: result.lineNumber
  //         };
  //
  //     } catch (error: any) {
  //         if (error?.code === '23505') {
  //             trialLogger.warn(`Попытка повторного создания линии: ${dto.lineNumber}`);
  //             throw new ConflictException(`Линия ${dto.lineNumber} уже существует`);
  //         }
  //
  //         trialLogger.error(
  //             `Ошибка при сохранении линии ${dto.lineNumber}: ${error?.message || error}`
  //         );
  //
  //         throw new InternalServerErrorException('Не удалось сохранить конфигурацию линии');
  //     }
  // }
  //
  // async getAllLines() {
  //     return await this.trialRepository.find();
  // }
  //
  // async getOneLine(lineNumber: number) {
  //     return await this.trialRepository.findBy({lineNumber});
  // }
  //
  // async updateLine(lineNumber: number, dto: UpdateLineDto) {
  //     const result = await this.trialRepository.update({ lineNumber }, dto);
  //
  //     if (result.affected === 0) {
  //         throw new NotFoundException(`Линия ${lineNumber} не найдена`);
  //     }
  //
  //     trialLogger.info(`Обновлена линия: ${lineNumber}`);
  //     return { message: `Обновлена линия: ${lineNumber}`};
  // }
  //
  // async deleteLine(lineNumber: number) {
  //     try {
  //         await this.trialRepository.delete({ lineNumber });
  //
  //         trialLogger.warn(`Попытка удаления несуществующей линии: ${lineNumber}`);
  //
  //
  //         trialLogger.info(`Удалена линия: ${lineNumber}`);
  //
  //         return { message: 'Линия удалена' };
  //     } catch (error: any) {
  //
  //         trialLogger.error(
  //             `Ошибка при удалении линии ${lineNumber}: ${error?.message || error}`,
  //         );
  //
  //         throw new InternalServerErrorException(`Не удалось удалить линию: ${error?.message || error}`);
  //     }
  // }
}
