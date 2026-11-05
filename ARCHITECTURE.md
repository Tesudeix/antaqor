# Antaqor DM Automation — Router Architecture

Single source of truth for the inbound automation engine. Future work references
**sections of this doc**, not chat history. Code lives in
`src/app/api/meta/webhook/route.ts` (router), `src/lib/metaFlowRun.ts` (flow
runtime), `src/models/Meta*.ts`. Tests: `npm test` (`test/router.test.ts`).

First principle: **every send is caused by exactly one discrete user action.**
No time-based, proactive, or broadcast sends. (The 24h auto-send was removed.)

---

## 1. Router guard order

`handlePayload` → per event → `handleMessagingEvent` (typed DM) or
`handlePostback` (button/quick-reply). Plain text runs this ordered cascade;
**first match returns**:

| # | Guard | Action |
|---|-------|--------|
| G0 | **Dedup** — `MetaMessage.exists({mid})` | already processed → return (idempotency) |
| G1 | Hard gates: STOP keyword · safety · `escalatedToHuman` · master off · `accountAutomationDisabled` · typed `wantsHuman` | handle + return |
| G2 | **Mid-flow lock** — `conv.activeFlow` set | re-prompt current card (`resendCurrentCard`); exit keyword → `exitCurrentFlow`; never falls through |
| G3 | **Welcome-once** — atomic claim (see §3) | `runWelcome` + return |
| G4 | Command — `tryHandleCommand` | reply + return |
| G5a | Flow/keyword — `findMatchingFlow` | `startFlow` (opens session, §2) + return |
| G5b | DM trigger — `findMatchingTrigger` | `fireDmTrigger` + return |
| G6 | **Default reply** — `runDefaultAction` | answer-first (§4) → else menu/human/text/flow |

Rule: **the welcome greeting is never the answer to a real question.** KB answer
(§4) sits above the menu fallback.

---

## 2. MetaFlowSession state machine (per contact × flow)

Cards = nodes, buttons = edges. Record:
`{ conversationId, account, flowId, nodeId, status, enteredViaEvent, enteredAt, lastAdvancedAt }`
— unique index `{conversationId, flowId}`; `{flowId,status,nodeId}` powers live counts.
A mirror pointer `conv.activeFlow = {flowId, nodeId} | null` keeps the hot path to one read.

- **Entry** (`openFlowSession`): only when no active session for that flow. Sets
  `nodeId=entryCard`, `status=active`, points `conv.activeFlow`. Completes any
  *other* active session for the contact (one active flow per contact).
- **Advance** (`advanceFlowSession`): a postback `flow:<flowId>:<node>` where
  `node` is a forward successor. **Forward-only**; replays/back-edges are no-ops.
- **Terminal**: a card with no onward button → `status=completed`,
  `conv.activeFlow=null` (lock released).
- **Re-entry**: only an explicit fresh trigger for a completed/other flow. A
  plain inbound while `status=active` is *unknown-input-mid-flow* → re-prompt,
  **not** restart.
- **Flow edited mid-session** (node deleted): `resendCurrentCard` finds no card →
  `status=exited`, lock released, falls through to normal handling.

---

## 3. Welcome-once rule

- **Fire condition (atomic, race-safe):**
  `findOneAndUpdate({_id, welcomeMenuSent:{$ne:true}}, {$set:{welcomeMenuSent:true}})`
  returns non-null → fire exactly once. Two concurrent first DMs → only one wins.
- **Never re-fires** while `welcomeMenuSent === true`.
- **Legit reset:** only an explicit re-trigger (a "start over" button / reset
  command). A returning mid-conversation contact is **not** a new start. No
  time-based reset.

> ⚠️ KNOWN BUG (test case `f`): the **default no-match fallback** calls the same
> `sendWelcomeMenu`, whose business-account text equals the first-touch greeting.
> So when the KB can't answer, the bot re-greets. Fix = give the fallback a
> distinct "didn't catch that — choose below" copy, separate from the greeting.
> Tracked by the failing test; not yet fixed (behavior change pending sign-off).

---

## 4. KB answer-vs-deflect policy

`MetaWelcome.businessFaq` = freeform per-account knowledge (price, duration,
hours, location, contract…). On the **menu fallback path only**, before any menu:

```
if action == "menu" and businessFaq set and AI enabled:
    ans = answerFromKB(text, businessFaq, convId)   # LLM, KB as context
    if ans != <NO_ANSWER>: send(ans); return
    # else fall through to menu
```

| Situation | Action |
|---|---|
| Answer in KB, confident | answer from KB, in the contact's language (incl. Latin-script MN) |
| Not in KB → LLM emits `<NO_ANSWER>` | deflect → menu / command list |
| Needs a person (booking, complaint, custom price) | `→ human` handoff + alert |
| Too short / ambiguous, not greeted | welcome; else one clarifying question |

The LLM is instructed: answer strictly from the KB, in the user's script, emit
`<NO_ANSWER>` if uncovered, never dump the command list.

---

## 5. Conflict / precedence rules

- **Postback vs text:** a postback/quick-reply payload always pre-empts plain
  text in the same event (`handlePayload`).
- **Mid-flow beats triggers:** G2 runs before G3–G6 — a parked contact's typed
  text never starts a new flow or default reply.
- **Welcome beats triggers:** a brand-new contact's first message yields the
  welcome (G3) even if it matches a keyword; the keyword takes effect on the
  *next* message (once greeted).
- **Flow beats legacy DM trigger:** `findMatchingFlow` (G5a) before
  `findMatchingTrigger` (G5b).
- **Main flow beats menu in welcome:** `runWelcome` starts the Main flow if one
  exists, else the configured welcome mode (menu/flow/off).
- **Idempotency is global:** G0 dedup on `mid` guarantees the same event never
  produces two sends, regardless of path.
