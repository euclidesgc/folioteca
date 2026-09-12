import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}

export class UserRoleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}
