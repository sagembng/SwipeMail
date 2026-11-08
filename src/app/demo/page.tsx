import type { Metadata } from "next";
import { PrefsScope } from "@/lib/prefs-scope";
import Dashboard from "../dashboard/Dashboard";

export const metadata: Metadata = { title: "Demo" };

/** Public, no sign-in. Same UI as the dashboard, fed with sample emails. */
export default function DemoPage() {
  return (
    <PrefsScope account="demo">
      <Dashboard demo account={{ name: "Demo user", email: "demo@swipemail.app", initials: "D", image: null }} />
    </PrefsScope>
  );
}
