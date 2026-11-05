import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validate, scheduleDate } from "../src/lib/socialInput";
const mocks = vi.hoisted(() => ({ client: { publishingHeadroom: vi.fn(), publishPost: vi.fn(), getPermalink: vi.fn() }, meta: vi.fn() }));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn() }));
vi.mock("@/models/MetaPage", () => ({ default: { find: mocks.meta } }));
vi.mock("@/lib/adminAuth", () => ({ getThreadsClient: vi.fn(() => mocks.client) }));
import { publishInstagram, publishFacebook, publishThreads, metaTargetFor } from "../src/lib/socialPublish";
import { ThreadsAPI } from "../src/lib/threads";
const target = { key: "antaqor", label: "Antaqor", pageId: "123", igId: "456", pageToken: "test", igToken: "test" };
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.restoreAllMocks(); mocks.meta.mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [] }) }) }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("Shared content validation", () => {
  it("accepts video-only Instagram content", () => expect(validate({ text: "", videoUrl: "https://antaqor.com/uploads/reel.mp4", platforms: ["instagram"] })).toEqual([]));
  it("rejects Instagram without media", () => expect(validate({ text: "hello", platforms: ["instagram"] }).length).toBe(1));
  it("rejects mixed image and video", () => expect(validate({ text: "caption", imageUrl: "https://a.com/a.jpg", videoUrl: "https://a.com/a.mp4", platforms: ["threads"] }).length).toBe(1));
  it("rejects unsafe media schemes", () => expect(validate({ text: "", imageUrl: "javascript:alert(1)", platforms: ["instagram"] }).length).toBe(1));
  it("checks each channel override independently", () => expect(validate({ text: "short", overrides: { threads: "x".repeat(501) }, platforms: ["threads"] }).length).toBe(1));
  it("does not count emoji surrogate pairs twice", () => expect(validate({ text: "😀".repeat(500), platforms: ["threads"] })).toEqual([]));
  it("rejects stale and invalid schedules rather than publishing now", () => { expect(() => scheduleDate("invalid")).toThrow(); expect(() => scheduleDate("2020-01-01")).toThrow(); expect(scheduleDate(undefined)).toBeNull(); expect(scheduleDate("2030-01-01", 0)?.getUTCFullYear()).toBe(2030); });
});
describe("Platform contracts", () => {
  it("waits for Instagram Reel readiness and uses REELS payload", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({id:"container"})).mockResolvedValueOnce(response({status_code:"FINISHED"})).mockResolvedValueOnce(response({id:"media"})).mockResolvedValueOnce(response({permalink:"https://instagram.com/reel/abc"})); vi.stubGlobal("fetch",fetcher);
    const result=await publishInstagram(target,"caption",undefined,"https://antaqor.com/uploads/a.mp4"); expect(result.status).toBe("ok"); const form=new URLSearchParams(fetcher.mock.calls[0][1].body); expect(form.get("media_type")).toBe("REELS"); expect(form.get("video_url")).toContain("a.mp4"); expect(form.has("image_url")).toBe(false);
  });
  it("does not publish an unfinished Instagram container", async () => {
    vi.useFakeTimers(); const fetcher=vi.fn().mockResolvedValue(response({status_code:"IN_PROGRESS"}));fetcher.mockResolvedValueOnce(response({id:"container"}));vi.stubGlobal("fetch",fetcher);
    const pending=publishInstagram(target,"caption","https://antaqor.com/a.jpg");await vi.runAllTimersAsync();expect((await pending).status).toBe("error");expect(fetcher.mock.calls.some(c=>String(c[0]).includes("media_publish"))).toBe(false);
  });
  it("uses Facebook hosted upload then finish exactly once",async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(response({video_id:"reel1",upload_url:"https://rupload.facebook.com/video-upload/v21.0/reel1"})).mockResolvedValueOnce(response({success:true})).mockResolvedValueOnce(response({success:true})).mockResolvedValueOnce(response({status:{publishing_phase:{status:"complete"}}}));vi.stubGlobal("fetch",fetcher);
    const result=await publishFacebook(target,"caption",undefined,"https://antaqor.com/a.mp4");expect(result.status).toBe("ok");expect(fetcher.mock.calls[1][1].headers.file_url).toBe("https://antaqor.com/a.mp4");expect(new URLSearchParams(fetcher.mock.calls[2][1].body).get("upload_phase")).toBe("finish");
  });
  it("never sends the page token to a foreign upload host",async()=>{
    const fetcher=vi.fn().mockResolvedValue(response({video_id:"x",upload_url:"https://other.example/upload"}));vi.stubGlobal("fetch",fetcher);expect((await publishFacebook(target,"",undefined,"https://a.com/a.mp4")).status).toBe("error");expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not claim success when Facebook omits the post ID",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(response({})));expect((await publishFacebook(target,"hello")).status).toBe("unknown");});
  it("does not fall back to a different brand when target key is missing",async()=>{expect(await metaTargetFor("missing-brand")).toBeNull();});
  it("passes video and Threads options through the fan-out adapter",async()=>{mocks.client.publishingHeadroom.mockResolvedValue({postsLeft:5});mocks.client.publishPost.mockResolvedValue({id:"post"});mocks.client.getPermalink.mockResolvedValue("https://threads.net/post/1");await publishThreads("caption",undefined,"uid",{topicTag:"AI"},"https://a.com/a.mp4");expect(mocks.client.publishPost).toHaveBeenLastCalledWith("caption",undefined,{topicTag:"AI"},"https://a.com/a.mp4");});
  it("Threads waits for video processing before final publish",async()=>{const fetcher=vi.fn().mockResolvedValueOnce(response({id:"container"})).mockResolvedValueOnce(response({status:"FINISHED"})).mockResolvedValueOnce(response({id:"post"}));vi.stubGlobal("fetch",fetcher);await new ThreadsAPI("test","uid").publishPost("caption",undefined,{topicTag:"AI",linkUrl:"https://a.com"},"https://a.com/a.mp4");const form=fetcher.mock.calls[0][1].body as URLSearchParams;expect(form.get("media_type")).toBe("VIDEO");expect(form.has("link_attachment")).toBe(false);expect(fetcher.mock.calls[2][0]).toContain("threads_publish");});
});
