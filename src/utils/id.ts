// src/utils/id.ts

function randomSuffix(length = 6): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

export function generateRunId(): string {
  return `run-${Date.now()}-${randomSuffix()}`;
}

export function generateTaskId(): string {
  return `task-${Date.now()}`;
}
