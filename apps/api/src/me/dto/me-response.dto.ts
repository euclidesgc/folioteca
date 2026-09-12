import { ApiProperty } from "@nestjs/swagger";

export class MeOrganizationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class MeUnitDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, isArray: true })
  path!: string[];
}

export class MeResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ type: MeOrganizationDto })
  organization!: MeOrganizationDto;

  @ApiProperty({ type: MeUnitDto, isArray: true })
  units!: MeUnitDto[];
}
