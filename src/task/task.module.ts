import {Module} from "@nestjs/common";
import {TaskController} from "./task.controller";
import {TaskService} from "./task.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import {ActiveTaskEntity} from "../aggregation/entities/active-task.entity";
import { TaskEntity } from "./entities/task.entity";

@Module({
    imports: [TypeOrmModule.forFeature([TaskEntity, ActiveTaskEntity])],
    controllers:[TaskController],
    providers: [TaskService],
})
export class TaskModule {}