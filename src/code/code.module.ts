import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeEntity } from './entities/code.entity';
import { CodeService } from './code.service';

@Module({
  imports: [TypeOrmModule.forFeature([CodeEntity])],
  providers: [CodeService],
  exports: [CodeService],
})
export class CodeModule {}
