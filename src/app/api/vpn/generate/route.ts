import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import VpnPeer from "@/models/VpnPeer";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const SERVER_PUBLIC_KEY = process.env.WG_SERVER_PUBLIC_KEY || "";
const SERVER_ENDPOINT = process.env.WG_SERVER_ENDPOINT || "";
const WG_SUBNET = "10.66.66";

async function getNextIp(): Promise<string> {
  const peers = await VpnPeer.find({}, { clientIp: 1 }).lean();
  const usedNumbers = new Set(
    peers.map((p) => parseInt(p.clientIp.split(".")[3]))
  );
  // Start from .10, reserve .1 for server, .2-.9 for manual configs
  for (let i = 10; i <= 254; i++) {
    if (!usedNumbers.has(i)) return `${WG_SUBNET}.${i}`;
  }
  throw new Error("No available IPs");
}

async function generateKeys() {
  const { stdout: privateKey } = await execAsync("wg genkey");
  const { stdout: publicKey } = await execAsync(
    `echo "${privateKey.trim()}" | wg pubkey`
  );
  const { stdout: presharedKey } = await execAsync("wg genpsk");
  return {
    privateKey: privateKey.trim(),
    publicKey: publicKey.trim(),
    presharedKey: presharedKey.trim(),
  };
}

async function addPeerToWireGuard(
  publicKey: string,
  presharedKey: string,
  clientIp: string
) {
  // Write preshared key to temp file for wg command
  await execAsync(
    `echo "${presharedKey}" > /tmp/wg_psk_temp && chmod 600 /tmp/wg_psk_temp`
  );
  await execAsync(
    `wg set wg0 peer "${publicKey}" preshared-key /tmp/wg_psk_temp allowed-ips "${clientIp}/32"`
  );
  await execAsync("rm -f /tmp/wg_psk_temp");
  // Save to persistent config
  await execAsync("wg-quick save wg0").catch(() => {});
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    // Parse optional device name
    const body = await req.json().catch(() => ({}));
    const name = (body.name as string) || "device";

    // Check if user already has a peer
    const existing = await VpnPeer.findOne({ userId, active: true });
    if (existing) {
      // Return existing config
      const config = buildClientConfig(
        existing.privateKey,
        existing.clientIp,
        existing.presharedKey
      );
      return NextResponse.json({ config, clientIp: existing.clientIp, name: existing.name });
    }

    // Generate new peer
    const keys = await generateKeys();
    const clientIp = await getNextIp();

    // Add to WireGuard
    await addPeerToWireGuard(keys.publicKey, keys.presharedKey, clientIp);

    // Save to DB
    await VpnPeer.create({
      userId,
      clientIp,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      presharedKey: keys.presharedKey,
      name,
    });

    const config = buildClientConfig(keys.privateKey, clientIp, keys.presharedKey);

    return NextResponse.json({ config, clientIp, name }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: return existing config if user has one
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const peer = await VpnPeer.findOne({ userId, active: true });
    if (!peer) {
      return NextResponse.json({ hasPeer: false });
    }

    const config = buildClientConfig(peer.privateKey, peer.clientIp, peer.presharedKey);
    return NextResponse.json({ hasPeer: true, config, clientIp: peer.clientIp, name: peer.name });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: revoke VPN access
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const peer = await VpnPeer.findOne({ userId, active: true });
    if (!peer) {
      return NextResponse.json({ error: "VPN тохиргоо олдсонгүй" }, { status: 404 });
    }

    // Remove from WireGuard
    await execAsync(`wg set wg0 peer "${peer.publicKey}" remove`).catch(() => {});
    await execAsync("wg-quick save wg0").catch(() => {});

    // Mark inactive
    peer.active = false;
    await peer.save();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildClientConfig(
  privateKey: string,
  clientIp: string,
  presharedKey: string
): string {
  return `[Interface]
PrivateKey = ${privateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${SERVER_PUBLIC_KEY}
PresharedKey = ${presharedKey}
Endpoint = ${SERVER_ENDPOINT}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;
}
