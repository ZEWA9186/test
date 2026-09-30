import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { backupLogger } from '../logger-winston/winston.config';
import { getBackupDirectories } from '../path.utils';

const execPromise = promisify(exec);

@Injectable()
export class BackupService {

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    @Cron(process.env.BACKUP_INTERVAL || "0 0 1,16 * *")
    async createDatabaseBackup() {
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `db_backup_${dateStr}.dump`;

        const backupDirs = getBackupDirectories();
        const primaryDir = backupDirs[0];
        const primaryFile = path.join(primaryDir, backupFileName);

        const options = this.dataSource.options as any;

        const host = options.host;
        const port = options.port;
        const user = options.username;
        const password = options.password;
        const database = options.database;

        const pgDumpPath = (process as any).pkg
            ? path.join(process.cwd(), 'bin', 'pg_dump.exe')
            : 'pg_dump';

        const env = { ...process.env, PGPASSWORD: String(password) };
        const command = `"${pgDumpPath}" -h ${host} -p ${port} -U ${user} -d ${database} -F c -f "${primaryFile}"`;

        try {
            backupLogger.info('Запуск создания основного бэкапа БД...');
            await execPromise(command, { env });
            backupLogger.info(`Основной бэкап успешно создан: ${primaryFile}`);

            for (let i = 1; i < backupDirs.length; i++) {
                const targetDir = backupDirs[i];

                try {
                    const targetFile = path.join(targetDir, backupFileName);
                    await fs.promises.copyFile(primaryFile, targetFile);

                    backupLogger.info(`Бэкап успешно дублирован на диск: ${targetFile}`);
                } catch (copyErr: any) {
                    backupLogger.error(`Не удалось записать бэкап на диск [${targetDir}]: ${copyErr.message}`);
                }
            }
        } catch (error: any) {
            backupLogger.error(`Ошибка создания бэкапа: ${error.message}`, error.stack);
        }
    }
}