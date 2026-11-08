import s from "./BackgroundGlow.module.css";

/** Three soft colour blobs behind the page. They give the glass something to frost. */
export default function BackgroundGlow() {
  return (
    <div className={s.glow} aria-hidden="true">
      <i className={s.a} />
      <i className={s.b} />
      <i className={s.c} />
    </div>
  );
}
