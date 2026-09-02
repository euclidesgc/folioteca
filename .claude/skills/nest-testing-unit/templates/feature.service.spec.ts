import { FeatureNotFoundError } from '../feature.errors';
import { FeatureService } from '../feature.service';
import type { FeatureRepository } from '../feature.repository';
import { aFeature, createFeatureRepositoryMock } from '../../test/mocks/feature.repository.mock';

describe('FeatureService', () => {
  let repository: jest.Mocked<FeatureRepository>;
  let service: FeatureService;

  beforeEach(() => {
    repository = createFeatureRepositoryMock();
    service = new FeatureService(repository);
  });

  describe('contrato', () => {
    it('deve serializar createdAt em ISO 8601 na view devolvida', async () => {
      repository.findByIdForOwner.mockResolvedValue(
        aFeature({ createdAt: new Date('2026-01-02T03:04:05.000Z') }),
      );

      const view = await service.findById('owner-1', 'feature-1');

      expect(view.createdAt).toBe('2026-01-02T03:04:05.000Z');
    });

    it('deve gravar sempre o dono autenticado, ignorando qualquer id vindo da entrada', async () => {
      repository.create.mockResolvedValue(aFeature());

      await service.create('owner-1', { name: 'reports' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 'owner-1' }),
      );
    });
  });

  describe('caminho feliz', () => {
    it('deve devolver as features do dono em ordem de criação decrescente', async () => {
      repository.listByOwner.mockResolvedValue([
        aFeature({ id: 'b', createdAt: new Date('2026-02-01T00:00:00.000Z') }),
        aFeature({ id: 'a', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      ]);

      const views = await service.list('owner-1', { limit: 20 });

      expect(views.map((view) => view.id)).toEqual(['b', 'a']);
    });
  });

  describe('bordas', () => {
    it('deve devolver lista vazia quando o dono não tem nenhuma feature', async () => {
      repository.listByOwner.mockResolvedValue([]);

      await expect(service.list('owner-1', { limit: 20 })).resolves.toEqual([]);
    });

    it('deve lançar FeatureNotFoundError quando a feature é de outro dono', async () => {
      repository.findByIdForOwner.mockResolvedValue(null);

      await expect(service.findById('owner-1', 'feature-of-someone-else')).rejects.toBeInstanceOf(
        FeatureNotFoundError,
      );
    });
  });
});
