import {
    Injectable,
    NestMiddleware,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TrialService } from './trial.service';

@Injectable()
export class TrialHeaderMiddleware implements NestMiddleware {
    constructor(private readonly trialService: TrialService) {}


    async use(req: Request, res: Response, next: NextFunction) {
        // const rawLineNumber = req.headers['line-number'] as string;
        //
        // if (!rawLineNumber) {
        //     throw new UnauthorizedException(
        //         'Отсутствует обязательный заголовок line-number',
        //     );
        // }
        //
        // const lineNumber = parseInt(rawLineNumber, 10);
        // if (isNaN(lineNumber)) {
        //     throw new BadRequestException(
        //         'Заголовок line-number должен быть корректным числом',
        //     );
        // }
        // try {
        //     await this.trialService.validateLineTrial(lineNumber);
        // }catch (error) {
        //     throw new BadRequestException()
        // }
        // next();


        const getHeader = (val?: string | string[]): string | undefined =>
            Array.isArray(val) ? val[0] : val;

        const cleanIp = (ip?: string): string => ip?.replace(/^::ffff:/, '') || '';

        const lineIp = cleanIp(
            getHeader(req.headers['x-forwarded-for'])?.split(',')[0].trim() ||
            getHeader(req.headers['x-real-ip']) ||
            req.socket?.remoteAddress ||
            req.connection?.remoteAddress
        );

            try {
                if(lineIp && lineIp.length > 1) {
                    await this.trialService.validateLineTrial(lineIp);
                }
            } catch (e) {
                throw new InternalServerErrorException()
            }
        next();
    }
}