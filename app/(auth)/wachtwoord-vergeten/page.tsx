import type { Metadata } from "next";
import Link from "next/link";
import { WachtwoordVergetenFormulier } from "../formulieren";
import { AuthKop } from "../kop";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function WachtwoordVergetenPagina() {
  return (
    <>
      <AuthKop
        titel="Wachtwoord vergeten"
        tekst="Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord in te stellen."
      />
      <WachtwoordVergetenFormulier />
      <p className="text-muted mt-8 text-center text-sm">
        <Link
          href="/inloggen"
          className="text-accent-ink font-medium hover:underline"
        >
          Terug naar inloggen
        </Link>
      </p>
    </>
  );
}
