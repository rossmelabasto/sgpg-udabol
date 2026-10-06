import Link from "next/link";
import { getSessionInfo } from "@/app/actions/auth";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export async function SiteHeader() {
  const session = await getSessionInfo();

  return (
    <header className="bg-institucional sticky top-0 z-40 border-b border-white/10 text-sidebar-foreground shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
          <BrandMark />
          <BrandWordmark />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session && <UserMenu role={session.role} name={session.name} email={session.email} />}
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
    </header>
  );
}
