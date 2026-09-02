import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Feature, NewFeature, StockChange } from './feature.entity';

@Injectable()
export class FeatureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdForOwner(id: string, ownerId: string): Promise<Feature | null> {
    const row = await this.prisma.feature.findFirst({
      where: { id, ownerId },
      select: FEATURE_SELECT,
    });
    return row ? toDomain(row) : null;
  }

  async createWithReservation(input: NewFeature, changes: StockChange[]): Promise<Feature> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.feature.create({ data: input, select: FEATURE_SELECT });
      for (const change of changes) {
        await tx.product.update({
          where: { id: change.productId },
          data: { stock: { decrement: change.quantity } },
        });
      }
      return toDomain(created);
    });
  }
}

const FEATURE_SELECT = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  createdAt: true,
} as const;

type FeatureRow = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: Date;
};

function toDomain(row: FeatureRow): Feature {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
  };
}
