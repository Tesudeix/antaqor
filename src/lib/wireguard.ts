import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";

const run = promisify(execFile);

/** Тушаалд өгөгдлийг STDIN-ээр дамжуулна. Нууц түлхүүрийг аргумент болгож
    болохгүй: аргумент нь `ps`-д харагддаг тул тэр агшинд задарна. */
function runWithStdin(cmd: string, args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `exit ${code}`))));
    p.stdin.write(input);
    p.stdin.end();
  });
}

/* ─── WireGuard — /vpn хуудасны сервер тал ────────────────────────────────
   Апп нь root эрхээр ажилладаг тул `wg`-г шууд дуудна. ГЭХДЭЭ хаана ч
   shell ашиглахгүй: `execFile` нь аргументыг МАССИВААР дамжуулдаг учир
   админы бичсэн нэр (label) хэзээ ч тушаал болж хувирахгүй. Нэрийг зөвхөн
   тохиргооны файлын тайлбар мөрөнд бичнэ, түүнийг ч цэвэрлэнэ. */

const WG_IF = "wg0";
const CONF = `/etc/wireguard/${WG_IF}.conf`;
const SUBNET = "10.66.66";
const SERVER_IP = `${SUBNET}.1`;
/** Клиент холбогдох хаяг. IP нь домэйноос найдвартай — DNS унасан ч ажиллана. */
const ENDPOINT = process.env.WG_ENDPOINT || "178.128.104.98:51820";
const DNS = process.env.WG_DNS || "1.1.1.1, 8.8.8.8";

/** WireGuard түлхүүр нь үргэлж 44 тэмдэгт base64. Shell-д өгөхөөс өмнө
    ЗААВАЛ шалгана — энэ нь тушаал руу гадны утга орох цорын ганц зам. */
const KEY_RE = /^[A-Za-z0-9+/]{43}=$/;

export interface WgPeer {
  publicKey: string;
  label: string;
  address: string;
  lastHandshake: number; // unix seconds, 0 = хэзээ ч холбогдоогүй
  rx: number;
  tx: number;
}

function sanitizeLabel(raw: unknown): string {
  const s = String(raw ?? "").replace(/[\r\n]/g, " ").trim();
  /* Тайлбар мөрийг эвдэхгүй, файлыг уншихад төөрөгдөл үүсгэхгүй тэмдэгтүүд
     л үлдэнэ. Хоосон бол огт нэргүй байснаас "device" дээр нь. */
  const cleaned = s.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 40).trim();
  return cleaned || "device";
}

/** `wg show wg0 dump` — ЭХНИЙ мөр нь интерфэйсийнх бөгөөд СЕРВЕРИЙН НУУЦ
    ТҮЛХҮҮРИЙГ агуулдаг. Түүнийг хэзээ ч буцаахгүй, шууд алгасна. */
async function dumpPeers(): Promise<Map<string, { address: string; lastHandshake: number; rx: number; tx: number }>> {
  const out = new Map<string, { address: string; lastHandshake: number; rx: number; tx: number }>();
  try {
    const { stdout } = await run("wg", ["show", WG_IF, "dump"]);
    const lines = stdout.trim().split("\n").slice(1); // 1-р мөр = интерфэйс
    for (const line of lines) {
      const f = line.split("\t");
      if (f.length < 8) continue;
      out.set(f[0], {
        address: (f[3] || "").split(",")[0].trim(),
        lastHandshake: Number(f[4]) || 0,
        rx: Number(f[5]) || 0,
        tx: Number(f[6]) || 0,
      });
    }
  } catch {
    /* интерфэйс унтарсан байж болно — хоосон буцаана */
  }
  return out;
}

/** Нэрсийг тохиргооны файлаас уншина: `# name: Утас` мөр нь дараагийн
    [Peer] блокт хамаарна. */
async function readLabels(): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  let conf = "";
  try {
    conf = await fs.readFile(CONF, "utf8");
  } catch {
    return labels;
  }
  let pending = "";
  for (const raw of conf.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^#\s*name:\s*(.+)$/i);
    if (m) { pending = m[1].trim(); continue; }
    const p = line.match(/^PublicKey\s*=\s*(.+)$/i);
    if (p) { if (pending) labels.set(p[1].trim(), pending); pending = ""; }
  }
  return labels;
}

export async function listPeers(): Promise<WgPeer[]> {
  const [dump, labels] = await Promise.all([dumpPeers(), readLabels()]);
  return [...dump.entries()].map(([publicKey, d]) => ({
    publicKey,
    label: labels.get(publicKey) || "",
    address: d.address,
    lastHandshake: d.lastHandshake,
    rx: d.rx,
    tx: d.tx,
  }));
}

async function serverPublicKey(): Promise<string> {
  const { stdout } = await run("wg", ["show", WG_IF, "public-key"]);
  return stdout.trim();
}

/** Дараагийн сул IP. .1 нь сервер тул 2-оос эхэлнэ. */
async function nextFreeIp(): Promise<string> {
  const used = new Set<number>([1]);
  for (const p of await listPeers()) {
    const m = p.address.match(/^10\.66\.66\.(\d+)/);
    if (m) used.add(Number(m[1]));
  }
  /* Тохиргооны файлд байгаа ч ажиллахгүй байгаа peer-ийг ч тооцно —
     эс бөгөөс дахин ашиглагдаж, хоёр төхөөрөмж мөргөлдөнө. */
  try {
    const conf = await fs.readFile(CONF, "utf8");
    for (const m of conf.matchAll(/10\.66\.66\.(\d+)/g)) used.add(Number(m[1]));
  } catch { /* файл байхгүй бол dump-аар л явна */ }

  for (let i = 2; i <= 254; i++) if (!used.has(i)) return `${SUBNET}.${i}`;
  throw new Error("subnet_full");
}

export interface NewPeer {
  publicKey: string;
  address: string;
  label: string;
  /** Клиентийн бүрэн тохиргоо. Нууц түлхүүрийг агуулна — НЭГ Л УДАА
      харагдана, сервер дээр хадгалагдахгүй. */
  config: string;
}

export async function addPeer(rawLabel: unknown): Promise<NewPeer> {
  const label = sanitizeLabel(rawLabel);

  const { stdout: privKey } = await run("wg", ["genkey"]);
  const priv = privKey.trim();
  const pub = (await runWithStdin("wg", ["pubkey"], priv + "\n")).trim();
  const { stdout: pskOut } = await run("wg", ["genpsk"]);
  const psk = pskOut.trim();

  if (!KEY_RE.test(pub) || !KEY_RE.test(psk)) throw new Error("key_generation_failed");

  const address = await nextFreeIp();
  const srvPub = await serverPublicKey();

  /* Ажиллаж буй интерфэйст нэмнэ. PSK-г файлаар дамжуулна — тушаалын
     мөрөнд бичвэл `ps`-ээр бусад процесст харагдана. */
  const pskPath = `/run/wg-psk-${Date.now()}`;
  await fs.writeFile(pskPath, psk + "\n", { mode: 0o600 });
  try {
    await run("wg", [
      "set", WG_IF,
      "peer", pub,
      "preshared-key", pskPath,
      "allowed-ips", `${address}/32`,
    ]);
  } finally {
    await fs.unlink(pskPath).catch(() => {});
  }

  /* Дахин ачаалахад үлдэхийн тулд файлд бичнэ. `wg-quick save` ашиглахгүй:
     тэр нь PostUp/PostDown мөрүүдийг алдах эрсдэлтэй — NAT тэр хоёр мөр
     дээр тогтдог тул алдвал VPN интернэт гаргахаа болино. Тиймээс блокоо
     өөрсдөө нэмнэ, өмнө нь нөөцөлнө. */
  const stamp = new Date().toISOString().replace(/[:.]/g, "").replace("T", "T").slice(0, 15) + "Z";
  await fs.copyFile(CONF, `${CONF}.bak.${stamp}`).catch(() => {});
  const block = `\n# name: ${label}\n[Peer]\nPublicKey = ${pub}\nPresharedKey = ${psk}\nAllowedIPs = ${address}/32\n`;
  await fs.appendFile(CONF, block, { mode: 0o600 });

  const config = [
    "[Interface]",
    `PrivateKey = ${priv}`,
    `Address = ${address}/24`,
    `DNS = ${DNS}`,
    "",
    "[Peer]",
    `PublicKey = ${srvPub}`,
    `PresharedKey = ${psk}`,
    `Endpoint = ${ENDPOINT}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");

  return { publicKey: pub, address, label, config };
}

export async function removePeer(publicKey: string): Promise<void> {
  if (!KEY_RE.test(publicKey)) throw new Error("bad_public_key");
  /* Сервер өөрийгөө устгах ёсгүй. */
  const srvPub = await serverPublicKey();
  if (publicKey === srvPub) throw new Error("refusing_to_remove_server");

  await run("wg", ["set", WG_IF, "peer", publicKey, "remove"]);

  let conf: string;
  try {
    conf = await fs.readFile(CONF, "utf8");
  } catch {
    return; // ажиллаж буй тохиргооноос хассан нь хангалттай
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15) + "Z";
  await fs.copyFile(CONF, `${CONF}.bak.${stamp}`).catch(() => {});

  /* Файлыг [Peer] (эсвэл түүний өмнөх `# name:`) мөр бүр дээр хэсэглэнэ.
     Эхний хэсэг нь [Interface] — PostUp/PostDown тэнд байгаа тул хэзээ ч
     хөндөгдөхгүй. Дараа нь тухайн түлхүүртэй хэсгийг л хаяна. */
  const esc = publicKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyLine = new RegExp(`^PublicKey\\s*=\\s*${esc}\\s*$`, "im");
  const parts = conf.split(/\n(?=\[Peer\]|#\s*name:)/i);
  const kept = parts.filter((part, i) => (i === 0 ? true : !keyLine.test(part)));

  await fs.writeFile(CONF, kept.join("\n"), { mode: 0o600 });
}

export { SERVER_IP, ENDPOINT };
