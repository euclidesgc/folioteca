import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class RegisterDto {
  @ApiProperty({ description: "Nome de quem se cadastra." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  name!: string;

  @ApiProperty({ description: "Nome da empresa, que nomeia a organização criada." })
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  @Length(1, 120)
  organizationName!: string;

  @ApiProperty({ description: "Endereço de e-mail, único no produto." })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ description: "Senha de 12 a 128 caracteres, sem regra de composição." })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
