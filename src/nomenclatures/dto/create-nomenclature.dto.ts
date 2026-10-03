import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateNomenclatureDto {
  @IsString()
  @IsOptional()
  @Length(14, 14)
  gtin?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(14, 14)
  ITF14?: string;

  @IsOptional()
  @IsString()
  smallBoxLabel?: string;

  @IsOptional()
  @IsString()
  bigBoxLabel?: string;

  @IsOptional()
  @IsString()
  palletLabel?: string;
}
