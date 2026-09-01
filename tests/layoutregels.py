"""Drie regels waar elk scherm aan moet voldoen.

Ze bestaan omdat de suite twee fouten liet passeren die op het apparaat meteen
zichtbaar waren: tekst die half buiten zijn balk viel, en tekstregels die
elkaar overlapten. Een test die per oproep een pixelwaarde nakijkt vangt dat
niet; een regel over het hele beeld wel.
"""


def _beeld(tekeningen, M):
    """Speelt de tekenlijst af en levert de vlakken en de letterblokken."""
    kleur = None
    vlakken = []
    teksten = []
    for c in tekeningen:
        if c[0] == "set_color":
            kleur = (c[1], c[2], c[3])
        elif c[0] == "fill_rect":
            _, x, y, w, h = c
            vlakken.append((x, y, x + w, y + h, kleur))
        elif c[0] == "draw_text":
            _, x, y, s = c
            top = y - M.TEKST_ANKER
            teksten.append((x, top, x + M.ADVANCE * len(s), top + M.TEKST_H,
                            s, kleur, len(vlakken)))
    return vlakken, teksten


def binnen_scherm(tekeningen, M):
    _, teksten = _beeld(tekeningen, M)
    for x, top, x2, bot, s, _, _ in teksten:
        if x < 0 or top < 0 or x2 > M.SCREEN_W or bot > M.SCREEN_H:
            raise AssertionError(
                "tekst %r staat buiten het scherm: (%d,%d)-(%d,%d)"
                % (s, x, top, x2, bot))


def geen_tekstoverlap(tekeningen, M):
    _, teksten = _beeld(tekeningen, M)
    for i in range(len(teksten)):
        ax, atop, ax2, abot, as_, _, _ = teksten[i]
        for j in range(i + 1, len(teksten)):
            bx, btop, bx2, bbot, bs, _, _ = teksten[j]
            if ax < bx2 and bx < ax2 and atop < bbot and btop < abot:
                raise AssertionError(
                    "tekst %r en %r overlappen elkaar: (%d,%d)-(%d,%d) tegen "
                    "(%d,%d)-(%d,%d)"
                    % (as_, bs, ax, atop, ax2, abot, bx, btop, bx2, bbot))


def tekst_op_andere_kleur(tekeningen, M):
    """Het laatste vlak dat een letterblok volledig bedekt moet een andere
    kleur hebben dan de tekst zelf. Dat is precies de "wit op wit"-fout."""
    vlakken, teksten = _beeld(tekeningen, M)
    for x, top, x2, bot, s, kleur, tot in teksten:
        onder = None
        for vx, vy, vx2, vy2, vkleur in vlakken[:tot]:
            if vx <= x and vy <= top and vx2 >= x2 and vy2 >= bot:
                onder = vkleur
        if onder is None:
            raise AssertionError("tekst %r staat op geen enkel vlak" % (s,))
        if onder == kleur:
            raise AssertionError(
                "tekst %r heeft dezelfde kleur %r als het vlak eronder" % (s, onder))
