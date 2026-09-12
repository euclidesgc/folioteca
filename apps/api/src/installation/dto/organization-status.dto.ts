import { ApiProperty } from "@nestjs/swagger";

export class OrganizationStatusDto {
  @ApiProperty({ enum: ["SETUP_PENDING", "READY"] })
  status!: "SETUP_PENDING" | "READY";

  @ApiProperty({ required: false, description: "Nome da unidade raiz, quando já instalada." })
  name?: string;
}
