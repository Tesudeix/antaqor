import type { Metadata } from "next";
import ShopClient from "@/components/shop/ShopClient";

export const metadata: Metadata = {
  title: "ANTAQOR SUPPLY — Shop",
  description: "Antaqor-ийн албан ёсны merch. Минимал цагаан, хар цуглуулга — 3D-ээр эргүүлж үзээд QPay-ээр захиал.",
  alternates: { canonical: "https://antaqor.com/shop" },
  openGraph: { title: "ANTAQOR SUPPLY", description: "Built for creators. Минимал цагаан / хар цуглуулга.", url: "https://antaqor.com/shop", type: "website" },
};

export default function ShopPage() {
  return <ShopClient />;
}
