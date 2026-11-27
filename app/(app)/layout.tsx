import { AddDocumentProvider } from "@/components/shell/add-document";
import { OfflineMelding } from "@/components/shell/offline-melding";
import { MobileHeader, MobileTabbar } from "@/components/shell/mobile-nav";
import {
  ShellProvider,
  type ShellData,
} from "@/components/shell/shell-context";
import { Sidebar } from "@/components/shell/sidebar";
import {
  getActiefProject,
  getGebruiker,
  getLeden,
  getProjecten,
  initialen,
} from "@/lib/auth";
import { OPEN_VOORSTELLEN } from "@/lib/data/herkenning";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [gebruiker, project, projecten] = await Promise.all([
    getGebruiker(),
    getActiefProject(),
    getProjecten(),
  ]);
  const supabase = await createClient();
  const [leden, nietGeboekt, voorstellen] = await Promise.all([
    getLeden(project.id),
    supabase
      .from("cost_documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .in("status", ["concept", "te_controleren"]),
    supabase
      .from("document_extractions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .in("status", OPEN_VOORSTELLEN),
  ]);
  const teControleren = (nietGeboekt.count ?? 0) + (voorstellen.count ?? 0);
  const ik = leden.find((l) => l.userId === gebruiker.id);
  const mijnNaam = ik?.naam ?? gebruiker.email;

  const shell: ShellData = {
    project: {
      id: project.id,
      naam: project.naam,
      oplevering: project.oplevering,
      rol: project.rol,
    },
    projecten: projecten.map((p) => ({ id: p.id, naam: p.naam })),
    gebruiker: {
      naam: mijnNaam,
      email: gebruiker.email,
      initialen: initialen(mijnNaam),
    },
    leden: leden.map((l) => ({
      naam: l.naam,
      initialen: initialen(l.naam),
      rol: l.rol,
    })),
    badges: teControleren ? { "/te-controleren": teControleren } : {},
  };

  return (
    <ShellProvider data={shell}>
      <AddDocumentProvider>
        <a
          href="#inhoud"
          className="bg-accent text-accent-foreground sr-only rounded-xl px-4 py-2.5 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Naar de inhoud
        </a>
        <OfflineMelding />
        <Sidebar />
        <div className="lg:pl-64 print:pl-0">
          <MobileHeader />
          <main
            id="inhoud"
            tabIndex={-1}
            className="pb-tabbar mx-auto w-full max-w-[1400px] px-4 pt-6 outline-none sm:px-6 lg:px-10 lg:pt-10 lg:pb-12 print:max-w-none print:p-0"
          >
            {children}
          </main>
        </div>
        <MobileTabbar />
      </AddDocumentProvider>
    </ShellProvider>
  );
}
