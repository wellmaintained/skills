import type { SkillContext, SkillResult } from '../types/skill.js';

export interface CapabilityHandler {
  execute(context: SkillContext): Promise<SkillResult>;
}
