import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class FeatureSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  locale?: string;
}

export class CreateFeatureDto {
  @IsString()
  @Length(3, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FeatureSettingsDto)
  settings?: FeatureSettingsDto;
}
