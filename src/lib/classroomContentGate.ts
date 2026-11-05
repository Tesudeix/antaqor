import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { accessState } from "@/lib/membership";
export async function classroomContentGate() {
  const session = await getServerSession(authOptions);
  const access = await accessState((session?.user as { id?: string } | undefined)?.id, session?.user?.email);
  return access.ok ? null : NextResponse.json({ locked: true, error: "Хичээл үзэхийн тулд хүрээлэлд нэгдээрэй.", enrollHref: "/pricing?plan=builder" }, { status: session?.user ? 403 : 401 });
}
