import { Module } from '@nestjs/common';
import { Task1sController } from './task1s.controller';
import { Task1sService } from './task1s.service';
import {CodeModule} from "../code/code.module";

@Module({
    imports: [CodeModule,],
    controllers: [Task1sController],
    providers: [Task1sService],
    exports: [Task1sService],
})
export class Task1sModule {}