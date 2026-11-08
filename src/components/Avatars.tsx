"use client";

import { useState } from "react";
import s from "./Avatars.module.css";

interface BaseProps {
  /** Shown while the picture loads, and when there is no picture. */
  initials: string;
  color?: string;
  size?: number;
  className?: string;
}

function Circle({ initials, color, size = 44, className, src, alt }: BaseProps & { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`${s.circle} ${className ?? ""}`} style={{ width: size, height: size, fontSize: size * 0.34, background: color }}>
      <span aria-hidden={!!src && !failed}>{initials}</span>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={s.photo}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth < 2) setFailed(true);
          }}
        />
      )}
    </span>
  );
}

/**
 * The signed-in user's Google profile picture, with initials as the fallback.
 * `account` (the email) goes into the picture's address and into the React key. That way a different account never
 * reuses the browser's cached picture or the "picture failed to load" state of the previous account.
 */
export function UserAvatar({
  initials,
  account,
  size = 36,
  className,
  hasPhoto = true,
}: Omit<BaseProps, "color"> & { account: string; hasPhoto?: boolean }) {
  return (
    <Circle
      key={account}
      initials={initials}
      size={size}
      className={className}
      color="var(--primary)"
      src={hasPhoto ? `/api/avatar/me?u=${encodeURIComponent(account)}` : null}
      alt="Your profile picture"
    />
  );
}

/** A sender's picture (their Gravatar or company logo), with coloured initials as the fallback. */
export function SenderAvatar({ address, name, ...rest }: BaseProps & { address?: string; name: string }) {
  const src = address ? `/api/avatar?email=${encodeURIComponent(address)}` : null;
  return <Circle {...rest} src={src} alt={`${name}'s picture`} />;
}
