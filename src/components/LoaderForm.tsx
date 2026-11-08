"use client";

import type { ReactNode } from "react";
import { showLoader } from "./loader-store";

/** A form that runs a server action (sign in, sign out) and puts the logo loader up straight away. */
export default function LoaderForm({
  action,
  message,
  className,
  children,
}: {
  action: () => Promise<void>;
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form action={action} className={className} onSubmit={() => showLoader(message)}>
      {children}
    </form>
  );
}
