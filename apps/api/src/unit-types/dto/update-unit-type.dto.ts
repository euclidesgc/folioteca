import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class UpdateUnitTypeDto {
  @ApiProperty({ description: "Novo nome do tipo de unidade." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;
}
