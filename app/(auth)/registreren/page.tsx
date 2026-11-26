import type { Metadata } from "next";
import Link from "next/link";
import { veiligPad } from "@/lib/site-url";
import { RegistratieFormulier } from "../formulieren";
import { AuthKop } from "../kop";

export const metadata: Metadata = { title: "Account aanmaken" };

export default async function RegistrerenPagina({
  searchParams,
}: PageProps<"/registreren">) {
  const sp = await searchParams;
  const volgende = sp.volgende ? veiligPad(sp.volgende) : undefined;
  const email = typeof sp.email === "string" ? sp.email : undefined;

  return (
    <>
      <AuthKop
        titel="Account aanmaken"
        tekst="Na het aanmaken ontvang je een mail om je e-mailadres te bevestigen."
      />
      <RegistratieFormulier volgende={volgende} email={email} />
      <p className="text-muted mt-8 text-center text-sm">
        Al een account?{" "}
        <Link
          href={
            volgende
              ? `/inloggen?volgende=${encodeURIComponent(volgende)}`
              : "/inloggen"
          }
          className="text-accent-ink font-medium hover:underline"
        >
          Inloggen
        </Link>
      </p>
    </>
  );
}
