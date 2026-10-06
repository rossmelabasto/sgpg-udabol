import { getUserRole, logout } from "@/app/actions/auth"
import { isAdminRole, ROLE_LABELS } from "@/lib/projects"
import { Button } from "@/components/ui/button"
import { GraduationCap, LogOut, ShieldCheck } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export async function SiteHeader() {
  const role = await getUserRole()

  return (
    <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-50 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-6" aria-hidden="true" />
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="text-base font-bold tracking-tight">UDABOL</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-semibold">Proyectos de Grado</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-1.5 text-xs font-semibold shadow-inner">
            {isAdminRole(role) ? <ShieldCheck className="size-3.5 text-primary" /> : null}
            <span className="hidden sm:inline text-sidebar-accent-foreground">{ROLE_LABELS[role]}</span>
            <span className="sm:hidden text-sidebar-accent-foreground">{role === "superadmin" ? "Superadmin" : isAdminRole(role) ? "Admin" : "Invitado"}</span>
          </div>
          <ThemeToggle />
          <form action={logout}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground h-8"
            >
              <LogOut className="size-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
