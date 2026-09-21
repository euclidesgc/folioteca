import { NotFoundException } from '@nestjs/common';

/**
 * Marcador de 404 de domínio: qualquer recurso inexistente que a aplicação
 * identifica (documento, pessoa etc). Distingue esse caso do 404 padrão do
 * Nest para rota inexistente, cuja mensagem em inglês nunca deve vazar.
 */
export class DomainNotFoundException extends NotFoundException {}
