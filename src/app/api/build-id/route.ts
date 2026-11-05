// Current build id, so an open tab can notice it is running stale JS.
//
// This app is deployed often, and a tab left open from before a deploy keeps
// asking the server for chunks and action ids that no longer exist. The visible
// symptom is `Failed to find Server Action "x"` — which looks like a real bug
// but is only a stale client. There are ZERO server actions in this codebase,
// so that error can never be anything else.
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let cached = "";

export async function GET() {
  if (!cached) {
    try {
      cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
    } catch {
      // Dev, or a build laid out differently — a stable placeholder simply
      // means the watcher never fires, which is the safe direction.
      cached = "dev";
    }
  }
  return NextResponse.json(
    { id: cached },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
