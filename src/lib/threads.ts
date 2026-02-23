const API_BASE = "https://graph.threads.net/v1.0";
const AUTH_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";

export class ThreadsAPI {
  private token: string;
  private uid: string;

  constructor(accessToken: string, userId: string) {
    this.token = accessToken;
    this.uid = userId;
  }

  private async get(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("access_token", this.token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  private async post(path: string, body: Record<string, string>) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, access_token: this.token }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  async getProfile() {
    return this.get("/me", {
      fields: "id,username,name,threads_profile_picture_url,threads_biography",
    });
  }

  async getThreads(limit = 25, after?: string) {
    const params: Record<string, string> = {
      fields:
        "id,media_product_type,media_type,media_url,permalink,text,timestamp,shortcode,thumbnail_url,is_quote_post,has_replies",
      limit: String(limit),
    };
    if (after) params.after = after;
    return this.get(`/${this.uid}/threads`, params);
  }

  async createAndPublish(text: string, replyToId?: string) {
    const body: Record<string, string> = { media_type: "TEXT", text };
    if (replyToId) body.reply_to_id = replyToId;
    const container = await this.post(`/${this.uid}/threads`, body);
    return this.post(`/${this.uid}/threads_publish`, {
      creation_id: container.id,
    });
  }

  async getReplies(threadId: string) {
    return this.get(`/${threadId}/replies`, {
      fields:
        "id,text,username,permalink,timestamp,media_type,has_replies,hide_status",
    });
  }

  async getConversation(threadId: string) {
    return this.get(`/${threadId}/conversation`, {
      fields:
        "id,text,username,permalink,timestamp,media_type,has_replies,hide_status",
      reverse: "true",
    });
  }

  async manageReply(replyId: string, hide: boolean) {
    return this.post(`/${replyId}/manage_reply`, { hide: String(hide) });
  }

  async deleteThread(threadId: string) {
    const res = await fetch(
      `${API_BASE}/${threadId}?access_token=${this.token}`,
      { method: "DELETE" }
    );
    return res.json();
  }

  async getUserInsights(period: "day" | "week" | "days_28" = "days_28") {
    return this.get(`/${this.uid}/threads_insights`, {
      metric: "views,likes,replies,reposts,quotes,followers_count",
      period,
    });
  }

  async getThreadInsights(threadId: string) {
    return this.get(`/${threadId}/insights`, {
      metric: "views,likes,replies,reposts,quotes",
    });
  }

  static getAuthorizationUrl(
    appId: string,
    redirectUri: string,
    scopes: string[]
  ) {
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes.join(","),
      response_type: "code",
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  static async exchangeCodeForToken(
    code: string,
    appId: string,
    appSecret: string,
    redirectUri: string
  ) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    return res.json();
  }

  static async exchangeForLongLivedToken(
    shortToken: string,
    appSecret: string
  ) {
    const params = new URLSearchParams({
      grant_type: "th_exchange_token",
      client_secret: appSecret,
      access_token: shortToken,
    });
    const res = await fetch(
      `https://graph.threads.net/access_token?${params.toString()}`
    );
    return res.json();
  }

  static async refreshToken(token: string) {
    const params = new URLSearchParams({
      grant_type: "th_refresh_token",
      access_token: token,
    });
    const res = await fetch(
      `https://graph.threads.net/refresh_access_token?${params.toString()}`
    );
    return res.json();
  }
}
