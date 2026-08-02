// Fetch a partner's public profile from Meta Graph API.
// IG: GET /<igsid>?fields=name,username,profile_pic
// FB: GET /<psid>?fields=first_name,last_name,profile_pic
// Both require a Page Access Token with messaging permission.

import type { MetaPlatform } from "@/models/MetaConversation";

const IG_BASE = "https://graph.instagram.com/v23.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

export interface PartnerProfile {
  name?: string;
  username?: string;
  profilePic?: string;
  isVerified?: boolean;
  followsBusiness?: boolean;
  businessFollows?: boolean;
}

// IG Messaging API exposes these fields for DM partners:
//   name, username, profile_pic, is_verified_user,
//   is_user_follow_business, is_business_follow_user.
// FB Messenger only exposes first_name, last_name, profile_pic.
const IG_FIELDS = [
  "name",
  "username",
  "profile_pic",
  "is_verified_user",
  "is_user_follow_business",
  "is_business_follow_user",
].join(",");

const FB_FIELDS = ["first_name", "last_name", "profile_pic"].join(",");

export async function fetchPartnerProfile(
  platform: MetaPlatform,
  partnerId: string
): Promise<PartnerProfile | null> {
  let token: string | undefined;
  let url: string;

  if (platform === "instagram") {
    token = process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN;
    const base = token?.startsWith("IGAA") ? IG_BASE : FB_BASE;
    url = `${base}/${encodeURIComponent(partnerId)}?fields=${IG_FIELDS}&access_token=${encodeURIComponent(token || "")}`;
  } else {
    token = process.env.FB_PAGE_ACCESS_TOKEN;
    url = `${FB_BASE}/${encodeURIComponent(partnerId)}?fields=${FB_FIELDS}&access_token=${encodeURIComponent(token || "")}`;
  }
  if (!token) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
      profile_pic?: string;
      is_verified_user?: boolean;
      is_user_follow_business?: boolean;
      is_business_follow_user?: boolean;
    };
    const name =
      data.name ||
      [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
      undefined;
    return {
      name,
      username: data.username,
      profilePic: data.profile_pic,
      isVerified: data.is_verified_user,
      followsBusiness: data.is_user_follow_business,
      businessFollows: data.is_business_follow_user,
    };
  } catch {
    return null;
  }
}
