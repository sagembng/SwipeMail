import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { PrefsScope } from "@/lib/prefs-scope";
import Dashboard from "./Dashboard";

export const metadata: Metadata = { title: "Inbox" };

// The page depends on the signed-in user's session cookie, so it is rendered per request.
export const instant = false;

function initialsOf(name: string | null | undefined, email: string | null | undefined) {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user || session.error) redirect("/login");

  const { name, email, image } = session.user;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <PrefsScope account={email ?? "guest"}>
      <Dashboard
        account={{ name: name ?? "", email: email ?? "", initials: initialsOf(name, email), image: image ?? null }}
        signOutAction={signOutAction}
      />
    </PrefsScope>
  );
}
