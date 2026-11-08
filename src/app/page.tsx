import { redirect } from "next/navigation";

export const instant = false;

export default function Home() {
  // The proxy forwards signed-in users from /login to /dashboard.
  redirect("/login");
}
