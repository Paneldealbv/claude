import type { Metadata } from "next";
import { getGebruiker } from "@/lib/auth";
import { WachtwoordHerstellenFormulier } from "../formulieren";
import { AuthKop } from "../kop";

export const metadata: Metadata = { title: "Nieuw wachtwoord" };

export default async function WachtwoordHerstellenPagina() {
  const gebruiker = await getGebruiker();
  return (
    <>
      <AuthKop
        titel="Nieuw wachtwoord instellen"
        tekst={<>Voor {gebruiker.email}</>}
      />
      <WachtwoordHerstellenFormulier />
    </>
  );
}
