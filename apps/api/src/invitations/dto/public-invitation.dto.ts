import { ApiProperty } from "@nestjs/swagger";

export class PublicInvitationDto {
  @ApiProperty({ description: "Nome da organização que convidou." })
  organizationName!: string;

  @ApiProperty({ description: "Nome da unidade de lotação inicial." })
  unitName!: string;

  @ApiProperty({ description: "E-mail do convite, com o meio mascarado." })
  maskedEmail!: string;

  @ApiProperty()
  expiresAt!: Date;
}
