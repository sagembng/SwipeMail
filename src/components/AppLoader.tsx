"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { hideLoader, useLoader } from "./loader-store";
import s from "./AppLoader.module.css";

const LAUNCH_MS = 1100; // how long the logo stays up when the app first opens
const FAILSAFE_MS = 20_000; // never leave the loader up forever if a sign-in is interrupted

/**
 * The full-screen logo loader. It is up:
 *  - when the app first launches (and after coming back from Google's sign-in page, which is a fresh launch),
 *  - from the moment "Continue with Google" or "Sign out" is pressed until the next page has appeared.
 * It starts visible, so the server-rendered page never flashes before it.
 */
export default function AppLoader() {
  const loader = useLoader();
  const pathname = usePathname();
  const [launching, setLaunching] = useState(true);

  // First launch.
  useEffect(() => {
    const t = window.setTimeout(() => setLaunching(false), LAUNCH_MS);
    return () => window.clearTimeout(t);
  }, []);

  // A sign-in or sign-out that moves to another page: take the loader down once the new page is there.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      hideLoader();
    }
  }, [pathname]);

  // Pressing Back from Google's page can restore this page from the browser's cache with the loader still up.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) hideLoader(0);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Safety net.
  useEffect(() => {
    if (!loader.visible) return;
    const t = window.setTimeout(() => hideLoader(0), FAILSAFE_MS);
    return () => window.clearTimeout(t);
  }, [loader.visible]);

  const visible = launching || loader.visible;

  return (
    <div className={s.overlay} data-loader data-hidden={!visible} role="status" aria-live="polite" aria-hidden={!visible}>
      <div className={s.center}>
        <div className={s.logoWrap}>
          <span className={s.glow} aria-hidden="true" />
          <Image src="/logo.png" alt="SwipeMail" width={900} height={371} priority className={s.logo} />
        </div>
        <p className={s.message}>{loader.message ?? " "}</p>
        <span className={s.bar} aria-hidden="true">
          <i />
        </span>
      </div>
    </div>
  );
}
