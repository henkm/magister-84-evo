// Draait op magister.net. Geen import-syntaxis: een content script is geen
// module. De logica staat in src/ en wordt dynamisch geladen, zodat die met
// node --test te testen is zonder browser.

// Het paneel vraagt het token hier op in plaats van het zelf uit de tab te
// halen. Dat scheelt de permissie "scripting": dit script draait al op deze
// pagina en mag de sessionStorage van dezelfde origin gewoon lezen.
//
// De luisteraar wordt meteen aangemeld, niet pas na de import. Anders is er
// een gaatje waarin de pagina al staat maar nog niet antwoordt, en dan zou het
// paneel denken dat deze tab geen content script heeft.
chrome.runtime.onMessage.addListener((bericht, afzender, antwoord) => {
  if (!bericht || bericht.type !== 'token') return false;
  import(chrome.runtime.getURL('src/token.js'))
    .then((m) => antwoord({ token: m.leesToken(sessionStorage) }))
    .catch(() => antwoord({ token: null }));
  return true; // het antwoord komt asynchroon
});

(async () => {
  try {
    const menu = await import(chrome.runtime.getURL('src/menu.js'));
    menu.bewaakMenu(document, () => {
      chrome.runtime.sendMessage({ type: 'paneel-openen' });
    });
  } catch (e) {
    // Een Magister-pagina zonder dat menu, of een omgeving waar de import niet
    // mag. Dan hoort de extensie stil te zijn, niet de site te storen.
  }
})();
