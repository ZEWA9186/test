import {
    Injectable,
    BadRequestException,
    ConflictException,
    InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodeEntity } from './entities/code.entity';
import { codeLogger } from '../logger-winston/winston.config';

@Injectable()
export class CodeService {
    constructor(
        @InjectRepository(CodeEntity)
        private readonly codeRepository: Repository<CodeEntity>,
    ) {}

    async validateAndSaveCode(code: string) {
        const startTime = performance.now();

        if (!code) {
            throw new BadRequestException('Код не может быть пустым');
        }

        try {
            await this.codeRepository.insert({ code });
            codeLogger.info(`Код ${code} успешно сохранён`);

            console.log("Время: ", performance.now() - startTime);

            return { message: 'Код успешно сохранён' };

        } catch (error: any) {
            if (error?.code === '23505') {
                codeLogger.warn(`Попытка дублирования кода: ${code}`);
                throw new ConflictException('Код уже существует в базе');
            }

            codeLogger.error(`Ошибка при сохранении кода: ${error?.message || error}`);
            throw new InternalServerErrorException('Ошибка при сохранении кода');
        }
    }

    async batchValidateAndSaveCode(codes: string[]) {
        if (!codes || !codes.length) {
            throw new BadRequestException('Передан пустой массив кодов');
        }

        if (new Set(codes).size !== codes.length) {
            codeLogger.warn('В переданном массиве есть дубликаты');
            throw new BadRequestException('В переданном массиве есть дубликаты');
        }

        try {
            await this.codeRepository.insert(codes.map((code) => ({ code })));
            codeLogger.info(`Коды успешно сохранены`);

            return { message: 'Коды успешно сохранены' };

        } catch (error: any) {
            if (error?.code === '23505') {
                codeLogger.warn('Один или несколько кодов уже есть в базе');
                throw new ConflictException('Один или несколько кодов уже есть в базе');
            }

            codeLogger.error(`Ошибка при сохранении кодов: ${error?.message || error}`);
            throw new InternalServerErrorException('Ошибка при сохранении кодов');
        }
    }

    async getCodes(codes: string[]) {
        const data = await this.codeRepository.query(
            'SELECT code FROM "code_entity" WHERE code = ANY($1)',
            codes
        )
        return data.map((el : any) => el.code);
    }

    async deleteCode(code: string) {
        try {
            await this.codeRepository.delete({code});
            codeLogger.info('Удаление кода');
            return { message: 'Код успешно удалён' };
        } catch (error : any) {
            codeLogger.error(error.message || error);
            throw new InternalServerErrorException();
        }
    }
}