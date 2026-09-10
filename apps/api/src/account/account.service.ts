import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AUTH_INSTANCE } from "../auth/auth.constants";
import type { Auth } from "../auth/auth.factory";
import type { EnvironmentVariables } from "../config/environment-variables";
import { parseWebOrigins } from "../config/web-origins";
import { AccountRepository } from "./account.repository";
import type { RegisterDto } from "./dto/register.dto";

const DESTINO_APOS_CONFIRMAR = "/documentos";

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
    private readonly repository: AccountRepository,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(dados: RegisterDto): Promise<void> {
    try {
      const { user } = await this.auth.api.signUpEmail({
        body: {
          name: dados.name,
          email: dados.email,
          password: dados.password,
          // motivo: sem endereço explícito a biblioteca manda para "/" da
          // própria API, e quem confirma o e-mail cai na raiz do servidor em
          // vez do produto. `originCheck` exige que ele esteja em
          // `trustedOrigins`, e está: vem do mesmo WEB_ORIGIN.
          callbackURL: `${this.origemDoApp()}${DESTINO_APOS_CONFIRMAR}`,
        },
      });
      await this.repository.createOrganizationForUser(
        user.id,
        dados.organizationName,
      );
    } catch (erro) {
      // motivo: quem chama recebe sempre a mesma resposta, exista ou não a
      // conta — é o que impede que o cadastro seja usado para descobrir quem
      // já trabalha na empresa. A causa real fica só no log do servidor.
      this.logger.warn({
        event: "account.register.rejected",
        reason: erro instanceof Error ? erro.name : "unknown",
      });
    }
  }

  private origemDoApp(): string {
    const [primeira] = parseWebOrigins(
      this.config.get("WEB_ORIGIN", { infer: true }),
    );
    return primeira ?? "";
  }
}
