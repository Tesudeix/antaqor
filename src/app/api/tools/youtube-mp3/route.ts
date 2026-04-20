import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL шаардлагатай" }, { status: 400 });
    }

    // Validate YouTube URL and extract video ID
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([\w-]+)/;
    const match = url.match(ytRegex);
    if (!match) {
      return NextResponse.json({ error: "YouTube линк буруу байна" }, { status: 400 });
    }

    const videoId = match[5];
    const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    // Get video title from oembed (always works, no API key needed)
    let title = "YouTube Audio";
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || title;
      }
    } catch {
      // ignore
    }

    // Try cobalt API (v10 format)
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
          return NextResponse.json({ title, thumbnail, duration: "", downloadUrl: data.url });
        }
      }
    } catch {
      // cobalt failed
    }

    // Fallback: use y2mate-style API
    try {
      const analyzeRes = await fetch(`https://co.wuk.sh/api/json`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          isAudioOnly: true,
          aFormat: "mp3",
        }),
      });

      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        if (data.url) {
          return NextResponse.json({ title, thumbnail, duration: "", downloadUrl: data.url });
        }
      }
    } catch {
      // fallback also failed
    }

    // Final fallback: use loader.to embed
    try {
      const loaderRes = await fetch(
        `https://ab.cococococ.com/ajax/download.php?copyright=0&format=mp3&url=https://www.youtube.com/watch?v=${videoId}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`
      );
      if (loaderRes.ok) {
        const data = await loaderRes.json();
        if (data.success && data.download_url) {
          return NextResponse.json({ title, thumbnail, duration: "", downloadUrl: data.download_url });
        }
      }
    } catch {
      // all APIs failed
    }

    // If all APIs fail, return a direct link to a web converter
    return NextResponse.json({
      title,
      thumbnail,
      duration: "",
      downloadUrl: `https://www.y2mate.com/youtube-mp3/${videoId}`,
      redirect: true,
    });
  } catch (err) {
    console.error("YouTube MP3 error:", err);
    return NextResponse.json({ error: "Серверийн алдаа. Дахин оролдоно уу." }, { status: 500 });
  }
}
