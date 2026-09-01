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

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL(PANEEL);
  const [bestaand] = await chrome.tabs.query({ url });
  if (bestaand) {
    await chrome.tabs.update(bestaand.id, { active: true });
    await chrome.windows.update(bestaand.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
});
