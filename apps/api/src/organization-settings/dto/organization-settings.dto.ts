import { ApiProperty } from "@nestjs/swagger";

export class OrganizationSettingsDto {
  @ApiProperty({
    description: "Se um espaço criado sem escolha explícita nasce herdando do espaço acima.",
  })
  spacesInheritByDefault!: boolean;
}
