import { ApiProperty } from "@nestjs/swagger";

export class UnitTypeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}
