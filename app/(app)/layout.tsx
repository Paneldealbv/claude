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

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [gebruiker, project, projecten] = await Promise.all([
    getGebruiker(),
    getActiefProject(),
    getProjecten(),
  ]);
  const leden = await getLeden(project.id);
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
  };

  return (
    <ShellProvider data={shell}>
      <AddDocumentProvider>
        <Sidebar />
        <div className="lg:pl-64">
          <MobileHeader />
          <main className="pb-tabbar mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
            {children}
          </main>
        </div>
        <MobileTabbar />
      </AddDocumentProvider>
    </ShellProvider>
  );
}
