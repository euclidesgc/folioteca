import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID, Length, ValidateIf } from "class-validator";

export class CreateSpaceDto {
  @ApiProperty({ description: "Nome do espaço livre." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Id do espaço pai (unidade ou livre), ou null para criar no topo.",
  })
  @ValidateIf((dto: CreateSpaceDto) => dto.parentId !== null)
  @IsUUID()
  parentId!: string | null;

  @ApiProperty({
    required: false,
    description: "Restrito — só quem for convidado vê este espaço.",
  })
  @IsOptional()
  @IsBoolean()
  restricted?: boolean;
}
