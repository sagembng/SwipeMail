import Image from "next/image";
import Link from "next/link";
import s from "./Brand.module.css";

export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={s.brand} aria-label="SwipeMail home">
      <Image src="/logo.png" alt="" width={900} height={371} className={s.logo} priority />
      <span>SwipeMail</span>
    </Link>
  );
}
