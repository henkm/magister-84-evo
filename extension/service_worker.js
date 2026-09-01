// Opent het paneel in een eigen venster.
//
// Waarom geen default_popup: het keuzevenster van Chrome voor Web Serial
// pakt de focus, en een browser-action popup sluit zodra hij de focus
// verliest. Midden in een transfer zou dat de verbinding afbreken.
// Web Serial werkt bovendien niet in een service worker, dus de poort moet
// hoe dan ook in een pagina leven.

const PANEEL = 'panel.html';

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL(PANEEL);
  for (const venster of await chrome.windows.getAll({ populate: true })) {
    for (const tab of venster.tabs || []) {
      if (tab.url === url) {
        await chrome.windows.update(venster.id, { focused: true });
        return;
      }
    }
  }
  await chrome.windows.create({ url, type: 'popup', width: 460, height: 700 });
});
