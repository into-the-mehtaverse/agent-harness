// src/utils/time.ts

export function now(): Date {
  return new Date();
}

export function elapsedMs(start: Date, end?: Date): number {
  const endTime = end ?? now();
  return endTime.getTime() - start.getTime();
}
