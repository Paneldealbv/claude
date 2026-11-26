export const THEMA_OPSLAG = "nb-thema";

/**
 * Wordt in <head> uitgevoerd vóór het tekenen en zet het gekozen thema,
 * zodat de pagina niet eerst in het verkeerde thema oplicht.
 */
export const themaScript = `try{var t=localStorage.getItem("${THEMA_OPSLAG}");if(t==="licht")document.documentElement.dataset.theme="light";else if(t==="donker")document.documentElement.dataset.theme="dark";}catch(e){}`;
