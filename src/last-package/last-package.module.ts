import { Module } from '@nestjs/common';
import { LastPackageService } from './last-package.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LastPackageEntity } from './entities/last-package.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LastPackageEntity])],
  providers: [LastPackageService],
  exports: [LastPackageService],
})
export class LastPackageModule {}
