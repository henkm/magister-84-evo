// Het toegangstoken van Magister staat in de sessionStorage van de tab zelf,
// onder een sleutel als "oidc.user:https://accounts.magister.net:M6-<tenant>".
// Deze module doet niets anders dan die opzoeken. Het token gaat daarna
// rechtstreeks naar de Authorization-header en nergens anders heen: niet naar
// chrome.storage, niet naar de console, niet in een foutmelding.
//
// Kent geen chrome.* en geen echte browser, zodat node --test hem kan draaien
// met een gewoon object als opslag.

/**
 * @param {{getItem: (sleutel: string) => ?string}} opslag sessionStorage of
 *   iets dat zich zo gedraagt.
 * @returns {?string} het token, of null als er geen bruikbare sleutel is.
 */
export function leesToken(opslag) {
  if (!opslag) return null;
  for (const sleutel of Object.keys(opslag)) {
    if (!sleutel.startsWith('oidc.user:')) continue;
    try {
      const gebruiker = JSON.parse(opslag.getItem(sleutel));
      if (gebruiker && gebruiker.access_token) return gebruiker.access_token;
    } catch (e) { /* geen bruikbare sleutel, volgende */ }
  }
  return null;
}
