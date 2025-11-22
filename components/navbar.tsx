"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "../lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/signals", label: "AI Signals" }
];

export function Navbar() {
  const pathname = usePathname();
  const { data } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-semibold text-lg text-primary">
          ApexPulse
        </Link>
        <button
          className="rounded-md border border-white/10 px-3 py-2 text-sm sm:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <nav className={cn("hidden items-center gap-6 sm:flex", open && "flex flex-col gap-2")}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm text-muted-foreground hover:text-foreground",
                pathname === link.href && "text-foreground font-semibold"
              )}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          {data?.user ? (
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className="border-t border-white/5 bg-background/90 px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm text-muted-foreground hover:text-foreground",
                  pathname === link.href && "text-foreground font-semibold"
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {data?.user ? (
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  Sign out
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/login" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
