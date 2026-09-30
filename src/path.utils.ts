import path from 'node:path';
import fs from 'node:fs/promises';

const getEnv = (key: string): string => {
  const val = process.env[key];
  if (!val)
    throw new Error(`[CONFIG ERROR] ${key} is not defined in .env file`);
  return val;
};

export const getJsonDirectory1S = (): string => getEnv('FILES_DIRECTORY_1S');

export const getJsonDirectory1STemplate = (): string =>
  getEnv('FILES_DIRECTORY_1S_TEMPLATE');

export const getAvailableFilesDirectory = (): string =>
  getEnv('AVAILABLE_FILES_DIRECTORY');

export const getTemplateDirectory = (): string => {
  return path.join(getAvailableFilesDirectory(), 'template_files');
};

export const getPostgresPath = (): string => getEnv('POSTGRES_PATH');

export const getLineTaskDirectory = (lineNum: number): string => {
  const envKey = `LINE_TASK_DIRECTORY`;
  return path.resolve(getEnv(envKey), `${lineNum}`);
};

export const getBackupDirectories = (): string[] => {
  return getEnv('BACKUP_DIRS')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
};

export const getLineCount = (): number => {
  const rawLineCount = getEnv('LINE_COUNT');
  const lineCount = parseInt(rawLineCount, 10);
  if (isNaN(lineCount) || lineCount <= 0) {
    throw new Error(
      '[CONFIG ERROR] LINE_COUNT must be a valid positive integer',
    );
  }
  return lineCount;
};

export function validateEnvironment(): void {
  getAvailableFilesDirectory();
  getJsonDirectory1S();
  getJsonDirectory1STemplate();
  getBackupDirectories();
  getLineCount();
  getPostgresPath();
  getLineTaskDirectory(1);
}

export async function initDirectories(): Promise<void> {
  validateEnvironment();

  const lineCount = getLineCount();
  const directories = [
    getJsonDirectory1S(),
    getJsonDirectory1STemplate(),
    getTemplateDirectory(),
    ...getBackupDirectories(),
  ];

  for (let i = 1; i <= lineCount; i++) {
    directories.push(getLineTaskDirectory(i));
  }

  await Promise.all(
    directories.map((dir) => fs.mkdir(dir, { recursive: true })),
  );

  console.log('Файловая структура инициализирована.');
}
