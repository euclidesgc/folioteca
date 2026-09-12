import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { AUTH_INSTANCE } from "../../auth/auth.constants";
import type { Auth } from "../../auth/auth.factory";
import { UnauthenticatedError } from "../errors/domain-error";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

declare module "express" {
  interface Request {
    currentUser?: SessionUser;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      throw new UnauthenticatedError();
    }
    request.currentUser = session.user;
    return true;
  }
}
