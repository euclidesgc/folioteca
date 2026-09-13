import { ApiProperty } from "@nestjs/swagger";
import { SpaceKind } from "@prisma/client";

export class SpaceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SpaceKind })
  kind!: SpaceKind;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  unitId!: string | null;

  @ApiProperty()
  restricted!: boolean;

  @ApiProperty()
  inheritsFromParent!: boolean;

  @ApiProperty({ type: String, nullable: true })
  managerId!: string | null;

  @ApiProperty({ type: () => SpaceDto, isArray: true })
  children!: SpaceDto[];
}

export class SpacePathEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class SpaceDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SpaceKind })
  kind!: SpaceKind;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  unitId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty()
  restricted!: boolean;

  @ApiProperty()
  inheritsFromParent!: boolean;

  @ApiProperty({ type: String, nullable: true })
  managerId!: string | null;

  @ApiProperty({ type: SpacePathEntryDto, isArray: true })
  path!: SpacePathEntryDto[];
}
