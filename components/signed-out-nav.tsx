"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignedOutNav() {
  const pathname = usePathname();

  if (pathname === "/sign-in") {
    return null;
  }

  return <Link href="/sign-in">Sign in</Link>;
}
