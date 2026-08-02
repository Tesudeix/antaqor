import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const GOALS = ["learn", "build", "automate"];
const LEVELS = ["beginner", "intermediate", "advanced"];

// POST — save the 2 onboarding answers. Deliberately tiny: goal + experience
// only, everything else is collected later when it's actually needed.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const body = await req.json().catch(() => ({}));
    const goal = GOALS.includes(body?.goal) ? body.goal : "";
    const experience = LEVELS.includes(body?.experience) ? body.experience : "";

    await dbConnect();
    await User.findByIdAndUpdate(userId, {
      $set: {
        "onboarding.goal": goal,
        "onboarding.experience": experience,
        "onboarding.completedAt": new Date(),
        // Map onboarding level onto the legacy aiExperience field too
        ...(experience ? { aiExperience: experience } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
