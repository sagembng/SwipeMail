"use client";

import { useEffect, useRef } from "react";
import type { Mail, TagKind } from "@/lib/mock";
import { SenderAvatar } from "./Avatars";
import { CheckIcon, ExternalIcon, StarIcon } from "./icons";
import s from "./EmailReader.module.css";

const TAG_CLASS: Record<TagKind, string> = { act: "tagAct", promo: "tagPromo", urgent: "tagUrgent", fyi: "tagFyi", plain: "" };

interface Props {
  mail: Mail;
  /** The full text is still being downloaded (the Starred list only has a snippet). */
  loading: boolean;
  /** Link that opens this email in Gmail. Absent in the demo. */
  gmailHref?: string;
  onClose: () => void;
  onUnstar: () => void;
  onDone: () => void;
}

/** A page-sized reader for one email, used from the Starred list. */
export default function EmailReader({ mail, loading, gmailHref, onClose, onUnstar, onDone }: Props) {
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={s.overlay} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <article className={s.sheet} role="dialog" aria-modal="true" aria-labelledby="reader-title">
        <header className={s.head}>
          <SenderAvatar name={mail.name} address={mail.address} initials={mail.initials} color={mail.color} size={44} />
          <div className={s.from}>
            <b>{mail.name}</b>
            <span>
              {mail.address ? `${mail.address} · ` : ""}
              {mail.time}
            </span>
          </div>
          <button ref={closeBtn} type="button" className={s.close} onClick={onClose} aria-label="Close email">
            ×
          </button>
        </header>

        <div className={s.scroll}>
          <div className={s.tags}>
            {mail.tags.map((t) => (
              <span key={t.label} className={`tag ${TAG_CLASS[t.kind]}`}>
                {t.kind !== "plain" && <i />}
                {t.label}
              </span>
            ))}
          </div>
          <h2 id="reader-title">{mail.subject}</h2>
          {!!mail.facts?.length && (
            <ul className={s.facts} aria-label="Key details">
              {mail.facts.map((f) => (
                <li key={f.label} className={f.tone === "urgent" ? s.urgent : undefined}>
                  {f.label}
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <div className={s.loading} role="status">
              <span className={s.spinner} aria-hidden="true" />
              Loading the full email…
            </div>
          ) : mail.html ? (
            // Sanitised on the server (allow-listed tags, no remote images, no scripts).
            <div className={s.rich} dangerouslySetInnerHTML={{ __html: mail.html }} />
          ) : (
            <div className={s.plain}>
              {mail.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {!loading && !!mail.hiddenImages && (
            <small className={s.note}>
              {mail.hiddenImages} {mail.hiddenImages === 1 ? "image" : "images"} hidden to protect your privacy
            </small>
          )}
        </div>

        <footer className={s.foot}>
          <button type="button" className="btn" onClick={onUnstar}>
            <StarIcon className={s.starIcon} /> Unstar
          </button>
          <button type="button" className="btn" onClick={onDone}>
            <CheckIcon /> Mark read
          </button>
          {gmailHref && (
            <a className="btn btnPrimary" href={gmailHref} target="_blank" rel="noopener noreferrer">
              Open in Gmail <ExternalIcon />
            </a>
          )}
        </footer>
      </article>
    </div>
  );
}
