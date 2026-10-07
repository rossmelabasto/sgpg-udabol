import Image from "next/image";

/** Escudo oficial de la UDABOL (sobre insignia clara para que contraste en fondos oscuros). */
export function BrandMark({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-gold/40 ${className}`}>
      <Image src="/emblema-udabol.png" alt="" width={418} height={293} className="h-auto w-full" priority />
    </span>
  );
}

export function BrandWordmark({ subtitle = "Repositorio de Proyectos de Grado" }: { subtitle?: string }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-heading text-lg font-semibold tracking-wide">UDABOL</span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-75">{subtitle}</span>
    </span>
  );
}

/** Logo completo (escudo + «UDABOL»); en tema oscuro se usa la versión con letras blancas. */
export function BrandLogo({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <>
      <Image src="/logo-udabol.png" alt="Universidad de Aquino Bolivia (UDABOL)" width={1512} height={300} className={`${className} dark:hidden`} priority />
      <Image src="/logo-udabol-blanco.png" alt="Universidad de Aquino Bolivia (UDABOL)" width={1512} height={300} className={`${className} hidden dark:block`} priority />
    </>
  );
}
