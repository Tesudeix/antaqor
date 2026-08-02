import { redirect } from "next/navigation";

// Нэгдсэн автоматжуулалт руу — хуучин хуудас татан буугдсан.
export default function LegacyRedirect() {
  redirect("/admin/automation");
}
