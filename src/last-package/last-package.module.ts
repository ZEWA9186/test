import { Module } from '@nestjs/common';
import { LastPackageService } from './last-package.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LastPackageEntity } from './last-package.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LastPackageEntity])],
  controllers: [],
  providers: [LastPackageService],
  exports: [LastPackageService],
})
export class LastPackageModule {}
