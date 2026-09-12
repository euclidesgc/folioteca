import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizeName } from "../common/text/normalize-name";
import {
  UnitTypeInUseError,
  UnitTypeNameTakenError,
  UnitTypeNotFoundError,
} from "./unit-types.errors";
import { UnitTypesRepository, type UnitTypeRecord } from "./unit-types.repository";

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

@Injectable()
export class UnitTypesService {
  constructor(private readonly repository: UnitTypesRepository) {}

  list(): Promise<UnitTypeRecord[]> {
    return this.repository.list();
  }

  async create(name: string): Promise<UnitTypeRecord> {
    try {
      return await this.repository.create(name, normalizeName(name));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new UnitTypeNameTakenError();
      }
      throw error;
    }
  }

  async update(id: string, name: string): Promise<UnitTypeRecord> {
    try {
      const updated = await this.repository.update(id, name, normalizeName(name));
      if (!updated) {
        throw new UnitTypeNotFoundError();
      }
      return updated;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new UnitTypeNameTakenError();
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const outcome = await this.repository.delete(id);
    if (outcome === "not_found") {
      throw new UnitTypeNotFoundError();
    }
    if (outcome === "in_use") {
      throw new UnitTypeInUseError();
    }
  }
}
