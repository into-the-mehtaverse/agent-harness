// src/utils/error.ts

/**
 * Turn an unknown thrown value into a string message.
 * Use a default prefix when the value is not an Error (e.g. "Unknown model error").
 */
export function toErrorMessage(
  err: unknown,
  defaultPrefix = 'Unknown error',
): string {
  if (err instanceof Error) {
    return err.message;
  }
  return `${defaultPrefix}: ${String(err)}`;
}
