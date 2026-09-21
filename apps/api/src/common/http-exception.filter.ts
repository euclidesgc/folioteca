import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

type ValidationIssue = {
  field: string;
  message: string;
};

type ErrorBody = {
  message: string;
  errors?: ValidationIssue[];
};

const NOT_FOUND_MESSAGE = 'Recurso não encontrado.';
const INTERNAL_MESSAGE = 'Erro interno do servidor.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildBody(exception: HttpException): ErrorBody {
  const status: number = exception.getStatus();

  if (status === Number(HttpStatus.NOT_FOUND)) {
    return { message: NOT_FOUND_MESSAGE };
  }

  const response: unknown = exception.getResponse();
  const message = exception.message;

  if (isRecord(response) && Array.isArray(response.errors)) {
    return { message, errors: response.errors as ValidationIssue[] };
  }

  return { message };
}

/**
 * Formato único de erro da API: `{ message }`, com `errors` só na validação.
 * Erro inesperado vira 500 genérico e fica registrado no log, sem vazar
 * detalhe nenhum para quem chamou.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(buildBody(exception));

      return;
    }

    this.logger.error('Erro inesperado na API.', exception);

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: INTERNAL_MESSAGE });
  }
}
