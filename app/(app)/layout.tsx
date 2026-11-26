import { AddDocumentProvider } from "@/components/shell/add-document";
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
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [gebruiker, project, projecten] = await Promise.all([
    getGebruiker(),
    getActiefProject(),
    getProjecten(),
  ]);
  const supabase = await createClient();
  const [leden, nietGeboekt] = await Promise.all([
    getLeden(project.id),
    supabase
      .from("cost_documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .in("status", ["concept", "te_controleren"]),
  ]);
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
    badges: nietGeboekt.count ? { "/te-controleren": nietGeboekt.count } : {},
  };

  return (
    <ShellProvider data={shell}>
      <AddDocumentProvider>
        <Sidebar />
        <div className="lg:pl-64 print:pl-0">
          <MobileHeader />
          <main className="pb-tabbar mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12 print:max-w-none print:p-0">
            {children}
          </main>
        </div>
        <MobileTabbar />
      </AddDocumentProvider>
    </ShellProvider>
  );
}
