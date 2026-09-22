import path from "path";
import * as fs from "node:fs";

export const getFilesDirectory1S = (): string => {
    const val = process.env.FILES_DIRECTORY_1S;
    if (!val) throw new Error('FILES_DIRECTORY_1S is not defined in .env file');
    return val;
};

export const getJsonDirectory1S = (): string => {
    return path.join(getFilesDirectory1S());
};

export const getFilesDirectory1STemplate = (): string => {
    const val = process.env.FILES_DIRECTORY_1S_TEMPLATE;
    if (!val) throw new Error('FILES_DIRECTORY_1S_TEMPLATE is not defined in .env file');
    return val;
};

export const getJsonDirectory1STemplate = (): string => {
    return path.join(getFilesDirectory1STemplate());
};


export const getAvailableFilesDirectory = (): string => {
    const val = process.env.AVAILABLE_FILES_DIRECTORY;
    if (!val) throw new Error('AVAILABLE_FILES_DIRECTORY is not defined in .env file');
    return val;
};

export const getTemplateDirectory = (): string => {
    return path.join(getAvailableFilesDirectory(), 'template_files');
};

export const getLineTaskDirectory = (lineNum: number): string => {
    const envKey = `LINE_TASK_DIRECTORY${lineNum}`;
    const lineDirectory = process.env[envKey];
    if (!lineDirectory) {
        throw new Error(`${envKey} is not defined in .env file`);
    }
    return path.resolve(lineDirectory);
};


function validateEnvironment(): void {

    const rawLineCount = process.env.LINE_COUNT;
    if (!rawLineCount) {
        throw new Error('[CONFIG ERROR] LINE_COUNT is not defined in .env file');
    }
    const lineCount = parseInt(rawLineCount, 10);
    if (isNaN(lineCount) || lineCount <= 0) {
        throw new Error('[CONFIG ERROR] LINE_COUNT must be a valid positive integer');
    }

    // 2. Проверяем обязательные базовые пути (выбросят ошибку, если пусто)
    getAvailableFilesDirectory();
    getFilesDirectory1S();
    getFilesDirectory1STemplate();

    // 3. Проверяем, что для каждой заявленной линии прописан свой SHARE_DIRECTORY
    for (let i = 1; i <= lineCount; i++) {
        getLineTaskDirectory(i);
    }
}
export async function  initDirectories() {
    validateEnvironment();

    const directories = [
        getJsonDirectory1S(),         // Входящие от 1С (1_tasks)
        getJsonDirectory1STemplate(), // Шаблоны 1С (1_template)
        getTemplateDirectory(),       // Принтерные шаблоны (.prn)
    ];

    for (const dir of directories) {
        if (dir) {
            await fs.promises.mkdir(dir, { recursive: true });      }
    }

    console.log('Файловая структура инициализирована.');
}