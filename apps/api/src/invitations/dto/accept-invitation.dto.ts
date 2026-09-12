import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length, MaxLength, MinLength } from "class-validator";

export class AcceptInvitationDto {
  @ApiProperty({ description: "Nome de quem aceita o convite." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;

  @ApiProperty({ description: "Senha de 12 a 128 caracteres, sem regra de composição." })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
