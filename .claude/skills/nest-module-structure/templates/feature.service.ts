import { Injectable } from '@nestjs/common';
import { FeatureNotFoundError } from './feature.errors';
import { FeatureRepository } from './feature.repository';
import type { Feature } from './feature.entity';
import type { CreateFeatureDto } from './dto/create-feature.dto';
import type { ListFeatureQueryDto } from './dto/list-feature.query.dto';
import type { FeatureView } from './dto/feature.view';

@Injectable()
export class FeatureService {
  constructor(private readonly repository: FeatureRepository) {}

  async list(ownerId: string, query: ListFeatureQueryDto): Promise<FeatureView[]> {
    const features = await this.repository.listByOwner(ownerId, {
      limit: query.limit,
      cursor: query.cursor,
    });
    return features.map(toView);
  }

  async findById(ownerId: string, id: string): Promise<FeatureView> {
    const feature = await this.repository.findByIdForOwner(id, ownerId);
    if (!feature) {
      throw new FeatureNotFoundError(id);
    }
    return toView(feature);
  }

  async create(ownerId: string, input: CreateFeatureDto): Promise<FeatureView> {
    const created = await this.repository.create({
      ownerId,
      name: input.name,
      description: input.description ?? null,
    });
    return toView(created);
  }
}

function toView(feature: Feature): FeatureView {
  return {
    id: feature.id,
    name: feature.name,
    description: feature.description,
    createdAt: feature.createdAt.toISOString(),
  };
}
