// src/tools/factory/index.ts

import type { Tool } from '../types';
import { echoTool } from './echo';
import { currentTimeTool } from './currentTime';
import { addNumbersTool } from './addNumbers';

/**
 * Convenience helper to get the basic tool set.
 */
export function getBasicTools(): Tool[] {
  return [echoTool, currentTimeTool, addNumbersTool];
}

export { echoTool } from './echo';
export { currentTimeTool } from './currentTime';
export { addNumbersTool } from './addNumbers';
