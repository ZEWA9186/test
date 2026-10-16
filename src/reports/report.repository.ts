import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaskHistoryEntity } from 'src/task-history/entity/task-history.entity';
import { TaskHistoryPackagingEntity } from 'src/task-history/entity/task-history-packaging.entity';

export interface ArchivedReportData {
  history: TaskHistoryEntity;
  records: TaskHistoryPackagingEntity[];
}

@Injectable()
export class ReportRepository {
  constructor(
    @InjectRepository(TaskHistoryEntity)
    private readonly historyRepository: Repository<TaskHistoryEntity>,
  ) {}

  /** Загружает архивное задание вместе со всеми его упаковочными записями. */
  async getReportData(taskId: number): Promise<ArchivedReportData | null> {
    const history = await this.historyRepository.findOne({
      where: { id: taskId },
      relations: {
        packagingRecords: true,
      },
      order: {
        packagingRecords: {
          createdAt: 'ASC',
          id: 'ASC',
        },
      },
    });

    if (!history) {
      return null;
    }

    return {
      history,
      records: history.packagingRecords ?? [],
    };
  }
}
