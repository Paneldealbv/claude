import type { Metadata } from "next";
import Link from "next/link";
import { veiligPad } from "@/lib/site-url";
import { InlogFormulier } from "../formulieren";
import { AuthKop } from "../kop";

export const metadata: Metadata = { title: "Inloggen" };

export default async function InloggenPagina({
  searchParams,
}: PageProps<"/inloggen">) {
  const sp = await searchParams;
  const volgende = sp.volgende ? veiligPad(sp.volgende) : undefined;
  const melding =
    sp.fout === "link"
      ? ({
          soort: "fout",
          tekst:
            "Deze link is verlopen of al gebruikt. Log in of vraag een nieuwe link aan.",
        } as const)
      : undefined;

  return (
    <>
      <AuthKop titel="Welkom terug" tekst="Log in om verder te gaan." />
      <InlogFormulier volgende={volgende} melding={melding} />
      <p className="text-muted mt-8 text-center text-sm">
        Nog geen account?{" "}
        <Link
          href={
            volgende
              ? `/registreren?volgende=${encodeURIComponent(volgende)}`
              : "/registreren"
          }
          className="text-accent-ink font-medium hover:underline"
        >
          Account aanmaken
        </Link>
      </p>
    </>
  );
}
