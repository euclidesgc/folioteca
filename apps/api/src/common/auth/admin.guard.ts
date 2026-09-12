import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { AdminOnlyError } from "../errors/domain-error";

// motivo (M7/M20): toda escrita administrativa decide no servidor, nunca só
// no botão escondido do cliente. Depende de `SessionGuard` já ter populado
// `request.currentUser` — por isso entra depois dele em `@UseGuards`.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.currentUser?.role !== "ADMIN") {
      throw new AdminOnlyError();
    }
    return true;
  }
}
