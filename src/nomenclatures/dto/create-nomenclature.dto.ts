import { IsNotEmpty, IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreateNomenclatureDto {
  @IsString()
  @IsNotEmpty()
  @Length(14, 14)
  gtin: string;

  @IsNumber()
  @IsNotEmpty()
  aggregationLvl: number; // Уровень агрегации (lvl)

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

  // Все этикетки (label - все)
  @IsOptional()
  @IsString()
  smallBoxLabel?: string;

  @IsOptional()
  @IsString()
  bigBoxLabel?: string;

  @IsOptional()
  @IsString()
  palletLabel?: string;

  @IsOptional()
  @IsString()
  inscriptionLabel?: string;

  // Все параметры упаковок (piecesPer - все)
  @IsOptional()
  @IsNumber()
  piecesPerSmallBox?: number;

  @IsOptional()
  @IsNumber()
  piecesPerBigBox?: number;

  @IsOptional()
  @IsNumber()
  piecesPerPallet?: number;

  @IsOptional()
  @IsString()
  techConditions?: string;

  @IsOptional()
  @IsString()
  gost?: string;

  @IsOptional()
  @IsString()
  otherTechConditions?: string;

  @IsOptional()
  @IsString()
  nettoUnit?: string;

  @IsOptional()
  @IsString()
  bruttoUnit?: string;

  @IsOptional()
  @IsString()
  bruttoBox?: string;

  @IsOptional()
  @IsString()
  tempCond1?: string;

  @IsOptional()
  @IsString()
  tempCond2?: string;

  @IsOptional()
  @IsString()
  tempCond3?: string;

  @IsOptional()
  @IsString()
  tempCond4?: string;

  @IsOptional()
  @IsString()
  adInfo1?: string;

  @IsOptional()
  @IsString()
  adInfo2?: string;

  @IsOptional()
  @IsString()
  adInfo3?: string;

  @IsOptional()
  @IsString()
  adInfo4?: string;

  @IsOptional()
  @IsString()
  adInfo5?: string;

  @IsOptional()
  @IsString()
  adInfo6?: string;
}
