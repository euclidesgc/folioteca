import type { FeatureRepository } from '../../src/feature/feature.repository';
import type { Feature } from '../../src/feature/feature.entity';

export function createFeatureRepositoryMock(): jest.Mocked<FeatureRepository> {
  return {
    listByOwner: jest.fn().mockResolvedValue([]),
    findByIdForOwner: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  } as unknown as jest.Mocked<FeatureRepository>;
}

export function aFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: 'owner-1',
    name: 'reports',
    description: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    ...overrides,
  };
}
