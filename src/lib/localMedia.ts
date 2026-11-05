import path from "path";
import fs from "fs/promises";

// Манай рийлүүд нь public/uploads дотор ДИСК дээр сууж, nginx нь /uploads
// гэж түгээдэг (`/etc/nginx/snippets/antaqor-app.conf`). Тиймээс TikTok руу
// илгээхэд гадагш HTTP хийх шаардлагагүй — шууд дискнээс уншина.
//
// Энэ файлын ГОЛ үүрэг нь ЗАМЫН ШАЛГАЛТ: `videoUrl` нь DB-ээс ирдэг тул
// `/uploads/../../etc/passwd` төрлийн утга орж ирэх боломжийг хаана.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/mp4",
};

/** TikTok нь mp4 / quicktime / webm-ийг л хүлээж авна. */
export function videoMime(fileName: string): string | null {
  return MIME[path.extname(fileName).toLowerCase()] || null;
}

/** `/uploads/x.mp4` → үнэмлэхүй зам. Сагсны гадна гарвал `null`. */
export function resolveUploadPath(url: string): string | null {
  if (!url || !url.startsWith("/uploads/")) return null;
  const rel = url.slice("/uploads/".length);
  if (!rel || rel.includes("\0")) return null;
  const abs = path.resolve(UPLOAD_DIR, rel);
  // path.resolve нь `..`-г задалсан байна; сагсандаа байгаа эсэхийг ТУЛГАНА.
  if (abs !== UPLOAD_DIR && !abs.startsWith(UPLOAD_DIR + path.sep)) return null;
  return abs;
}

export async function statUpload(
  url: string
): Promise<{ abs: string; bytes: number; mime: string } | null> {
  const abs = resolveUploadPath(url);
  if (!abs) return null;
  const mime = videoMime(abs);
  if (!mime) return null;
  try {
    const st = await fs.stat(abs);
    if (!st.isFile()) return null;
    return { abs, bytes: st.size, mime };
  } catch {
    return null;
  }
}
