import { ApiProperty } from "@nestjs/swagger";

export class HealthResponse {
  @ApiProperty()
  status!: string;
}
