import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import YtJob from "@/models/YtJob";
import YtAgent from "@/models/YtAgent";
import { resolveAgent, failStalled, refundJob } from "@/lib/ytgrab";

export const dynamic = "force-dynamic";

/* ─── AGENT-ИЙН ТАЛ ─────────────────────────────────────────────────────
   Хэрэглэгчийн машин дээрх agent-тай л харьцана. Session БИШ, тухайн
   хэрэглэгчийн ӨӨРИЙН нууцаар нэвтэрнэ (sha256-аар хайна).

   ГОЛ ХАМГААЛАЛТ: `claim` нь ЗӨВХӨН нууц эзэмшигчийн ажлыг буцаана.
   Үүнгүй бол хэн ч нэг нууцтай болоод бусдын видеог өөрийн машин руу
   татаж, бусдын контентыг харах байсан. */

function deny() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const agent = await resolveAgent(req.headers.get("x-ytgrab-token"));
  if (!agent) return deny();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  /* ── Зүрхний цохилт: ямар ч үйлдэл дээр шинэчилнэ. Хуудас нь үүнээр
     "машин холбогдсон эсэх"-ийг харуулна — эс тэгвээс унтарсан машины
     ажил чимээгүй хэвтэж, хүн "эвдэрсэн" гэж тайлна. ── */
  await YtAgent.updateOne(
    { _id: agent._id },
    {
      /* version/outDir-ыг зөвхөн claim дамжуулдаг — progress/result үед хоосоор
         дарж бичвэл ажил явж байхад хувилбар "" болж MP3 хаагдана. */
      $set: {
        lastSeen: new Date(),
        ...(body.version ? { version: String(body.version).slice(0, 40) } : {}),
        ...(body.outDir ? { outDir: String(body.outDir).slice(0, 300) } : {}),
      },
    },
  );

  if (action === "ping") return NextResponse.json({ ok: true });

  if (action === "claim") {
    await failStalled();
    /* findOneAndUpdate нь MongoDB дотор атомаар гүйнэ — нэг хэрэглэгч
       хоёр машин зэрэг ажиллуулсан ч нэг ажлыг хоёр удаа авахгүй. */
    const job = await YtJob.findOneAndUpdate(
      { user: agent.user, status: "queued", runner: { $ne: "server" } },
      { $set: { status: "working", claimedAt: new Date(), stage: "Эхлэв", pct: 0 } },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!job) return NextResponse.json({ job: null });
    return NextResponse.json({
      job: {
        id: String(job._id),
        kind: job.kind,
        url: job.url,
        height: job.height,
        mode: job.mode,
        abr: job.abr || 0,
        wantUpload: job.wantUpload,
      },
    });
  }

  if (action === "progress") {
    await YtJob.updateOne(
      { _id: String(body.id || ""), user: agent.user, status: "working" },
      {
        $set: {
          pct: Math.max(0, Math.min(100, Number(body.pct) || 0)),
          stage: String(body.stage || "").slice(0, 60),
        },
      },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "result") {
    const job = await YtJob.findOne({ _id: String(body.id || ""), user: agent.user });
    if (!job) return NextResponse.json({ error: "Ажил олдсонгүй" }, { status: 404 });

    if (body.ok === true) {
      job.status = "done";
      job.pct = 100;
      job.stage = "Бэлэн";
      job.error = "";
      if (body.info && typeof body.info === "object") {
        job.info = body.info as never;
        job.title = String((body.info as Record<string, unknown>).title || "").slice(0, 300);
      }
      if (body.fileName) job.fileName = String(body.fileName).slice(0, 300);
      if (body.macPath) job.macPath = String(body.macPath).slice(0, 500);
      if (body.fileSize) job.fileSize = Number(body.fileSize) || 0;
    } else {
      job.status = "error";
      job.error = String(body.error || "Татаж чадсангүй").slice(0, 300);
      /* Бүтэлгүйтсэн татацын кредит БУЦНА. */
      await refundJob(job);
    }
    await job.save();
    return NextResponse.json({ ok: true, refunded: job.refunded });
  }

  return NextResponse.json({ error: "Үйлдэл буруу" }, { status: 400 });
}
