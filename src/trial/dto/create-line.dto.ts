import { IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateLineDto {
    @IsNumber({}, { message: 'Номер линии должен быть числом' })
    lineNumber: number;

    @IsOptional()
    @IsNumber({}, { message: 'Остаток минут должен быть числом' })
    @Min(0, { message: 'Значение не может быть отрицательным' })
    remainingMinutes?: number;

    @IsBoolean()
    isLimited: boolean;
}