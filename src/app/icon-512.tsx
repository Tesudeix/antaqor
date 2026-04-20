import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon512() {
  const logoData = await readFile(join(process.cwd(), "public", "favicon.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F8F6",
        }}
      >
        <img
          src={logoBase64}
          width={440}
          height={440}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size }
  );
}
