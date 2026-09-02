import type { Feature, NewFeature } from './feature.entity';

// motivo: o corpo deste repositório é da skill `nest-persistence-prisma` —
// `select` explícito, transação e mapeamento de linha para domínio moram lá, e
// a cópia que existia aqui já tinha divergido dela. Este arquivo declara só a
// assinatura que o serviço injeta.
export declare class FeatureRepository {
  listByOwner(ownerId: string, options: { limit: number; cursor?: string }): Promise<Feature[]>;
  findByIdForOwner(id: string, ownerId: string): Promise<Feature | null>;
  create(input: NewFeature): Promise<Feature>;
}
