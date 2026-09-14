import {
    Injectable,
    NestMiddleware,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TrialService } from './trial.service';

@Injectable()
export class TrialHeaderMiddleware implements NestMiddleware {
    constructor(private readonly trialService: TrialService) {}

    async use(req: Request, res: Response, next: NextFunction) {
        const rawLineNumber = req.headers['line-number'] as string;

        if (!rawLineNumber) {
            throw new UnauthorizedException(
                'Отсутствует обязательный заголовок line-number',
            );
        }

        const lineNumber = parseInt(rawLineNumber, 10);
        if (isNaN(lineNumber)) {
            throw new BadRequestException(
                'Заголовок line-number должен быть корректным числом',
            );
        }
        try {
            await this.trialService.validateLineTrial(lineNumber);
        }catch (error) {
            throw new BadRequestException()
        }
        next();
    }
}