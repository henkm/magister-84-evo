// Opent het paneel in een gewoon tabblad.
//
// Waarom geen default_popup: het keuzevenster van Chrome voor Web Serial pakt
// de focus, en een browser-action popup sluit zodra hij de focus verliest.
// Midden in een transfer zou dat de verbinding afbreken. Web Serial werkt
// bovendien niet in een service worker, dus de poort moet hoe dan ook in een
// pagina leven.
//
// Waarom geen eigen popupvenster (chrome.windows.create met type popup):
// gemeten op macOS 26 met Chrome. Daar kwam navigator.serial.requestPort()
// meteen terug met NotFoundError zonder dat er ooit een keuzevenster
// verscheen -- Chrome krijgt de apparaatkiezer in zo'n venster nergens
// aangehaakt. Dezelfde aanroep met hetzelfde filter werkt wel vanuit een
// gewoon tabblad.

const PANEEL = 'panel.html';

// Zoekt een al geopend paneel zonder de permissie "tabs". runtime.getContexts
// kent alleen de eigen pagina's van de extensie, en dat is precies waar we naar
// zoeken; chrome.tabs.query zou over alle tabs van de gebruiker gaan en vraagt
// daarom een permissie die we verder nergens voor nodig hebben.
async function bestaandPaneel(url) {
  if (!chrome.runtime.getContexts) return null;
  const contexten = await chrome.runtime.getContexts({
    contextTypes: ['TAB'], documentUrls: [url],
  });
  return contexten.find((c) => typeof c.tabId === 'number' && c.tabId >= 0)
    || null;
}

async function openPaneel() {
  const url = chrome.runtime.getURL(PANEEL);
  const bestaand = await bestaandPaneel(url);
  if (bestaand) {
    await chrome.tabs.update(bestaand.tabId, { active: true });
    await chrome.windows.update(bestaand.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(openPaneel);

// Het menu-item in de Magister-sidebar (content.js) gaat langs dezelfde weg:
// een tweede pad naar hetzelfde paneel zou een tweede plek zijn waar het fout
// kan gaan.
chrome.runtime.onMessage.addListener((bericht) => {
  if (bericht && bericht.type === 'paneel-openen') openPaneel();
});
