import { redirect } from "next/navigation";

// Budjargal removed from the product — route now redirects to the
// Antaqor companion. API + training code left dormant (reversible).
export default function BudjargalRemoved() {
  redirect("/companion");
}
