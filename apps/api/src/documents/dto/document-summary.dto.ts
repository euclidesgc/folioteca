import { ApiProperty } from "@nestjs/swagger";

export class DocumentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  deletedAt!: Date | null;

  @ApiProperty()
  favorited!: boolean;
}

export class DocumentListDto {
  @ApiProperty({ type: DocumentSummaryDto, isArray: true })
  items!: DocumentSummaryDto[];
}
