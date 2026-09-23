/** Type surface of scripts/db/reset.mjs consumed by the guard suite (spec 018 T007/T008). */
export declare type ResetGuardDecision =
  | { decision: 'refuse'; reason: string }
  | { decision: 'proceed'; targetRef: string; warning?: string }

export declare function resolveResetGuard(args: {
  dbUrl: string
  devRef: string | null
  override?: boolean
}): ResetGuardDecision
