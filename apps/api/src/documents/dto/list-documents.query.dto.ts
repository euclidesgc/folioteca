import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export enum DocumentFilter {
  OWNED = "OWNED",
  FAVORITES = "FAVORITES",
  TRASH = "TRASH",
}

export class ListDocumentsQueryDto {
  @ApiProperty({ enum: DocumentFilter })
  @IsEnum(DocumentFilter)
  filter!: DocumentFilter;
}
