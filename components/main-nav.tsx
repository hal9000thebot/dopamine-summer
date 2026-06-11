"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navClass(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`) ? undefined : "secondary";
}

export function ActiveNavLink({ children, href }: { children: React.ReactNode; href: string }) {
  const pathname = usePathname();

  return (
    <Link className={navClass(pathname, href)} href={href}>
      {children}
    </Link>
  );
}

export function MainNavLinks({ isAdmin }: { isAdmin: boolean }) {
  return (
    <>
      <ActiveNavLink href="/dashboard">
        Dashboard
      </ActiveNavLink>
      <ActiveNavLink href="/guide">
        Guide
      </ActiveNavLink>
      <ActiveNavLink href="/changelog">
        Changelog
      </ActiveNavLink>
      {isAdmin ? (
        <ActiveNavLink href="/admin">
          Admin
        </ActiveNavLink>
      ) : null}
    </>
  );
}
