import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { configLogger } from '../logger-winston/winston.config';
import { initDirectories } from './config.paths';

interface ConfigDefinition {
  key: string;
  required: boolean;
  purpose: string;
  example?: string;
  defaultValue?: string;
  validate?: (value: string) => string | undefined;
}

interface ConfigIssue {
  key: string;
  status: 'missing' | 'empty' | 'invalid';
  recommendation: string;
}

@Injectable()
export class ConfigValidationService {
  private readonly definitions: ConfigDefinition[] = [
    {
      key: 'AVAILABLE_FILES_DIRECTORY',
      required: true,
      purpose: 'Корневая директория доступных файлов.',
      example: 'C:/Users/admin/Documents/test-server1s',
    },
    {
      key: 'FILES_DIRECTORY',
      required: false,
      purpose: 'Основная директория файлов.',
      example: 'C:/Users/admin/Documents/test-server1s/files',
    },
    {
      key: 'FILES_DIRECTORY_1S',
      required: true,
      purpose: 'Каталог JSON-файлов заданий.',
      example: 'C:/Users/admin/Documents/test-server1s/1_tasks',
    },
    {
      key: 'FILES_DIRECTORY_1S_TEMPLATE',
      required: true,
      purpose: 'Каталог шаблонов заданий.',
      example: 'C:/Users/admin/Documents/test-server1s/1_template',
    },
    {
      key: 'FILES_DIRECTORY_1S_RECORD',
      required: false,
      purpose: 'Каталог записей заданий, если используется соответствующим сервисом.',
    },
    {
      key: 'FILES_DIRECTORY_TXT_RECORD',
      required: false,
      purpose: 'Каталог TXT-записей, если используется соответствующим сервисом.',
    },
    {
      key: 'REPORT_DIRECTORY',
      required: true,
      purpose: 'Каталог отчётов, включая отчёт проверки конфигурации.',
      example: 'C:/Users/admin/Documents/test-server1s/reports',
    },
    {
      key: 'CODES_DIRECTORY',
      required: true,
      purpose: 'Каталог файлов с кодами.',
      example: 'C:/Users/admin/Downloads',
    },
    {
      key: 'POSTGRES_PATH',
      required: true,
      purpose: 'Каталог исполняемых файлов PostgreSQL для резервного копирования.',
      example: 'C:/Program Files/PostgreSQL/17/bin',
      validate: (value) =>
        path.isAbsolute(value) ? undefined : 'Укажи абсолютный путь к каталогу PostgreSQL.',
    },
    // {
    //   key: 'DB_TYPE',
    //   required: true,
    //   purpose: 'Тип используемой базы данных.',
    //   example: 'postgres',
    //   validate: (value) =>
    //     value.toLowerCase() === 'postgres' ? undefined : 'Ожидается значение postgres.',
    // },
    // {
    //   key: 'DB_HOST',
    //   required: true,
    //   purpose: 'Адрес сервера базы данных.',
    //   example: 'localhost',
    // },
    // {
    //   key: 'DB_PORT',
    //   required: true,
    //   purpose: 'Порт сервера базы данных.',
    //   example: '5432',
    //   validate: (value) =>
    //     /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535
    //       ? undefined
    //       : 'Укажи целое число от 1 до 65535.',
    // },
    // {
    //   key: 'DB_USERNAME',
    //   required: true,
    //   purpose: 'Имя пользователя базы данных.',
    //   example: 'postgres',
    // },
    // {
    //   key: 'DB_PASSWORD',
    //   required: true,
    //   purpose: 'Пароль подключения к базе данных.',
    // },
    {
      key: 'PRINTER_NAME_1',
      required: true,
      purpose: 'Имя или идентификатор принтера.',
      example: 'MB341T',
    },
    {
      key: 'PRINTER_TYPE',
      required: true,
      purpose: 'Тип или язык команд принтера.',
      example: 'ZPL',
    },
    {
      key: 'PRINTER1_DECODE_TYPE',
      required: false,
      purpose: 'Кодировка декодирования данных принтера.',
    },
    {
      key: 'PRINTER1_ENCODE_TYPE',
      required: false,
      purpose: 'Кодировка кодирования данных принтера.',
    },
    {
      key: 'PC_NAME',
      required: true,
      purpose: 'Имя рабочего компьютера.',
      example: 'DESKTOP-RG228BB',
    },
    {
      key: 'CHECK_1S_INTERVAL',
      required: true,
      purpose: 'Интервал проверки заданий в миллисекундах.',
      example: '6000',
      validate: (value) =>
        /^\d+$/.test(value) && Number(value) > 0
          ? undefined
          : 'Укажи положительное целое число в миллисекундах.',
    },
    {
      key: 'CODE_FILTER_ENABLED',
      required: true,
      purpose: 'Включение дедупликации повторных кодов для задания.',
      example: 'false',
      validate: (value) =>
        value === 'true' || value === 'false' ? undefined : 'Допустимые значения: true или false.',
    },
    {
      key: 'GLN',
      required: true,
      purpose: 'GLN организации для обработки GS1-кодов.',
      example: '466004135',
      validate: (value) => (/^\d+$/.test(value) ? undefined : 'GLN должен содержать только цифры.'),
    },
    {
      key: 'BACKUP_DIRS',
      required: true,
      purpose: 'Список каталогов резервного копирования через запятую.',
      example: 'C:/Users/admin/backup1,C:/Users/admin/backup2',
      validate: (value) =>
        value.split(',').every((directory) => directory.trim().length > 0)
          ? undefined
          : 'Укажи непустые пути, разделённые запятыми.',
    },
    {
      key: 'BACKUP_INTERVAL',
      required: true,
      purpose: 'Cron-расписание резервного копирования.',
      example: '0 0 1,16 * *',
    },
  ];

  async validateConfig(): Promise<void> {
    const issues: ConfigIssue[] = [];

    for (const definition of this.definitions) {
      const rawValue = process.env[definition.key];
      const value = rawValue?.trim() ?? '';

      if (!value) {
        if (!definition.required) {
          continue;
        }

        issues.push({
          key: definition.key,
          status: rawValue === undefined ? 'missing' : 'empty',
          recommendation: definition.example
            ? `Укажи значение, например: ${definition.example}`
            : 'Добавь переменную в .env и укажи корректное значение.',
        });

        continue;
      }

      const validationError = definition.validate?.(value);

      if (validationError) {
        issues.push({
          key: definition.key,
          status: 'invalid',
          recommendation: validationError,
        });
      }
    }

    // Успешная проверка — ничего не логируем.
    if (issues.length === 0) {
      return;
    }

    const report = [
      'ОШИБКА КОНФИГУРАЦИИ',
      ...issues.map((issue) => {
        const status = {
          missing: 'Переменная отсутствует',
          empty: 'Пустое значение',
          invalid: 'Некорректное значение',
        }[issue.status];

        return `[ERROR] ${issue.key}: ${status}. ${issue.recommendation}`;
      }),
    ].join('\n');

    configLogger.error(report);

    throw new Error('Конфигурация невалидна. Исправь .env.');
  }
  async initDirectories(): Promise<void> {
    await initDirectories();
  }
}
