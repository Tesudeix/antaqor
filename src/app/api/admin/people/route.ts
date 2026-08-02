import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import MetaConversation from "@/models/MetaConversation";

// ─── Unified people directory ───────────────────────────────────────────
// Every web signup AND every IG/Messenger DM partner is a `User`
// (getOrCreateUserForPartner creates one with metaInstagramId / metaMessengerPsid
// + a <platform>_<id>@antaqor.dm placeholder email). Structured funnel data
// (intro: role/age/gender/interest/goal · hr: industry/headcount/budget) lives
// on the linked MetaConversation.profile.* — joined here by linkedUserId.

type Lean = Record<string, unknown>;

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const source = searchParams.get("source") || "all"; // all|web|instagram|messenger

    const cond: Lean[] = [];
    if (search) {
      cond.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
          { instagram: { $regex: search, $options: "i" } },
        ],
      });
    }
    if (source === "web") {
      cond.push({
        $and: [
          { $or: [{ metaInstagramId: { $exists: false } }, { metaInstagramId: null }] },
          { $or: [{ metaMessengerPsid: { $exists: false } }, { metaMessengerPsid: null }] },
        ],
      });
    } else if (source === "instagram") {
      cond.push({ metaInstagramId: { $exists: true, $ne: null } });
    } else if (source === "messenger") {
      cond.push({ metaMessengerPsid: { $exists: true, $ne: null } });
    }
    const query: Record<string, unknown> = cond.length ? { $and: cond } : {};

    const users = (await User.find(query)
      .select(
        "name username email phone avatar bio age aiExperience interests instagram clan clanJoinedAt subscriptionExpiresAt role level xp credits createdAt metaInstagramId metaMessengerPsid intro introCompletedAt banned"
      )
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean()) as unknown as Lean[];

    const userIds = users.map((u) => u._id);
    const convFilter: Record<string, unknown> = { linkedUserId: { $in: userIds } };
    const convs = (await MetaConversation.find(convFilter)
      .select(
        "linkedUserId platform partnerId partnerName partnerUsername partnerProfilePic intentLabel intentScore leadStatus profile userMemo lastMessageAt"
      )
      .sort({ lastMessageAt: -1 })
      .lean()) as unknown as Lean[];

    // Most-recent conversation per user (sorted desc above → first wins)
    const convByUser = new Map<string, Lean>();
    for (const c of convs) {
      const k = String(c.linkedUserId);
      if (!convByUser.has(k)) convByUser.set(k, c);
    }

    const now = Date.now();
    const people = users.map((u) => {
      const c = convByUser.get(String(u._id));
      const prof = (c?.profile as Record<string, Record<string, string>> | undefined) || undefined;
      const intro = prof?.intro || null;
      const hr = prof?.hr || null;
      const src = u.metaInstagramId
        ? "instagram"
        : u.metaMessengerPsid
        ? "messenger"
        : "web";
      const email = String(u.email || "");
      const interestsArr = Array.isArray(u.interests) ? (u.interests as string[]) : [];
      const sub = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt as string) : null;
      const introObj = (u.intro as Record<string, unknown>) || null;

      // IG/FB shells are created with name "IG Friend"/"FB Friend" — replace
      // the placeholder with the real IG display name or @username.
      const rawName = String(u.name || "");
      const isPlaceholder = /^(IG|FB) Friend$/.test(rawName);
      const partnerName = (c?.partnerName as string) || "";
      const partnerUsername = (c?.partnerUsername as string) || "";
      const displayName =
        !rawName || isPlaceholder
          ? partnerName ||
            (partnerUsername ? `@${partnerUsername}` : "") ||
            "IG хэрэглэгч"
          : rawName;

      return {
        _id: String(u._id),
        source: src,
        name: displayName,
        username: u.username || "",
        igHandle: (u.instagram as string) || partnerUsername || "",
        avatar: (u.avatar as string) || (c?.partnerProfilePic as string) || "",
        email: email.endsWith("@antaqor.dm") ? "" : email,
        phone: (u.phone as string) || (intro?.phone as string) || "",
        // Demographics — web User.age (number) OR IG intro.age (string bucket)
        age: u.age ? String(u.age) : intro?.age || (introObj?.age as string) || "",
        gender: intro?.gender || "",
        // Interests — web tags OR IG intro.interest
        interests: interestsArr,
        interest: intro?.interest || "",
        role: intro?.role || "",
        goal: intro?.goal || "",
        aiExperience: (u.aiExperience as string) || "",
        bio: (u.bio as string) || "",
        level: (u.level as number) || 1,
        xp: (u.xp as number) || 0,
        credits: (u.credits as number) || 0,
        clan: (u.clan as string) || "",
        membershipActive: !!(sub && sub.getTime() > now),
        subscriptionExpiresAt: sub,
        accountRole: u.role || "user",
        banned: !!u.banned,
        createdAt: u.createdAt,
        // Web onboarding intro subdoc (separate from IG funnel)
        webIntro: introObj
          ? {
              refined: (introObj.refined as string) || "",
              nowWorkingOn: (introObj.nowWorkingOn as string) || "",
              longTermGoal: (introObj.longTermGoal as string) || "",
              giveTake: (introObj.giveTake as string) || "",
            }
          : null,
        introCompleted: !!(u.introCompletedAt || intro),
        intro,
        hr,
        intentLabel: (c?.intentLabel as string) || null,
        leadStatus: (c?.leadStatus as string) || null,
        memo: (c?.userMemo as Record<string, unknown>) || null,
        lastMessageAt: c?.lastMessageAt || null,
      };
    });

    // ─── HR analytics ───
    const stats = {
      total: people.length,
      web: people.filter((p) => p.source === "web").length,
      instagram: people.filter((p) => p.source === "instagram").length,
      messenger: people.filter((p) => p.source === "messenger").length,
      introCompleted: people.filter((p) => !!p.intro).length,
      hrCompleted: people.filter((p) => !!p.hr).length,
      hot: people.filter((p) => p.intentLabel === "hot").length,
      warm: people.filter((p) => p.intentLabel === "warm").length,
      paidMembers: people.filter((p) => p.membershipActive).length,
    };

    const interestMap = new Map<string, number>();
    for (const p of people) {
      const items = [...p.interests];
      if (p.interest) items.push(...String(p.interest).split(/[,/]/).map((s) => s.trim()));
      for (const it of items) {
        const t = it.trim();
        if (t) interestMap.set(t, (interestMap.get(t) || 0) + 1);
      }
    }
    const topInterests = [...interestMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, count]) => ({ label, count }));

    const ageBuckets: Record<string, number> = {
      "18-24": 0,
      "25-34": 0,
      "35-44": 0,
      "45+": 0,
      "тодорхойгүй": 0,
    };
    for (const p of people) {
      const a = String(p.age || "").trim();
      const n = parseInt(a, 10);
      if (/18-24/.test(a) || (n >= 13 && n <= 24)) ageBuckets["18-24"]++;
      else if (/25-34/.test(a) || (n >= 25 && n <= 34)) ageBuckets["25-34"]++;
      else if (/35-44/.test(a) || (n >= 35 && n <= 44)) ageBuckets["35-44"]++;
      else if (/45\+/.test(a) || (n >= 45 && n <= 120)) ageBuckets["45+"]++;
      else if (a) ageBuckets["тодорхойгүй"]++;
    }

    return NextResponse.json({ people, stats, topInterests, ageBuckets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
