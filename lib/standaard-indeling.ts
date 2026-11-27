/**
 * Standaardindeling voor een nieuwbouwwoning. Een startpunt: alles is daarna
 * te hernoemen, aan te vullen of te verwijderen.
 */
export const STANDAARD_CATEGORIEEN: { naam: string; kinderen: string[] }[] = [
  { naam: "Woning", kinderen: ["Koop-/aanneemsom", "Meerwerk aannemer"] },
  {
    naam: "Afbouw",
    kinderen: [
      "Keuken",
      "Badkamer & toilet",
      "Vloeren",
      "Wanden & plafonds",
      "Verlichting & elektra",
    ],
  },
  { naam: "Buiten", kinderen: ["Tuin & bestrating", "Schuur & schutting"] },
  {
    naam: "Inrichting",
    kinderen: ["Raamdecoratie", "Meubels", "Witgoed & apparatuur"],
  },
  {
    naam: "Bijkomende kosten",
    kinderen: [
      "Notaris & hypotheek",
      "Bouwrente",
      "Opleveringskeuring",
      "Verhuizing",
      "Onvoorzien",
    ],
  },
];

export const STANDAARD_RUIMTES: { naam: string; verdieping: string }[] = [
  { naam: "Hal", verdieping: "Begane grond" },
  { naam: "Toilet", verdieping: "Begane grond" },
  { naam: "Woonkamer", verdieping: "Begane grond" },
  { naam: "Keuken", verdieping: "Begane grond" },
  { naam: "Bijkeuken", verdieping: "Begane grond" },
  { naam: "Overloop", verdieping: "Eerste verdieping" },
  { naam: "Slaapkamer 1", verdieping: "Eerste verdieping" },
  { naam: "Slaapkamer 2", verdieping: "Eerste verdieping" },
  { naam: "Slaapkamer 3", verdieping: "Eerste verdieping" },
  { naam: "Badkamer", verdieping: "Eerste verdieping" },
  { naam: "Zolder", verdieping: "Tweede verdieping" },
  { naam: "Tuin", verdieping: "Buiten" },
];
