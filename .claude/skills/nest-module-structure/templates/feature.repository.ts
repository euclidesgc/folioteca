import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Feature, NewFeature } from './feature.entity';

type ListOptions = { limit: number; cursor?: string };

@Injectable()
export class FeatureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(ownerId: string, options: ListOptions): Promise<Feature[]> {
    const rows = await this.prisma.feature.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    });
    return rows.map(toDomain);
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<Feature | null> {
    const row = await this.prisma.feature.findFirst({ where: { id, ownerId } });
    return row ? toDomain(row) : null;
  }

  async create(input: NewFeature): Promise<Feature> {
    const row = await this.prisma.feature.create({ data: input });
    return toDomain(row);
  }
}

function toDomain(row: {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}): Feature {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
  };
}
