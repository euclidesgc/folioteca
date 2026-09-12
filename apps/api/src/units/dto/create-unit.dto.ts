import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, IsUUID, Length } from "class-validator";

export class CreateUnitDto {
  @ApiProperty({ description: "Nome da unidade, único entre as filhas do mesmo pai." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;

  @ApiProperty({ description: "Id da unidade pai." })
  @IsUUID()
  parentId!: string;

  @ApiProperty({ description: "Id do tipo desta unidade." })
  @IsUUID()
  unitTypeId!: string;
}
