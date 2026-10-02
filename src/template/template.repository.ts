import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Templates } from './template.entity';
import { TemplateTypes } from '../globalTypes';

@Injectable()
export class TemplatesRepository {
  constructor(
    @InjectRepository(Templates)
    private readonly repository: Repository<Templates>,
  ) {}

  async findOneByType(type: TemplateTypes): Promise<Templates | null> {
    return this.repository.findOne({
      where: { type },
    });
  }

  async findAll(): Promise<Templates[]> {
    return this.repository.find();
  }

  async saveTemplate(template: Templates): Promise<Templates> {
    return this.repository.save(template);
  }

  async createTemplate(data: Partial<Templates>): Promise<Templates> {
    const newTemplate = this.repository.create(data);
    return this.repository.save(newTemplate);
  }

  async updateTemplate(
    existingTemplate: Templates,
    newData: Partial<Templates>,
  ): Promise<Templates> {
    Object.assign(existingTemplate, newData);
    return this.repository.save(existingTemplate);
  }

  async findTemplateByTypeOrNull(type: TemplateTypes): Promise<Templates | null> {
    return this.findOneByType(type);
  }

  async deleteByType(type: TemplateTypes): Promise<void> {
    await this.repository.delete({ type });
  }

  async exists(type: TemplateTypes): Promise<boolean> {
    const count = await this.repository.count({
      where: { type },
    });
    return count > 0;
  }
}
