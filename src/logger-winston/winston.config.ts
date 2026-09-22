import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_IN_MEMORY_LOGS = 1000;
let logMessages: any[] = [];

const combinedTransport = new DailyRotateFile({
    filename: path.join(LOGS_DIR, 'combined', '%DATE%-combined.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '10d',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const log = { level, message, timestamp, ...meta };

            logMessages.unshift(log);
            if (logMessages.length > MAX_IN_MEMORY_LOGS) {
                logMessages.pop();
            }

            return JSON.stringify(log);
        }),
    ),
});

const createLogger = (filename: string) => {
    return winston.createLogger({
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize({
                        all: true,
                        colors: { info: 'blue', error: 'red', warn: 'yellow' },
                    }),
                    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    winston.format.printf(
                        ({ timestamp, level, message }) =>
                            `[${filename}] ${timestamp} ${level}: ${message}`,
                    ),
                ),
            }),

            new DailyRotateFile({
                filename: path.join(LOGS_DIR, filename, '%DATE%-app.log'),
                datePattern: 'YYYY-MM-DD',
                maxFiles: '10d',
                format: winston.format.combine(
                    winston.format.timestamp({ format: 'DD.MM.YYYY HH:mm:ss' }),
                    winston.format.printf(({ timestamp, level, message, ...meta }) =>
                        JSON.stringify({ level, message, timestamp, ...meta }),
                    ),
                ),
            }),
            combinedTransport,
        ],
    });
};

export const codeLogger = createLogger('code');
export const trialLogger = createLogger('trial');
export const logger1S = createLogger('logger1S');

export const getLastLogMessages = () => logMessages.slice(0, 1);
export const getLogMessages = () => logMessages;
export const resetLogMessages = () => (logMessages = []);