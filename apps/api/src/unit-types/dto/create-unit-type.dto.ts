import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class CreateUnitTypeDto {
  @ApiProperty({ description: "Nome do tipo de unidade, único por instância." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;
}
