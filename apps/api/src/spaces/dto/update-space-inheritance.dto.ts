import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateSpaceInheritanceDto {
  @ApiProperty({
    description: "Liga ou desliga a herança do compartilhamento do espaço acima (M11).",
  })
  @IsBoolean()
  inheritsFromParent!: boolean;
}
