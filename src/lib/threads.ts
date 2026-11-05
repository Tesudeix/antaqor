const API_BASE = "https://graph.threads.net/v1.0";
const AUTH_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";

export interface ThreadsPostOptions {
  /** Renders a link preview card. TEXT posts only. */
  linkUrl?: string;
  /** Who may reply: everyone | accounts_you_follow | mentioned_only */
  replyControl?: "everyone" | "accounts_you_follow" | "mentioned_only";
  /** A single Threads topic tag, with or without the leading #. */
  topicTag?: string;
  quotePostId?: string;
}

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
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  private async post(path: string, body: Record<string, string>) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
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
    if (!container.id) throw new Error("Threads container ID алга");
    // Авто хариулт ч контейнерийн уралдаанд ордог — доорх publishPost-ын
    // тайлбарыг үз.
    await this.waitForContainer(container.id, 8);
    return this.post(`/${this.uid}/threads_publish`, {
      creation_id: container.id,
    });
  }

  // Publish a standalone post, optionally with a photo. An IMAGE container is
  // fetched by Threads asynchronously, so it must reach FINISHED before
  // threads_publish will accept it. TEXT containers need a moment too —
  // see the measurement in publishPost below.
  async publishPost(text: string, imageUrl?: string, opts: ThreadsPostOptions = {}, videoUrl?: string) {
    const body: Record<string, string> = videoUrl
      ? { media_type: "VIDEO", video_url: videoUrl, text }
      : imageUrl
      ? { media_type: "IMAGE", image_url: imageUrl, text }
      : { media_type: "TEXT", text };

    // link_attachment renders a real preview card instead of a bare URL in the
    // body — the difference between a link people scroll past and one they tap.
    // Threads only accepts it on TEXT posts (an image already fills that slot).
    if (opts.linkUrl && !imageUrl && !videoUrl) body.link_attachment = opts.linkUrl;
    if (opts.replyControl) body.reply_control = opts.replyControl;
    if (opts.topicTag) body.topic_tag = opts.topicTag.replace(/^#/, "");
    if (opts.quotePostId) body.quote_post_id = opts.quotePostId;

    const container = await this.post(`/${this.uid}/threads`, body);
    if (!container.id) throw new Error("Threads container ID алга");
    // 2026-10-05: TEXT контейнерийг ч ХҮЛЭЭНЭ. Өмнө нь "TEXT шууд бэлэн"
    // гэж үзээд алгасдаг байв. Хэмжихэд шинэ TEXT контейнер 0 секундэд
    // IN_PROGRESS, ~2 секундэд FINISHED болдог. Хүлээлгүй нийтлэх хүсэлт
    // явуулбал Threads "The requested resource does not exist" гэж
    // буцаадаг — сүлжээний саатал хангалттай урт байвал санамсаргүй
    // ажилладаг тул алдаа нь завсардмал харагддаг байсан.
    await this.waitForContainer(container.id, videoUrl ? 45 : imageUrl ? 15 : 8);
    try {
      const published = await this.post(`/${this.uid}/threads_publish`, { creation_id: container.id });
      if (!published.id) { const error = new Error("Threads ID буцаасангүй. Сувгаа шалгана уу."); error.name = "PublishUncertain"; throw error; }
      return published;
    } catch (error) {
      if (error instanceof Error && ["TypeError", "TimeoutError", "AbortError"].includes(error.name)) error.name = "PublishUncertain";
      throw error;
    }
  }

  /**
   * Remaining posts in the rolling 24h window (250 posts / 1000 replies).
   * Checked BEFORE publishing: hitting the cap otherwise looks exactly like a
   * broken token — the post simply never appears and nothing says why.
   */
  async publishingHeadroom(): Promise<{ postsLeft: number; repliesLeft: number }> {
    try {
      const r = await this.get(`/${this.uid}/threads_publishing_limit`, {
        fields: "quota_usage,config,reply_quota_usage,reply_config",
      });
      const row = (Array.isArray(r.data) ? r.data[0] : {}) as Record<string, unknown>;
      const used = Number(row.quota_usage ?? 0);
      const total = Number((row.config as { quota_total?: number })?.quota_total ?? 250);
      const rUsed = Number(row.reply_quota_usage ?? 0);
      const rTotal = Number((row.reply_config as { quota_total?: number })?.quota_total ?? 1000);
      return { postsLeft: Math.max(0, total - used), repliesLeft: Math.max(0, rTotal - rUsed) };
    } catch {
      // Unknown headroom must not block a publish — assume room and let the
      // real API call be the authority.
      return { postsLeft: 999, repliesLeft: 999 };
    }
  }

  private async waitForContainer(containerId: string, tries = 15, delayMs = 2000) {
    for (let i = 0; i < tries; i++) {
      // Шинэ контейнер дандаа IN_PROGRESS байдаг тул эхний шалгалтыг
      // шууд явуулахгүй — нэг дэмий API дуудлага хэмнэнэ.
      if (i === 0) await new Promise((r) => setTimeout(r, 900));
      const s = await this.get(`/${containerId}`, { fields: "status,error_message" });
      if (s.status === "FINISHED") return;
      if (s.status === "ERROR" || s.status === "EXPIRED") {
        throw new Error(s.error_message || `Threads container ${String(s.status).toLowerCase()}`);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error("Threads зургийг боловсруулж дууссангүй. Дахин оролдоно уу.");
  }

  async getPermalink(threadId: string): Promise<string> {
    const data = await this.get(`/${threadId}`, { fields: "permalink" });
    return data.permalink || "";
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
