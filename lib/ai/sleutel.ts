/*
 * De API-sleutel voor de Claude API (ANTHROPIC_API_KEY): schoonmaken wat er
 * per ongeluk is meegeplakt, en een begrijpelijke melding als Anthropic de
 * sleutel weigert. Puur, zodat het te testen is; de omgeving wordt gelezen
 * in herkennen.ts.
 */

/** Zonder meegeplakte spaties, regeleinden, quotes of "ANTHROPIC_API_KEY=". */
export function schoneSleutel(ruw: string | undefined) {
  return (ruw ?? "")
    .trim()
    .replace(/^ANTHROPIC_API_KEY\s*=\s*/i, "")
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, "");
}

/**
 * Melding bij een geweigerde sleutel. Noemt alleen de laatste vier tekens,
 * zodat je kunt zien of de app nog een oude sleutel gebruikt, zonder dat de
 * sleutel zelf zichtbaar wordt.
 */
export function sleutelGeweigerd(sleutel: string) {
  if (!sleutel.startsWith("sk-ant-")) {
    return "In ANTHROPIC_API_KEY staat geen API-sleutel: een sleutel begint met sk-ant-. Plak de sleutel zelf (niet de naam of het id) en deploy opnieuw.";
  }
  if (sleutel.length < 40) {
    return "De API-sleutel in ANTHROPIC_API_KEY is onvolledig. Kopieer hem opnieuw uit de Claude Console en deploy opnieuw.";
  }
  return `De API-sleutel voor de AI (eindigt op …${sleutel.slice(-4)}) wordt geweigerd. Bestaat deze sleutel nog in de Claude Console? Na het wijzigen van de sleutel in Vercel moet je opnieuw deployen.`;
}
