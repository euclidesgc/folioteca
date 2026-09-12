import { ApiProperty } from "@nestjs/swagger";

export class UnitMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;
}

export class UnitTypeRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class UnitDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isRoot!: boolean;

  @ApiProperty({ type: UnitTypeRefDto, nullable: true })
  unitType!: UnitTypeRefDto | null;

  @ApiProperty({ type: UnitMemberDto, isArray: true })
  directMembers!: UnitMemberDto[];

  @ApiProperty({ type: () => UnitDto, isArray: true })
  children!: UnitDto[];
}
