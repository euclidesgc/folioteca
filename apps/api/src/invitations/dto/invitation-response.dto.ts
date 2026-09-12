import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

export class InvitationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  unitId!: string;

  @ApiProperty()
  unitName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}
