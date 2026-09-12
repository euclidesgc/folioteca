import { Injectable } from "@nestjs/common";
import type { SessionUser } from "../common/auth/session.guard";
import { MeResponse } from "./dto/me-response.dto";

@Injectable()
export class MeService {
  fromSession(user: SessionUser): MeResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
