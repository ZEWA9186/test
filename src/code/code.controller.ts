import {Body, Controller, Get, HttpCode, HttpStatus, Post} from '@nestjs/common';
import { CodeService } from './code.service';

@Controller('code')
export class CodeController {
    constructor(private readonly codeService: CodeService) {}

    @Post('validate-code')
    @HttpCode(HttpStatus.OK)
    async validateCode(
        @Body('code') code: string,
    ): Promise<{ message: string }> {
        return await this.codeService.validateAndSaveCode(code);
    }

    @Post('batch-validate-code')
    @HttpCode(HttpStatus.OK)
    async batchValidateCode(
        @Body('codes') codes: string[],
    ): Promise<{ message: string }> {
        return await this.codeService.batchValidateAndSaveCode(codes);
    }

    @Post('delete-code')
    @HttpCode(HttpStatus.OK)
    async deleteCode(@Body('code') code: string,
    ) {
        await this.codeService.deleteCode(code);
    }

    @Post('get-codes')
    async getCodes(@Body('codes') codes: string[]) {
        return await this.codeService.getCodes(codes);
    }

    @Post('batch-delete-code')
    async batchDeleteCode(@Body('codes') codes: string[]): Promise<{ message: string }> {
        return this.codeService.batchDeleteCodes(codes);
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    async getStatus() {
    }
}