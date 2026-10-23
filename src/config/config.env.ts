const getEnv = (key: string): string => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`[CONFIG ERROR] ${key} is not defined in .env`);
  }

  return value;
};

export const getDatabaseConfig = () => ({
  type: getEnv('DB_TYPE'),
  host: getEnv('DB_HOST'),
  port: Number(getEnv('DB_PORT')),
  username: getEnv('DB_USERNAME'),
  password: getEnv('DB_PASSWORD'),
});

export const getPrinterName = (): string => getEnv('PRINTER_NAME_1');

export const getPrinterType = (): string => getEnv('PRINTER_TYPE');

export const getPrinterDecodeType = (): string | undefined =>
  process.env.PRINTER1_DECODE_TYPE?.trim() || undefined;

export const getPrinterEncodeType = (): string | undefined =>
  process.env.PRINTER1_ENCODE_TYPE?.trim() || undefined;

export const getPcName = (): string => getEnv('PC_NAME');

export const getCheck1SInterval = (): number => Number(process.env.CHECK_1S_INTERVAL);

export const isCodeFilterEnabled = (): boolean => process.env.CODE_FILTER_ENABLED === 'true';

export const getBackupInterval = (): string => getEnv('BACKUP_INTERVAL');

export const getGLN = (): string => getEnv('GLN');
