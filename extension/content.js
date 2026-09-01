// Draait op magister.net. Geen import-syntaxis: een content script is geen
// module. De logica staat in src/menu.js en wordt dynamisch geladen, zodat die
// met node --test te testen is zonder browser.
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
