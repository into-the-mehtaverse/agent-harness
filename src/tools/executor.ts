// src/tools/executor.ts

import type { ToolContext, ToolInvocation, ToolResult } from './types';

export interface ToolExecutor {
  execute(
    invocations: ToolInvocation[],
    ctx: ToolContext,
  ): Promise<ToolResult[]>;
}
