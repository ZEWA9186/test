import {Body, Controller, Get, HttpCode, HttpStatus, Post} from '@nestjs/common';
import { CodeService } from './code.service';
import {CodeEntity} from "./entities/code.entity";

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

    @Get('get-codes')
    async getCodes(@Body('codes') codes: string[]): Promise<CodeEntity []> {
        return await this.codeService.getCodes(codes);
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    async getStatus(){}
}