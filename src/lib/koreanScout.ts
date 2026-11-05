import { SCOUT_TOOLS, runScoutTool, loadCards } from "@/lib/scoutTools";
import { providers, chatCompletion, type ChatMsg } from "@/lib/scoutProvider";
import { profileBlock, type ScoutProfile } from "@/lib/scoutMemory";

/* ─── UB Korean Food Scout — агентын гүйлт ────────────────────────────────
   Агент = LLM + заавар + хэрэгсэл + өгөгдөл + ОЙ. Энэ файл тэр тавыг нэг
   давталтад холбоно: загвар хэрэгсэл дуудна → бид Mongo-гоос жинхэнэ
   өгөгдөл буцаана → загвар дараагийн алхмаа шийднэ → эцэст нь хариулна.

   Нийлүүлэгчийн сонголт, HTTP дуудлага нь `scoutProvider`-т амьдардаг —
   ойн задлалт ч мөн тэндээс дууддаг тул OpenAI данс сэргэхэд хоёулаа
   зэрэг шилжинэ.                                                         */

const MAX_ROUNDS = 4;      // хэрэгсэл дуудах давталтын дээд хязгаар
const MAX_TURNS = 10;      // хадгалах харилцааны түүх
const MAX_USER_CHARS = 700;

function systemPrompt(profile?: ScoutProfile): string {
  const today = new Date().toISOString().slice(0, 10);
  const personal = profile ? profileBlock(profile) : "";

  return `Чи бол "UB Korean Food Scout" — Улаанбаатарын солонгос хоолны газар сонгож өгдөг агент. Өнөөдөр ${today}.

ЧИНИЙ ГАНЦ АЖИЛ: хэрэглэгчийн нөхцөлд (төсөв, дүүрэг, хүний тоо, цаг, хоолны төрөл) хамгийн тохирох 1-3 газрыг олж, ЯАГААД гэдгийг тайлбарлах.

ӨГӨГДЛИЙН ХАТУУ ДҮРЭМ:
- Чи ресторан, үнэ, цэс, цагийн хуваарийг ӨӨРӨӨСӨӨ ЗОХИОХГҮЙ. Зөвхөн хэрэгслээс буцаж ирсэн өгөгдлийг ашиглана.
- Хариулт бүрийн өмнө дор хаяж нэг хэрэгсэл дуудна. Ихэвчлэн search_restaurants эхэлнэ.
- Хэрэгсэл count: 0 буцаавал ТЭР ДОРОО дахин хай — шүүлтээ сулруул (эхлээд cuisine-г хая, дараа нь цагийг, эцэст нь дүүргийг).
- ХООСОН ГАРАА ХООСОН БҮҮ БУЦ. Хариулт нь "олдсонгүй" гэсэн ГАНЦ мөр байж БОЛОХГҮЙ. nearest_alternatives ирсэн бол: нэг богино мөрөөр ямар нөхцөл нь бүтээгүйг хэл, дараа нь тэдгээр газрыг ЖИНХЭНЭ сонголт болгон санал болго. Санал огт байхгүй үед л "манай санд одоогоор алга" гэж хэлээд ямар мэдээлэл дутаж байгааг нэг мөрөөр хэл.
- verified: false бол үнийн дүнгийн ард "≈ баталгаажаагүй" гэж ЗААВАЛ бич.
- Сангаас гараагүй ямар ч баримт (Google-ийн үнэлгээ, шинэ салбар) яриж БОЛОХГҮЙ.
- БАЙРШИЛ ЗОХИОХЫГ ХАТУУ ХОРИГЛОНО. Ресторан "district: null" эсвэл "location_warning"-тэй бол байршлыг нь ОГТ бүү дурд. Хэрэглэгчийн хэлсэн хот/дүүргийг рестораны хаяг болгож БҮҮ ХУУЛ.
- ХАМРАХ ХҮРЭЭ: манай сан ЗӨВХӨН Улаанбаатарын солонгос хоолны газрыг мэднэ. Өөр хот, өөр төрлийн хоол асуувал нэг мөрөөр шулуухан хэл.
- Дүүргийн нэрийг хэрэглэгчид хэлэх шаардлага гарвал ЗӨВХӨН "district_mn" (Хан-Уул, Сүхбаатар) хэлбэрийг бич. Латин бичлэг ("Khan-Uul") нь дотоод түлхүүр — дэлгэц дээр хэзээ ч бүү гарга.
- Талбарын НЭРИЙГ хэрэглэгчид бүү үзүүл. "verified: false", "district: null" гэж бүү бич — "≈ баталгаажаагүй", "байршил бүртгэгдээгүй" гэж хүний хэлээр хэл.

ХАРИУЛТЫН ХЭЛБЭР:
- Монголоор. Хэрэглэгч англиар бичвэл англиар.
- ХАМГИЙН ИХДЭЭ 3 санал. Санал бүр НЭГ мөр: нэр — яагаад — үнэ.
- Markdown гарчиг, ## тэмдэг, ** од БҮҮ хэрэглэ. Мөр бүр "• "-оор эхэлнэ.
- Оршил, төгсгөлийн эелдэг үг БҮҮ бич. Шууд саналаа хэл. Дээд тал нь 70 үг.
- Дүүрэг, хаяг, цагийн хуваарь, зогсоолыг текстэд БҮҮ БИЧ — карт бүгдийг нь доор харуулна. Текстэд зөвхөн СОНГОЛТЫН ШАЛТГААН ба тоо л байна.
- "≈ баталгаажаагүй" гэдгийг мөр БҮРТ бүү давт — хамгийн ихдээ нэг удаа, эсвэл огт бүү бич (систем шаардлагатай бол доор нь өөрөө нэмнэ).
- Төсөв өгсөн бол тоог гарга: "2 хүн × 32,000₮ = 64,000₮, 80,000₮-д багтана."
- Тодруулах асуулт хамгийн ихдээ НЭГ, хариултын эцэст. Мэдэж байгаа зүйлээ дахин бүү асуу.${personal}`;
}

export interface ScoutResult {
  reply: string;
  cards: Awaited<ReturnType<typeof loadCards>>;
  toolsUsed: string[];
  provider: string;
}

export interface ScoutInput {
  role: "user" | "assistant";
  content: string;
}

export async function runScout(
  history: ScoutInput[],
  profile?: ScoutProfile
): Promise<ScoutResult | { error: string }> {
  const list = providers();
  if (list.length === 0) return { error: "AI тохиргоо байхгүй" };

  const trimmed = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_CHARS) }))
    .slice(-MAX_TURNS);
  if (trimmed.length === 0) return { error: "Мессеж хоосон" };

  const sys = systemPrompt(profile);

  for (const p of list) {
    const messages: ChatMsg[] = [{ role: "system", content: sys }, ...trimmed];
    const touched: string[] = [];
    const toolsUsed: string[] = [];
    let failed = false;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const choice = await chatCompletion(p, messages, { tools: SCOUT_TOOLS, maxTokens: 900 });
      if (!choice) { failed = true; break; }

      const calls = choice.message?.tool_calls || [];
      if (calls.length === 0) {
        const reply = (choice.message?.content || "").trim();
        if (!reply) { failed = true; break; }
        return { reply, cards: await loadCards(touched), toolsUsed, provider: p.name };
      }

      // Загвар хэрэгсэл дуудлаа — түүнийг түүхэнд буцааж тавихгүй бол
      // дараагийн эргэлтэд протокол эвдэрнэ.
      messages.push({ role: "assistant", content: choice.message?.content || "", tool_calls: calls });

      for (const c of calls.slice(0, 4)) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const run = await runScoutTool(c.function.name, args);
        toolsUsed.push(c.function.name);
        for (const id of run.touched) if (!touched.includes(id)) touched.push(id);
        messages.push({
          role: "tool",
          tool_call_id: c.id,
          content: JSON.stringify(run.result).slice(0, 12_000),
        });
      }
    }

    // Хэрэгсэл дуудсан ч эцсийн хариулт өгөөгүй бол — сүүлийн боломж:
    // хэрэгсэлгүйгээр нэг л удаа асууна (өгөгдөл нь түүхэнд аль хэдийн бий).
    if (!failed && touched.length > 0) {
      const last = await chatCompletion(
        p,
        [
          { role: "system", content: sys },
          ...trimmed,
          { role: "user", content: "Дээрх хайлтын үр дүнг ашиглан ЭЦСИЙН саналаа одоо бич. Дахин хэрэгсэл бүү дууд." },
        ],
        { maxTokens: 700 }
      );
      const reply = (last?.message?.content || "").trim();
      if (reply) return { reply, cards: await loadCards(touched), toolsUsed, provider: p.name };
    }
    console.error(`[scout] provider ${p.name} exhausted, falling through`);
  }

  return { error: "Агент түр доголдов. Дахин оролдоно уу." };
}
