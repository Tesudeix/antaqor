import { redirect } from "next/navigation";

// ─── Legacy /clan → нэг л төлбөрийн хуудас: /pricing (Wire-first). ───
// Хуучин линкүүд (/clan, /clan?pay=1) бүгд pricing руу очно.
export default function ClanPage() {
  redirect("/pricing");
}
