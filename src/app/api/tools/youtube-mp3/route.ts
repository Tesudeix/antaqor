import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL шаардлагатай" }, { status: 400 });
    }

    // Validate YouTube URL
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([\w-]+)/;
    const match = url.match(ytRegex);
    if (!match) {
      return NextResponse.json({ error: "YouTube линк буруу байна" }, { status: 400 });
    }

    const videoId = match[5];

    // Use a public API approach - cobalt.tools API
    const cobaltRes = await fetch("https://api.cobalt.tools/", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        audioFormat: "mp3",
        isAudioOnly: true,
        aFormat: "mp3",
        filenameStyle: "pretty",
      }),
    });

    if (!cobaltRes.ok) {
      // Fallback: return video info and a redirect to a converter
      return NextResponse.json({
        title: `YouTube Video (${videoId})`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration: "",
        downloadUrl: `https://api.cobalt.tools/api/json`,
        error: "Серверийн алдаа. Дахин оролдоно уу.",
      }, { status: 502 });
    }

    const data = await cobaltRes.json();

    if (data.status === "error") {
      return NextResponse.json({ error: data.text || "Хөрвүүлж чадсангүй" }, { status: 400 });
    }

    return NextResponse.json({
      title: data.filename || `YouTube Video (${videoId})`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      duration: "",
      downloadUrl: data.url || data.audio,
    });
  } catch (err) {
    console.error("YouTube MP3 error:", err);
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 });
  }
}
