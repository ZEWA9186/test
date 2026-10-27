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
}

function serializeError(error: unknown): SerializedError | { value: unknown } {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  return {
    name: error.name,
    message: error.message,
  };
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
