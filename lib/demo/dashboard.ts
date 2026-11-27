/**
 * Het voorbeeldproject (demo), doorgerekend met dezelfde rekenlogica en
 * dezelfde omzetting als het echte dashboard.
 */
import { dashboardUitResultaat } from "@/lib/dashboard";
import { berekenProject } from "@/lib/finance";
import { DEMO_VANDAAG, demoDocumentInfo, demoInvoer } from "./data";

export type { BudgetRij, MaandPunt, OpenPost } from "@/lib/dashboard";

export function demoDashboard() {
  const resultaat = berekenProject(demoInvoer, { vandaag: DEMO_VANDAAG });
  return {
    resultaat,
    ...dashboardUitResultaat(resultaat, demoDocumentInfo, { metLinks: false }),
  };
}
