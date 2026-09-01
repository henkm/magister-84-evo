// leesToken haalt het toegangstoken uit de sessionStorage van de Magister-tab.
// Het content script roept hem aan; het paneel krijgt alleen het resultaat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { leesToken } from '../../extension/src/token.js';

const SLEUTEL = 'oidc.user:https://accounts.magister.net:M6-school';

/** Een object dat zich als sessionStorage gedraagt: eigen sleutels plus getItem. */
function opslag(paren) {
  return { ...paren, getItem: (k) => (k in paren ? paren[k] : null) };
}

test('vindt het token onder een oidc.user-sleutel', () => {
  const s = opslag({ [SLEUTEL]: JSON.stringify({ access_token: 'abc' }) });
  assert.equal(leesToken(s), 'abc');
});

test('kijkt alleen naar oidc.user-sleutels', () => {
  const s = opslag({ 'andere.sleutel': JSON.stringify({ access_token: 'abc' }) });
  assert.equal(leesToken(s), null,
    'een willekeurige sleutel met een access_token is niet de aanmelding');
});

test('slaat een onleesbare sleutel over en gaat door naar de volgende', () => {
  const s = opslag({
    'oidc.user:kapot': '{ dit is geen json',
    [SLEUTEL]: JSON.stringify({ access_token: 'abc' }),
  });
  assert.equal(leesToken(s), 'abc',
    'een halve sleutel van een vorige sessie mag de goede niet blokkeren');
});

test('slaat een aanmelding zonder access_token over', () => {
  const s = opslag({
    'oidc.user:leeg': JSON.stringify({ profile: { naam: 'x' } }),
    [SLEUTEL]: JSON.stringify({ access_token: 'abc' }),
  });
  assert.equal(leesToken(s), 'abc');
});

test('geeft null als er niets bruikbaars staat', () => {
  assert.equal(leesToken(opslag({})), null);
  assert.equal(leesToken(null), null, 'geen opslag is geen uitzondering');
});
