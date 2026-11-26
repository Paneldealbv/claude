import { Logo } from "@/components/shell/sidebar";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="bg-sidebar relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 size-[520px] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgb(201 164 92 / 0.35) 0%, transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Logo />
          <span className="text-sidebar-foreground text-[15px] font-semibold tracking-tight">
            Nieuwbouw Dashboard
          </span>
        </div>
        <div className="relative">
          <p className="text-sidebar-foreground max-w-md text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
            Elke euro van je nieuwe huis, rustig op één plek.
          </p>
          <ul className="text-sidebar-muted mt-8 space-y-3 text-sm">
            <li>Budget, offertes, contracten en facturen in één overzicht</li>
            <li>Altijd zicht op de prognose en je financiële ruimte</li>
            <li>Samen beheren, ieder met een eigen account</li>
          </ul>
        </div>
        <p className="text-sidebar-muted/70 relative text-xs">
          Je gegevens staan in een beveiligde database in Frankfurt (EU).
        </p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">
            Nieuwbouw Dashboard
          </span>
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
