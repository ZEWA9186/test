import { Inject, Injectable } from '@nestjs/common';
import { TemplateRequest } from './types';
import { Logger } from 'winston';
import { templateLogger } from '../logger-winston/winston.config';
import { TemplatesRepository } from './template.repository';
import { TemplateTypes } from '../globalTypes';

@Injectable()
export class TemplateService {
  private templates: Partial<Record<TemplateTypes, string[] | null>> = {};
  private loaded: Partial<Record<TemplateTypes, boolean>> = {};
  private isLoading = false;

  constructor(
    private readonly templatesRepository: TemplatesRepository,
    @Inject('winston') private readonly logger: Logger = templateLogger,
  ) {
    this.initTemplates();
  }

  private async initTemplates(): Promise<void> {
    try {
      const templates = await this.templatesRepository.findAll();
      templates.forEach((t) => {
        this.templates[t.type] = t.template;
        this.loaded[t.type] = true;
      });
      this.logger.info(`Шаблоны: Инициализация ----!`);
    } catch (err) {
      this.logger.error(`Шаблоны:Ошибка инициализации ${err.message}`);
    }
  }

  private async loadTemplate(type: TemplateTypes): Promise<void> {
    if (this.loaded[type] || this.isLoading) return;
    this.isLoading = true;
    try {
      const template = await this.templatesRepository.findOneByType(type);
      this.templates[type] = template?.template || null;
      this.loaded[type] = true;
    } catch (err) {
      this.logger.error(`Шаблоны: Ошибка загрузки ${type}: ${err.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  getBoxTemplate(): string[] | null {
    if (!this.loaded[TemplateTypes.Box]) {
      this.loadTemplate(TemplateTypes.Box);
    }
    return this.templates[TemplateTypes.Box] || null;
  }

  getPalletTemplate(): string[] | null {
    if (!this.loaded[TemplateTypes.Pallet]) {
      this.loadTemplate(TemplateTypes.Pallet);
    }
    return this.templates[TemplateTypes.Pallet] || null;
  }

  async saveTemplate(data: TemplateRequest): Promise<any> {
    try {
      const existing = await this.templatesRepository.findOneByType(data.type);
      let result;
      if (existing) {
        existing.template = data.template;
        result = await this.templatesRepository.saveTemplate(existing);
      } else {
        result = await this.templatesRepository.createTemplate(data);
      }
      this.templates[data.type] = data.template;
      this.loaded[data.type] = true;
      return result;
    } catch (err) {
      this.logger.error(`Шаблоны: ошибка сохранения ${err.message}`);
      throw err;
    }
  }

  getAll(): any[] {
    if (!this.loaded[TemplateTypes.Box]) {
      this.loadTemplate(TemplateTypes.Box);
    }
    if (!this.loaded[TemplateTypes.Pallet]) {
      this.loadTemplate(TemplateTypes.Pallet);
    }

    const result = [];
    if (this.templates[TemplateTypes.Box] !== undefined) {
      result.push({
        type: TemplateTypes.Box,
        template: this.templates[TemplateTypes.Box],
      });
    }
    if (this.templates[TemplateTypes.Pallet] !== undefined) {
      result.push({
        type: TemplateTypes.Pallet,
        template: this.templates[TemplateTypes.Pallet],
      });
    }
    return result;
  }
}
