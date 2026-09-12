import { Injectable } from "@nestjs/common";
import { OrganizationSettingsRepository } from "./organization-settings.repository";

export type OrganizationSettingsView = {
  spacesInheritByDefault: boolean;
};

@Injectable()
export class OrganizationSettingsService {
  constructor(private readonly repository: OrganizationSettingsRepository) {}

  async get(): Promise<OrganizationSettingsView> {
    return { spacesInheritByDefault: await this.repository.get() };
  }

  async update(spacesInheritByDefault: boolean): Promise<OrganizationSettingsView> {
    return { spacesInheritByDefault: await this.repository.update(spacesInheritByDefault) };
  }
}
