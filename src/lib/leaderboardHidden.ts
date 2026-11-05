/* Тэргүүлэгчдээс БҮРМӨСӨН нуугдах бүртгэлүүд (2026-10-11, эзний хүсэлт).
   Эзэмшигчийн бүртгэл XP цуглуулсан ч жагсаалтад гарахгүй. /api/leaderboard
   ба /api/home-rail хоёулаа үүнийг ашиглана — нэг газар л засна. */
export const LEADERBOARD_HIDDEN_USERNAMES = ["antaqor"];
export const leaderboardHiddenMatch = { $match: { username: { $nin: LEADERBOARD_HIDDEN_USERNAMES } } };
