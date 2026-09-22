import { Module } from '@nestjs/common';
import { LastPackageService } from './last-package.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LastPackageEntity } from './entities/last-package.entity';
import {LastPackageController} from "./last-package.controller";

@Module({
  imports: [TypeOrmModule.forFeature([LastPackageEntity])],
  controllers: [LastPackageController],
  providers: [LastPackageService],
  exports: [LastPackageService],
})
export class LastPackageModule {}
