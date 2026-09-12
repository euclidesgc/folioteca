import { Injectable } from "@nestjs/common";
import type { SessionUser } from "../common/auth/session.guard";
import { MeResponse } from "./dto/me-response.dto";
import { MeRepository } from "./me.repository";

@Injectable()
export class MeService {
  constructor(private readonly repository: MeRepository) {}

  async fromSession(user: SessionUser): Promise<MeResponse> {
    const [organization, units] = await Promise.all([
      this.repository.findOrganizationRef(),
      this.repository.findUnitsWithPath(user.id),
    ]);
    if (!organization) {
      throw new Error("no organization found — instance not installed");
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization,
      units,
    };
  }
}
