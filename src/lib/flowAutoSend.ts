// Main-flow auto-send engine — DISABLED.
//
// The proactive auto-send (auto-DM a Main flow N minutes after a conversation's
// first inbound message) was removed per request: the bot no longer initiates
// DMs on its own. This stub preserves the public API (runDueAutoSends /
// AutoSendResult) so the cron route and any callers compile unchanged, but it
// performs no work and sends nothing.
//
// Reactive replies, DM funnels, and the first-touch welcome are unaffected.
// The previous implementation lives in git history if it ever needs restoring.

export interface AutoSendResult {
  flows: number;
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runDueAutoSends(): Promise<AutoSendResult> {
  return { flows: 0, candidates: 0, sent: 0, skipped: 0, failed: 0 };
}
