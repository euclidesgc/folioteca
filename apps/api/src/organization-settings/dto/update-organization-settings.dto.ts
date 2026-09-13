import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateOrganizationSettingsDto {
  @ApiProperty({
    description: "Se um espaço criado sem escolha explícita nasce herdando do espaço acima.",
  })
  @IsBoolean()
  spacesInheritByDefault!: boolean;
}
