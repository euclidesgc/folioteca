import { ApiProperty } from "@nestjs/swagger";

export class SpaceMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: String, nullable: true })
  image!: string | null;

  @ApiProperty()
  isManager!: boolean;
}
