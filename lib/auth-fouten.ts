/** Supabase-foutcodes vertaald naar begrijpelijk Nederlands. */
export function vertaalAuthFout(fout: {
  code?: string;
  message?: string;
}): string {
  switch (fout.code) {
    case "invalid_credentials":
      return "E-mailadres of wachtwoord klopt niet.";
    case "email_not_confirmed":
      return "Bevestig eerst je e-mailadres via de link in je mail.";
    case "weak_password":
      return "Kies een sterker wachtwoord (minimaal 10 tekens, niet te voorspelbaar).";
    case "same_password":
      return "Het nieuwe wachtwoord moet anders zijn dan het oude.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Te veel pogingen achter elkaar. Probeer het over een paar minuten opnieuw.";
    case "user_already_exists":
    case "email_exists":
      return "Er bestaat al een account met dit e-mailadres. Log in of herstel je wachtwoord.";
    case "otp_expired":
      return "Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.";
    case "signup_disabled":
      return "Registreren is op dit moment uitgeschakeld.";
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}
