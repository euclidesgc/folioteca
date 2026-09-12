import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class UpdateDocumentDto {
  @ApiProperty({ description: "Novo título do documento.", minLength: 1, maxLength: 300 })
  @IsString()
  @Length(1, 300)
  title!: string;
}
