import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ charge: vi.fn(), generate: vi.fn(), save: vi.fn(), upstream: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "507f1f77bcf86cd799439011" } })) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => ({ ok: true }), LIMITS: {} }));
vi.mock("@/lib/credits", () => ({ spendCredits: mocks.charge, refundCredits: vi.fn() }));
vi.mock("@/lib/nanoBanana", () => ({ generateNanoBanana: mocks.generate, geminiImageKey: () => "test", NanoBananaError: class extends Error {} }));
vi.mock("@/lib/imagePricingServer", () => ({ loadImagePricing: async () => ({}) }));
vi.mock("@/lib/imagePricing", () => ({ findImageModel: (id: string) => ({ id, provider: id === "kling" ? "kling" : id === "gpt" ? "openai" : "gemini", supportsImageSize: true }), creditCost: () => 10, flatUsd: () => ({ usd: 0, estimate: true }) }));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn() }));
vi.mock("@/models/AiImage", () => ({ default: { create: mocks.save } }));
vi.mock("fs/promises", () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
import { POST } from "@/app/api/tools/generate-image/route";
import { POST as enhance } from "@/app/api/tools/enhance-prompt/route";
const request = (prompt: string, model = "nano2") => new NextRequest("http://localhost/api/tools/generate-image", { method: "POST", body: JSON.stringify({ prompt, model }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.charge.mockResolvedValue({ ok: true, balance: 90, required: 10 });
  mocks.generate.mockResolvedValue({ buf: Buffer.from("test"), mime: "image/png", modelVersion: "test", usd: 0, usdEstimate: true });
  mocks.save.mockResolvedValue({ _id: "test-image" });
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", mocks.upstream);
});
for (const length of [4001, 16000]) {
  it(`sends and stores all ${length} Mongolian characters including the final instruction`, async () => {
    const prompt = "зураг ".repeat(Math.ceil(length / 6)).slice(0, length - 8) + "ТӨГСГӨЛ!";
    expect(prompt.length).toBe(length);
    const result = await POST(request(prompt));
    expect(result.status).toBe(200);
    expect(mocks.generate.mock.calls[0][0].prompt).toBe(prompt);
    expect(mocks.save.mock.calls[0][0]).toMatchObject({ prompt, fullPrompt: prompt });
  });
}
it("rejects excess text before charging or calling the provider", async () => {
  expect((await POST(request("а".repeat(16001)))).status).toBe(400);
  expect(mocks.charge).not.toHaveBeenCalled();
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("rejects overlong legacy provider text rather than truncating it", async () => {
  expect((await POST(request("а".repeat(2501), "kling"))).status).toBe(400);
  expect((await POST(request("а".repeat(4001), "gpt"))).status).toBe(400);
  expect(mocks.charge).not.toHaveBeenCalled();
});
it("returns an enhanced prompt beyond 4000 characters intact", async () => {
  const prompt = "нарийн дүрслэл ".repeat(400) + "ТӨГСГӨЛ";
  mocks.upstream.mockResolvedValue(new Response(JSON.stringify({ status: "completed", output_text: prompt })));
  const response = await enhance(request("эх зураг ".repeat(600)));
  expect(response.status).toBe(200);
  expect((await response.json()).prompt).toBe(prompt);
});
it("rejects incomplete enhanced responses instead of replacing the original with a fragment", async () => {
  mocks.upstream.mockResolvedValue(new Response(JSON.stringify({ status: "incomplete", output_text: "fragment" })));
  const response = await enhance(request("эх зураг"));
  expect(response.status).toBe(502);
  expect((await response.json()).prompt).toBeUndefined();
});
it("does not truncate oversized enhanced output", async () => {
  mocks.upstream.mockResolvedValue(new Response(JSON.stringify({ status: "completed", output_text: "а".repeat(16001) })));
  expect((await enhance(request("эх зураг"))).status).toBe(502);
});
