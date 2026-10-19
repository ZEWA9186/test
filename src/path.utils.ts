import path from 'node:path';
import fs from 'node:fs/promises';

const getEnv = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`[CONFIG ERROR] ${key} is not defined in .env file`);
  return val;
};

export const getJsonDirectory1S = (): string => getEnv('FILES_DIRECTORY_1S');

export const getJsonDirectory1STemplate = (): string => getEnv('FILES_DIRECTORY_1S_TEMPLATE');

export const getAvailableFilesDirectory = (): string => getEnv('AVAILABLE_FILES_DIRECTORY');

export const getTemplateDirectory = (): string => {
  return path.join(getAvailableFilesDirectory(), 'template_files');
};

export const getLocalReportsDirectory = (): string => getEnv('REPORT_DIRECTORY');

export const getPostgresPath = (): string => getEnv('POSTGRES_PATH');

export const getBackupDirectories = (): string[] => {
  return getEnv('BACKUP_DIRS')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
};

export async function initDirectories(): Promise<void> {
  const directories = [
    getJsonDirectory1S(),
    getJsonDirectory1STemplate(),
    getTemplateDirectory(),
    getLocalReportsDirectory(),
    ...getBackupDirectories(),
  ];

  await Promise.all(directories.map((dir) => fs.mkdir(dir, { recursive: true })));

  console.log('Файловая структура инициализирована.');
}
