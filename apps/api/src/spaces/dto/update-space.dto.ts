import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class UpdateSpaceDto {
  @ApiProperty({ required: false, description: "Novo nome do espaço." })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name?: string;

  @ApiProperty({
    required: false,
    description: "Restrito — só quem for convidado vê este espaço.",
  })
  @IsOptional()
  @IsBoolean()
  restricted?: boolean;
}
