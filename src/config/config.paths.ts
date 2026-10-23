import path from 'node:path';
import fs from 'node:fs/promises';

const getEnv = (key: string): string => {
  const val = process.env[key];

  if (!val) {
    throw new Error(`[CONFIG ERROR] ${key} is not defined in .env file`);
  }

  return val;
};

export const getAvailableFilesDirectory = (): string => getEnv('AVAILABLE_FILES_DIRECTORY');

export const getFilesDirectory = (): string => getEnv('FILES_DIRECTORY');

export const getJsonDirectory1S = (): string => getEnv('FILES_DIRECTORY_1S');

export const getJsonDirectory1STemplate = (): string => getEnv('FILES_DIRECTORY_1S_TEMPLATE');

export const getJsonDirectory1SRecord = (): string => getEnv('FILES_DIRECTORY_1S_RECORD');

export const getTemplateDirectory = (): string =>
  path.join(getAvailableFilesDirectory(), 'template_files');

export const getLocalReportsDirectory = (): string => getEnv('REPORT_DIRECTORY');

export const getCodesDirectory = (): string => getEnv('CODES_DIRECTORY');

export const getPostgresPath = (): string => getEnv('POSTGRES_PATH');

export const getBackupDirectories = (): string[] =>
  getEnv('BACKUP_DIRS')
    .split(',')
    .map((directory) => directory.trim())
    .filter(Boolean);

export async function initDirectories(): Promise<void> {
  const directories = [
    getFilesDirectory(),
    getJsonDirectory1S(),
    getJsonDirectory1STemplate(),
    getJsonDirectory1SRecord(),
    getTemplateDirectory(),
    getLocalReportsDirectory(),
    ...getBackupDirectories(),
  ];

  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })));

  console.log('Файловая структура инициализирована.');
}
