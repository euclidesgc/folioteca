import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { LastAdminError, UserNotFoundError } from "./users.errors";
import { UsersRepository, type RoleRecord, type UserRecord } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  list(search?: string): Promise<UserRecord[]> {
    return this.repository.search(search);
  }

  async changeRole(id: string, role: UserRole): Promise<RoleRecord> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (user.role === role) {
      return { id: user.id, role: user.role };
    }
    if (role === UserRole.MEMBER) {
      const outcome = await this.repository.demote(id);
      if (outcome === "LAST_ADMIN") {
        throw new LastAdminError();
      }
      return outcome;
    }
    return this.repository.promote(id);
  }
}
