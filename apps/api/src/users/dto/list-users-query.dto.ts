import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

export class ListUsersQueryDto {
  @ApiProperty({ required: false, description: "Filtro por nome ou e-mail (ILIKE)." })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;
}
