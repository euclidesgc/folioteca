import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsUUID } from "class-validator";

export class CreateInvitationDto {
  @ApiProperty({ description: "Endereço de e-mail de quem recebe o convite." })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ description: "Id da unidade de lotação inicial de quem aceitar." })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ enum: UserRole, description: "Papel que a pessoa recebe ao aceitar." })
  @IsEnum(UserRole)
  role!: UserRole;
}
