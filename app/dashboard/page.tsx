import { redirect } from "next/navigation";

// The dashboard became the home page ("Picked for you") and /search.
export default function DashboardPage() {
  redirect("/");
}
