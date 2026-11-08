import type { Metadata } from "next";
import { googleConfigured, signIn } from "@/auth";
import { PrefsScope } from "@/lib/prefs-scope";
import Walkthrough from "./Walkthrough";

export const metadata: Metadata = { title: "Interactive walkthrough" };

/** Public, no sign-in. Teaches the gestures on two sample emails, then offers to connect Google. */
export default function WalkthroughPage() {
  async function connectAction() {
    "use server";
    await signIn("google", { redirectTo: "/dashboard" });
  }

  // Without Google keys the button falls back to a link to the login page.
  return (
    <PrefsScope account="guest">
      <Walkthrough connectAction={googleConfigured ? connectAction : undefined} />
    </PrefsScope>
  );
}
