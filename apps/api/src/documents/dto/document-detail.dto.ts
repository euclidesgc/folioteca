import { ApiProperty } from "@nestjs/swagger";

export class DocumentDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  createdById!: string;

  @ApiProperty({ type: "array", items: { type: "object" }, nullable: true })
  content!: unknown[] | null;

  @ApiProperty({ type: Date, nullable: true })
  deletedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  favorited!: boolean;
}

export class DocumentCreatedDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  createdById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class DocumentTrashStateDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: Date, nullable: true })
  deletedAt!: Date | null;
}

export class DocumentFavoriteStateDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  favorited!: boolean;
}
