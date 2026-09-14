import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {CodeEntity} from './entities/code.entity';
import {CodeService} from "./code.service";
import {CodeController} from "./code.controller";

@Module({
    imports: [TypeOrmModule.forFeature([CodeEntity])],
    controllers: [CodeController],
    providers: [CodeService],
    exports: [CodeService],
})
export class CodeModule {}