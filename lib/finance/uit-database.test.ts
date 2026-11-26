import { describe, expect, it } from "vitest";
import { berekenProject } from "./bereken";
import { VANDAAG } from "./testdata";
import { naarInvoer, type DatabaseRijen } from "./uit-database";

describe("naarInvoer (databaserijen → rekenlogica)", () => {
  it("zet een klein project om en rekent het door", () => {
    const rijen: DatabaseRijen = {
      categories: [
        {
          id: "k",
          parent_id: null,
          name: "Keuken",
          sort_order: 1,
          is_closed: false,
        },
      ],
      budget_lines: [
        { id: "b", category_id: "k", amount_incl_cents: 2_400_000 },
      ],
      contracts: [
        { id: "c", title: "Keuken", supplier_id: null, status: "actief" },
      ],
      contract_lines: [
        {
          id: "cl",
          contract_id: "c",
          category_id: "k",
          description: "Keuken",
          amount_incl_cents: 2_635_000,
        },
      ],
      contract_changes: [],
      contract_installments: [
        {
          id: "t",
          contract_id: "c",
          sequence: 1,
          description: "Aanbetaling",
          percentage_bp: 3_000,
          amount_incl_cents: null,
          expected_date: "2026-08-01",
        },
      ],
      cost_documents: [
        {
          id: "d",
          type: "termijnfactuur",
          status: "geboekt",
          supplier_id: null,
          contract_id: "c",
          installment_id: "t",
          document_date: "2026-08-01",
          due_date: "2026-08-15",
        },
      ],
      cost_lines: [
        {
          id: "l",
          cost_document_id: "d",
          category_id: null,
          contract_id: "c",
          contract_line_id: null,
          amount_incl_cents: 790_500,
        },
      ],
      rooms: [{ id: "r", name: "Keuken", sort_order: 1 }],
      room_allocations: [
        {
          room_id: "r",
          cost_line_id: null,
          contract_line_id: "cl",
          share_bp: 10_000,
        },
      ],
      payments: [
        {
          id: "p",
          cost_document_id: "d",
          funding_source_id: "e",
          amount_cents: 790_500,
          paid_on: "2026-08-10",
        },
      ],
      funding_sources: [
        {
          id: "e",
          parent_source_id: null,
          type: "eigen_geld",
          name: "Eigen geld",
          amount_cents: 9_500_000,
        },
      ],
    };
    const r = berekenProject(naarInvoer(rijen), VANDAAG);
    expect(r.cijfers).toMatchObject({
      budget: 2_400_000,
      gecontracteerd: 2_635_000,
      gefactureerd: 790_500,
      betaald: 790_500,
      prognose: 2_635_000,
    });
    expect(r.contracten[0].termijnen[0]).toMatchObject({
      verwachtBedrag: 790_500,
      status: "gefactureerd",
    });
    expect(r.ruimtes[0]).toMatchObject({
      naam: "Keuken",
      vastgelegd: 2_635_000,
    });
    expect(r.financiering.bronnen[0].saldo).toBe(9_500_000 - 790_500);
  });
});
