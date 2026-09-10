import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AccountService } from "./account.service";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("auth")
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Post("register")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Cria a conta e a organização de quem se cadastra.",
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description:
      "Pedido aceito. A resposta é a mesma exista ou não uma conta com o endereço informado.",
  })
  async register(@Body() dados: RegisterDto): Promise<void> {
    await this.service.register(dados);
  }
}
