import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default async function Icon192() {
  const logoData = await readFile(join(process.cwd(), "public", "favicon.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F8F6",
        }}
      >
        <img
          src={logoBase64}
          width={160}
          height={160}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size }
  );
}
