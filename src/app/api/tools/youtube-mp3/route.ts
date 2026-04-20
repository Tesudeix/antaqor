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
    const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    // Try cobalt API v10
    try {
      const cobaltRes = await fetch("https://api.cobalt.tools/", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
        }),
      });

      if (cobaltRes.ok) {
        const data = await cobaltRes.json();
        if (data.url) {
          return NextResponse.json({
            title: data.filename || `YouTube Audio`,
            thumbnail,
            duration: "",
            downloadUrl: data.url,
          });
        }
      }
    } catch {
      // cobalt failed, try fallback
    }

    // Fallback: use yt-dlp style API via a different service
    try {
      const fallbackRes = await fetch(`https://yt-download.org/api/button/mp3/${videoId}`);
      if (fallbackRes.ok) {
        const html = await fallbackRes.text();
        const linkMatch = html.match(/href="(https?:\/\/[^"]+\.mp3[^"]*)"/);
        if (linkMatch) {
          return NextResponse.json({
            title: `YouTube Audio`,
            thumbnail,
            duration: "",
            downloadUrl: linkMatch[1],
          });
        }
      }
    } catch {
      // fallback also failed
    }

    // Final fallback: redirect to a converter site
    return NextResponse.json({
      title: `YouTube Audio`,
      thumbnail,
      duration: "",
      downloadUrl: `https://cnvmp3.com/download.php?id=${videoId}`,
      note: "redirect",
    });
  } catch (err) {
    console.error("YouTube MP3 error:", err);
    return NextResponse.json({ error: "Серверийн алдаа. Дахин оролдоно уу." }, { status: 500 });
  }
}
