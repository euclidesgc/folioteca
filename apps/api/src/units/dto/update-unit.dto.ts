import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class UpdateUnitDto {
  @ApiProperty({ description: "Novo nome da unidade." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;
}
