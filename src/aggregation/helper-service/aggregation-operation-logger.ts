import { aggregationLogger } from '../../logger-winston/winston.config';

export interface AggregationOperationLogContext {
  tsdId: number;
  taskId?: number | null;
  operation: string;
  [key: string]: unknown;
}

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
  status?: unknown;
  response?: unknown;
  query?: unknown;
  parameters?: unknown;
  driverError?: unknown;
  cause?: unknown;
}

function serializeError(error: unknown, depth = 0): SerializedError | { value: unknown } {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  const details: SerializedError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  const extended = error as Error & {
    code?: unknown;
    status?: unknown;
    response?: unknown;
    query?: unknown;
    parameters?: unknown;
    driverError?: unknown;
    cause?: unknown;
  };

  // Детали Nest/TypeORM: без них в логе остаётся только общий message.
  if (extended.code !== undefined) details.code = extended.code;
  if (extended.status !== undefined) details.status = extended.status;
  if (extended.response !== undefined) details.response = extended.response;
  if (extended.query !== undefined) details.query = extended.query;
  if (extended.parameters !== undefined) details.parameters = extended.parameters;
  if (extended.driverError !== undefined) details.driverError = extended.driverError;

  if (extended.cause !== undefined && depth < 2) {
    details.cause = serializeError(extended.cause, depth + 1);
  }

  return details;
}

export async function withOperationLogging<T>(
  context: AggregationOperationLogContext,
  action: (context: AggregationOperationLogContext) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await action(context);

    aggregationLogger.info('Операция агрегации выполнена', {
      ...context,
      status: 'success',
      durationMs: Date.now() - startedAt,
      ...(Array.isArray(result) ? { affectedCount: result.length } : {}),
    });

    return result;
  } catch (error) {
    aggregationLogger.error('Ошибка операции агрегации', {
      ...context,
      status: 'error',
      durationMs: Date.now() - startedAt,
      error: serializeError(error),
    });

    throw error;
  }
}
