import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CodeService } from './code.service';

@Controller('code')
export class CodeController {
    constructor(private readonly codeService: CodeService) {}

    @Post('validate-code')
    @HttpCode(HttpStatus.OK)
    async validateCode(
        @Body('code') code: string,
    ): Promise<{ message: string }> {
        return this.codeService.validateAndSaveCode(code);
    }

    @Post('batch-validate-code')
    @HttpCode(HttpStatus.OK)
    async batchValidateCode(
        @Body('codes') codes: string[],
    ): Promise<{ message: string }> {
        return this.codeService.batchValidateAndSaveCode(codes);
    }
}