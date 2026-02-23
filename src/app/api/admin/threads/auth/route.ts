import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { ThreadsAPI } from "@/lib/threads";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const appId = process.env.THREADS_APP_ID!;
  const redirectUri = process.env.THREADS_REDIRECT_URI!;

  const scopes = [
    "threads_basic",
    "threads_content_publish",
    "threads_delete",
    "threads_manage_replies",
    "threads_read_replies",
    "threads_manage_insights",
  ];

  const url = ThreadsAPI.getAuthorizationUrl(appId, redirectUri, scopes);
  return NextResponse.redirect(url);
}
