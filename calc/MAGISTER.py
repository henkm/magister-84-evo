"""Magister op de TI-84 Evo-T. Eén bestand, want de Evo kent geen packages."""

try:
    import ti_draw as D
    from ti_system import wait_key
except ImportError:      # op de Mac tijdens tests
    D = None
    wait_key = None

# --- gemeten op het apparaat, niet aangenomen ---
ADVANCE = 10
TEKST_H = 16        # hoogte van het letterblok
TEKST_ANKER = 18    # draw_text(x, y) zet het blok op [y-18, y-3]
LINE = 16           # kleinste regelafstand zonder overlap
SCREEN_W = 319
SCREEN_H = 209
RIGHT = 313
MAX_TEKENS = 32     # gemeten: het 32e teken is nog volledig zichtbaar op 319 px breedte

# --- palet ---
BLAUW = (11, 107, 181)
AZUUR = (30, 150, 239)
BAND = (233, 244, 253)
SELECTIE = (214, 233, 250)
PAGINA = (244, 249, 254)
WIT = (255, 255, 255)
DONKER = (16, 49, 79)
GEDEMPT = (91, 123, 152)
ORANJE = (245, 130, 11)


def text_width(s):
    return len(s) * ADVANCE


def fits(s, px):
    return text_width(s) <= px


def right_x(s):
    return RIGHT - text_width(s)


def budget_naast(links_tekst):
    """Ruimte voor een rechts uitgelijnde tekst naast `links_tekst` op x=6,
    met 8 px lucht ertussen.

    De spiegeling van hoe toon_cijfers() het titelbudget al aan `rechts`
    ontleent (`right_x(rechts) - 8 - 6`): hier is het de rechtertekst die
    zijn ruimte aan de vaste linkertekst ontleent, net zoals de vaknaam zijn
    budget van het gemiddelde krijgt en de docent van de chip.
    """
    return right_x(links_tekst) - 8 - 6


def truncate(s, px):
    # If budget cannot hold even one character, return empty string
    if px < ADVANCE:
        return ""
    if fits(s, px):
        return s
    ruimte = px - ADVANCE          # één teken voor de punt
    woorden = s.split(" ")
    uit = ""
    for w in woorden:
        kandidaat = w if not uit else uit + " " + w
        # Include word if text + dot fits within px
        if text_width(kandidaat) + ADVANCE > px:
            break
        uit = kandidaat
    if not uit:
        uit = s[:max(0, ruimte // ADVANCE)]
    return uit + "."


def wrap(s, px):
    # If budget cannot hold even one character, return empty list
    if px < ADVANCE:
        return []

    regels, huidig = [], ""
    for w in s.split(" "):
        kandidaat = w if not huidig else huidig + " " + w
        if fits(kandidaat, px):
            huidig = kandidaat
        else:
            if huidig:
                regels.append(huidig)
            # Hard-break words that don't fit on their own line
            while w:
                if fits(w, px):
                    huidig = w
                    break
                else:
                    # Fill a line with as many characters as fit
                    chars_per_line = px // ADVANCE
                    regel = w[:chars_per_line]
                    regels.append(regel)
                    w = w[chars_per_line:]
            else:
                # If w became empty after the loop (which shouldn't happen with while w),
                # reset huidig
                if not w:
                    huidig = ""
    if huidig:
        regels.append(huidig)
    return regels


# --- veldconstanten voor DAGEN[i][3] ---
L_SOORT, L_BEGIN, L_EIND, L_UUR, L_VAK, L_LOKAAL, L_DOCENT, \
    L_STATUS, L_CHIP, L_TEKST, L_OMS = range(11)

try:
    from MAGDATA import (GESYNCT, GESYNCT_UREN, LEERLING, PERIODE,
                         DAGEN, VAKKEN)
    _DATA_FOUT = ""
except Exception as e:       # ontbrekend of halverwege afgebroken
    GESYNCT, GESYNCT_UREN, LEERLING, PERIODE = "", 0, "", ""
    DAGEN, VAKKEN = [], []
    _DATA_FOUT = str(e)


def data_ok():
    return not _DATA_FOUT and len(DAGEN) > 0


def dag_index(datum):
    for i in range(len(DAGEN)):
        if DAGEN[i][0] == datum:
            return i
    return 0


# --- tekenlaag: het vaste raster ---

def kleur(rgb):
    D.set_color(rgb[0], rgb[1], rgb[2])


def vlak(x, y, w, h, rgb):
    kleur(rgb)
    D.fill_rect(x, y, w, h)


def tekst(x, top, s, rgb):
    """`top` is de bovenkant van het letterblok, niet de ruwe draw_text-y.

    Op het apparaat gemeten: draw_text(x, y) zet het blok op [y-18, y-3]. De
    hele app rekent met de bovenkant, want dat is wat je tegen een balk aan
    uitlijnt.
    """
    kleur(rgb)
    D.draw_text(x, top + TEKST_ANKER, s)


def rand(x, y, w, h, rgb):
    kleur(rgb)
    D.draw_rect(x, y, w, h)


def kop(titel, rechts=""):
    vlak(0, 0, 319, 22, BLAUW)
    tekst(6, 3, titel, WIT)
    if rechts:
        tekst(right_x(rechts), 3, rechts, WIT)


def contextbalk(links, rechts="", verouderd=False):
    vlak(0, 22, 319, 17, WIT)
    if links:
        tekst(6, 23, links, BLAUW)
    # Deze tak is voorlopig dood: de generator schrijft GESYNCT_UREN altijd als
    # 0, want het veld weglaten breekt de import (en dus elk scherm), en een
    # datum bewaren helpt niet op een apparaat zonder klok.
    if verouderd:
        vlak(169, 26, 6, 6, ORANJE)
    if rechts:
        x = 181 if verouderd else right_x(rechts)
        tekst(x, 23, rechts, GEDEMPT)
    vlak(0, 39, 319, 1, AZUUR)


def voetbalk(links, rechts=""):
    vlak(0, 192, 319, 17, BLAUW)
    tekst(6, 193, links, WIT)
    if rechts:
        tekst(257, 193, rechts, WIT)


SCROLL_X = 315
SCROLL_Y = 42
SCROLL_H = 150


def scrollbar(eerste, zichtbaar, totaal):
    if totaal <= zichtbaar:
        return
    eerste = max(0, min(eerste, totaal - zichtbaar))
    vlak(SCROLL_X, SCROLL_Y, 4, SCROLL_H, BAND)
    hoogte = max(8, SCROLL_H * zichtbaar // totaal)
    top = SCROLL_Y + (SCROLL_H - hoogte) * eerste // (totaal - zichtbaar)
    vlak(SCROLL_X, top, 4, hoogte, AZUUR)


# --- tekenlaag: de lesregel ---

TIJD_X = 6
BADGE_X = 60
# 54 en niet 36: uurLabel in de generator maakt van een dubbeluur
# "${van}-${tot}", dus "10-11" (5 tekens, 50 px) is een echt label. In een
# badge van 36 px liep dat 7 px links en 7 px rechts naar buiten - links tot
# over de begintijd heen, rechts alleen maar over de band, waar witte tekst
# onzichtbaar is. De badge wordt daarom gemaakt op wat de data kan bevatten:
# vijf tekens plus 4 px lucht.
BADGE_W = 54
BADGE_H = 20
# Binnenmaat van de badge: hiernaar wordt het label ingekort voordat het
# gecentreerd wordt. Een vak met een vaste maat dat zijn eigen inhoud niet
# begrenst, begrenst niets - dan schuift een te lang label er gewoon aan
# weerszijden uit.
BADGE_TEKST_W = BADGE_W - 4
TEKST_X = BADGE_X + BADGE_W + 4         # 118
DETAIL_BADGE_X = 10
DETAIL_TEKST_X = DETAIL_BADGE_X + BADGE_W + 4   # 68
CHIP_H = 20
RIJ_H = 36

CHIP_KLEUR = {
    "HW": BLAUW,
    "TOETS": ORANJE,
    "GEWIJZIGD": ORANJE,
    "VERVALT": GEDEMPT,
}


def chip_breedte(label):
    return text_width(label) + 8


def _lesregel_kleuren(status):
    if status == "vervallen":
        return WIT, GEDEMPT, GEDEMPT, GEDEMPT
    if status == "gewijzigd":
        return BAND, ORANJE, BLAUW, DONKER
    return BAND, AZUUR, BLAUW, DONKER


def lesregel(y, rij, geselecteerd=False):
    band, accent, badge, voorgrond = _lesregel_kleuren(rij[L_STATUS])
    if geselecteerd:
        band = SELECTIE
    vlak(0, y, 319, RIJ_H, band)
    vlak(0, y, 4, RIJ_H, accent)

    tekst(TIJD_X, y + 2, rij[L_BEGIN], GEDEMPT)
    tekst(TIJD_X, y + 18, rij[L_EIND], GEDEMPT)

    vlak(BADGE_X, y + 2, BADGE_W, BADGE_H, badge)
    uur = truncate(rij[L_UUR], BADGE_TEKST_W)
    tekst(BADGE_X + (BADGE_W - text_width(uur)) // 2, y + 4, uur, WIT)

    chip = rij[L_CHIP]
    if chip:
        beschikbaar = RIGHT - chip_breedte(chip) - 8 - TEKST_X
    else:
        beschikbaar = RIGHT - TEKST_X

    # De kolom is voor het hele blok (vak + lokaal), niet alleen het vak: het
    # lokaal wint als de ruimte krap is, want dat is wat je in de gang nodig
    # hebt. Past het vak dan niet eens voor één teken, dan vervalt het lokaal.
    lokaal = ("- " + rij[L_LOKAAL]) if rij[L_LOKAAL] else ""
    reserve = text_width(lokaal) + ADVANCE if lokaal else 0
    vak_ruimte = beschikbaar - reserve
    if lokaal and vak_ruimte < ADVANCE:
        lokaal = ""
        vak_ruimte = beschikbaar

    vak = truncate(rij[L_VAK], vak_ruimte)
    tekst(TEKST_X, y + 2, vak, voorgrond)
    breedte = text_width(vak)
    if lokaal:
        tekst(TEKST_X + breedte + ADVANCE, y + 2, lokaal, GEDEMPT)
        breedte += ADVANCE + text_width(lokaal)
    # De docent deelt zijn regel met de chip als die er is, net als het vak
    # hierboven: bij deze lettermaat is de chip (20 px hoog, vanaf y+8) hoog
    # genoeg om in de band van de docentregel (vanaf y+18) te reiken, dus die
    # twee mogen elkaar niet raken. toon_lesdetail() doet dit al zo.
    docent = truncate(rij[L_DOCENT], beschikbaar)
    tekst(TEKST_X, y + 18, docent, GEDEMPT)

    if rij[L_STATUS] == "vervallen":
        vlak(TEKST_X, y + 10, breedte, 1, GEDEMPT)

    if chip:
        b = chip_breedte(chip)
        vlak(RIGHT - b, y + 8, b, CHIP_H, CHIP_KLEUR[chip])
        tekst(RIGHT - b + 4, y + 10, chip, WIT)

    if geselecteerd:
        rand(0, y, 317, 34, BLAUW)


def gatregel(y, rij):
    label = "tussenuur %s-%s" % (rij[L_BEGIN], rij[L_EIND])
    tekst(80, y + 10, label, GEDEMPT)
    vlak(8, y + 18, 64, 1, GEDEMPT)
    # De rechterlijn begon op een vaste x=256 en liep daarmee dwars door het
    # label heen; nu begint hij pas waar het label eindigt.
    start = 80 + text_width(label) + 8
    if start < 311:
        vlak(start, y + 18, 311 - start, 1, GEDEMPT)


# --- tekenlaag: het roosterscherm ---

RIJ_PITCH = 38
LIJST_Y = 42
ZICHTBAAR = 4
CIJFER_X = 269
CIJFER_W = 44
CIJFER_TEKST_W = CIJFER_W - 4   # binnenmaat; "10,0" (40 px) past precies


def is_onvoldoende(cijfer):
    """Waar bij een cijfer onder de 5,5. Niet-getallen zijn nooit onvoldoende.

    Let op: dit moet numeriek, niet als tekst. Bij een tekstvergelijking is
    "10,0" kleiner dan "5,5" en zou een tien rood kleuren.
    """
    if not cijfer:
        return False
    try:
        return float(cijfer.replace(",", ".")) < 5.5
    except ValueError:
        return False


MED_X = 24
MED_Y = 96
MED_W = 271
MED_H = 40
MED_TEKST_X = 40
# Tot de rechterrand van de kaart: 255 px, oftewel 25 tekens. Geen van beide
# regels had een budget, en "volgende lesdag: " + de dagkop komt daar dicht
# tegenaan. Wie hier een regel bij zet, telt hem eerst na tegen deze maat.
MED_TEKST_W = MED_X + MED_W - MED_TEKST_X
# Verticaal gecentreerd: 40 px kaart om 32 px tekst is 4 boven en 4 onder.
# Het stond op 102/118 - 6 boven en 2 onder - als enige blok in de app dat
# zijn tekst niet in zijn eigen kaart centreerde.
MED_TEKST_Y = MED_Y + (MED_H - 2 * TEKST_H) // 2        # 100


def mededeling(regel1, regel2=""):
    vlak(MED_X, MED_Y, MED_W, MED_H, BAND)
    vlak(MED_X, MED_Y, 4, MED_H, AZUUR)
    tekst(MED_TEKST_X, MED_TEKST_Y, truncate(regel1, MED_TEKST_W), DONKER)
    if regel2:
        tekst(MED_TEKST_X, MED_TEKST_Y + LINE,
              truncate(regel2, MED_TEKST_W), GEDEMPT)


def _volgende_lesdag(i):
    for j in range(i + 1, len(DAGEN)):
        if DAGEN[j][3]:
            return DAGEN[j][1]
    return ""


def toon_dag(i, selectie=0, scroll=0):
    datum, kop_datum, bijschrift, rijen = DAGEN[i]
    lessen = [r for r in rijen if r[L_SOORT] == "les"]
    vandaag = bijschrift == "vandaag"
    vlak(0, 0, 319, 209, PAGINA)
    if vandaag:
        kop("VANDAAG", kop_datum)
        # De leerlingnaam erbij: het is het eerste scherm na een sync, dus de
        # plek waar data van het verkeerde kind meteen zou opvallen. Het
        # budget wordt van GESYNCT rechts afgeleid (die staat op 181 als de
        # data verouderd is, anders rechts uitgelijnd); past de naam niet,
        # dan valt de balk terug op kale "N lessen" in plaats van een
        # afgekapte naam met een punt erachter.
        verouderd = GESYNCT_UREN >= 24
        rechts_x = 181 if verouderd else right_x(GESYNCT)
        telling = "%d lessen" % len(lessen)
        naam_en_telling = "%s - %s" % (LEERLING, telling)
        links = (naam_en_telling if fits(naam_en_telling, rechts_x - 8 - 6)
                else telling)
        contextbalk(links, GESYNCT, verouderd)
    else:
        kop("ROOSTER", "< " + kop_datum + " >")
        contextbalk(bijschrift, GESYNCT, GESYNCT_UREN >= 24)

    if not rijen:
        volgende = _volgende_lesdag(i)
        mededeling("geen lessen op deze dag",
                   "volgende lesdag: " + volgende if volgende else "")
        voetbalk("<> dag  CLR vandaag  2 cijfers")
        return

    # scrollbar() clamps zijn eigen argumenten, maar dat beschermt alleen de
    # duimpositie. Zonder deze clamp scrollt de lijst zelf voorbij het einde
    # en blijft er lege ruimte over onder in het scherm.
    scroll = max(0, min(scroll, max(0, len(rijen) - ZICHTBAAR)))
    zichtbaar = rijen[scroll:scroll + ZICHTBAAR]
    for n in range(len(zichtbaar)):
        y = LIJST_Y + n * RIJ_PITCH
        rij = zichtbaar[n]
        if rij[L_SOORT] == "gat":
            gatregel(y, rij)
        else:
            lesregel(y, rij, geselecteerd=(scroll + n == selectie))

    scrollbar(scroll, ZICHTBAAR, len(rijen))
    if vandaag:
        # "^v kies  ENTER open  <> dag" (27 tekens) botst met "2 cijf" op
        # vaste x=257: het linkerdeel liep tot x=276. Zonder "open" past het
        # ruim (tot x=226) en blijft de betekenis intact, zoals het
        # vakkenscherm ook al doet ("^v kies  ENTER cijfers").
        voetbalk("^v kies  ENTER  <> dag", "2 cijf")
    else:
        voetbalk("<> dag  ENTER open  CLR vandaag")


# --- tekenlaag: lesdetail, vakkenlijst en cijfers ---

def toon_lesdetail(dag_i, rij_i, scroll=0):
    rijen = DAGEN[dag_i][3]
    rij = rijen[rij_i]
    vlak(0, 0, 319, 209, PAGINA)
    kop("LESUUR " + rij[L_UUR], DAGEN[dag_i][1])

    _, accent, badge, voorgrond = _lesregel_kleuren(rij[L_STATUS])
    vlak(0, 22, 319, 54, BAND)
    vlak(0, 22, 4, 54, accent)
    vlak(DETAIL_BADGE_X, 24, BADGE_W, BADGE_H, badge)
    uur = truncate(rij[L_UUR], BADGE_TEKST_W)
    tekst(DETAIL_BADGE_X + (BADGE_W - text_width(uur)) // 2, 26, uur, WIT)

    chip = rij[L_CHIP]
    chip_b = chip_breedte(chip) if chip else 0

    # De tijd staat rechts uitgelijnd in plaats van op een vaste x: "hh:mm-
    # hh:mm" is altijd 110px breed, en op een vaste x=225 loopt dat voorbij
    # de rechterrand (225+110=335 > 319). De vaknaam krijgt zijn budget pas
    # nadat de tijd-positie bekend is, zodat de twee elkaar nooit raken.
    tijd = rij[L_BEGIN] + "-" + rij[L_EIND]
    tijd_x = right_x(tijd)
    kolom = DETAIL_TEKST_X
    tekst(kolom, 26, truncate(rij[L_VAK], tijd_x - 8 - kolom), voorgrond)
    tekst(kolom, 42, truncate("lokaal " + rij[L_LOKAAL], RIGHT - kolom),
          GEDEMPT)
    # Idem voor de docent: die deelt zijn regel met de chip als die er is.
    docent_breedte = (RIGHT - chip_b - 8 - kolom) if chip else (RIGHT - kolom)
    tekst(kolom, 58, truncate(rij[L_DOCENT], docent_breedte), GEDEMPT)
    tekst(tijd_x, 26, tijd, GEDEMPT)
    if chip:
        vlak(RIGHT - chip_b, 56, chip_b, CHIP_H, CHIP_KLEUR[chip])
        tekst(RIGHT - chip_b + 4, 58, chip, WIT)

    if rij[L_TEKST]:
        label = "toets" if chip == "TOETS" else "huiswerk"
        vlak(0, 76, 319, 17, WIT)
        tekst(6, 77, label, BLAUW)
        vlak(0, 93, 319, 1, AZUUR)
        # De omschrijving zit op een vast anker (160/176) zodat hij niet
        # meebeweegt met de lengte van het huiswerk. Van 96 tot 191 passen
        # precies zes regels van 16 px (96, 112, 128, 144, 160, 176); zonder
        # omschrijving mag het lichaam alle zes gebruiken, met omschrijving
        # blijven de laatste twee (160 en 176) daarvoor gereserveerd en
        # blijft het lichaam tot vier regels. Is er meer, dan komt dat niet
        # op een anker dat de omschrijving zou overschrijven, maar als
        # "v meer" op de sectiebalk zelf (y=77), die nooit door iets anders
        # bezet wordt.
        max_regels = 4 if rij[L_OMS] else 6
        alle_regels = wrap(rij[L_TEKST], 307)
        scroll = max(0, min(scroll, max(0, len(alle_regels) - max_regels)))
        regels = alle_regels[scroll:scroll + max_regels]
        for n in range(len(regels)):
            tekst(6, 96 + 16 * n, regels[n], DONKER)
        rest = len(alle_regels) - scroll - max_regels
        if rest > 0:
            tekst(right_x("v meer"), 77, "v meer", GEDEMPT)
        if rij[L_OMS]:
            tekst(6, 160, "omschrijving", GEDEMPT)
            tekst(6, 176, truncate(rij[L_OMS], 307), GEDEMPT)
    elif rij[L_OMS]:
        tekst(6, 96, truncate(rij[L_OMS], 307), GEDEMPT)
    else:
        tekst(6, 96, "geen huiswerk of toets", GEDEMPT)

    voetbalk("<> les  CLEAR terug")


def toon_vakken(selectie=0, scroll=0):
    vlak(0, 0, 319, 209, PAGINA)
    if not VAKKEN:
        # PERIODE krijgt zijn budget van "VAKKEN" zelf: zonder dat liep een
        # lange periodenaam (geen P-vorm) van het scherm en over de titel
        # heen; vijf perioden ("P1 · P2 · P3 · P4 · P5") botsten ermee.
        kop("VAKKEN", truncate(PERIODE, budget_naast("VAKKEN")))
        # "gemiddelde per vak" (19 tekens, tot x=196) botste met de rechts
        # uitgelijnde syncstatus ("gesynct 07:41" begint op x=183). Het
        # bestaande "gem"-label van het cijferscherm dekt dezelfde lading in
        # 12 tekens.
        contextbalk("gem. per vak", GESYNCT, GESYNCT_UREN >= 24)
        # Zonder periode: kop() zet die hierboven al rechtsboven neer, en
        # "nog geen cijfers in P1 · P2" is 27 tekens in een blok van 25 --
        # dan kapt truncate() de tweede periode eraf en blijft er een losse
        # punt achter. Beide regels zijn nu 16 tekens en kappen nooit.
        mededeling("nog geen cijfers", "dit is geen fout")
        voetbalk("1 rooster  CLEAR terug")
        return

    # De rijen worden vóór kop()/contextbalk() getekend. Puur cosmetisch
    # maakt de volgorde niets uit (de kopband beslaat y=0-39, de rijen
    # beginnen bij y=42, dus niets overlapt); maar kop() tekent zelf een band
    # van 319x22 op y=0 - exact dezelfde afmeting als een vakregel. Zou kop()
    # eerst komen, dan is die band het eerste 319x22-vlak in de tekenlijst en
    # schuift dat de rij-y's in een test die op (breedte, hoogte) filtert.
    #
    # Zes rijen (niet ZICHTBAAR=5): het ontwerp wil zes rijen capaciteit.
    # Bij pitch 24 vanaf y=42 eindigt rij zes op y=184 - geen ruimte meer
    # voor een "meer"-onderschrift naast de voetbalk (192), dus die vervalt
    # ten gunste van de scrollbar die de andere twee lijstschermen ook al
    # gebruiken.
    scroll = max(0, min(scroll, max(0, len(VAKKEN) - 6)))
    zichtbaar = VAKKEN[scroll:scroll + 6]
    for n in range(len(zichtbaar)):
        y = LIJST_Y + n * 24
        naam, gem, _ = zichtbaar[n]
        onvoldoende = is_onvoldoende(gem)
        accent = ORANJE if onvoldoende else (GEDEMPT if not gem else AZUUR)
        vlak(0, y, 319, 22, SELECTIE if scroll + n == selectie else BAND)
        vlak(0, y, 4, 22, accent)
        # De vaknaam deelt zijn regel met het (rechts uitgelijnde) gemiddelde
        # of met "geen"; het budget wordt van die kolom afgeleid zodat de
        # twee elkaar nooit raken, in plaats van een vaste breedte te gokken.
        kolom = right_x(gem) if gem else 265
        tekst(14, y + 3, truncate(naam, kolom - 8 - 14), DONKER)
        if gem:
            tekst(kolom, y + 3, gem, ORANJE if onvoldoende else DONKER)
        else:
            tekst(kolom, y + 3, "geen", GEDEMPT)
        if scroll + n == selectie:
            rand(0, y, 317, 20, BLAUW)

    kop("VAKKEN", truncate(PERIODE, budget_naast("VAKKEN")))
    contextbalk("gem. per vak", GESYNCT, GESYNCT_UREN >= 24)

    scrollbar(scroll, 6, len(VAKKEN))
    voetbalk("^v kies  ENTER cijfers", "1 rstr")


def toon_cijfers(vak_i, scroll=0):
    naam, gem, cijfers = VAKKEN[vak_i]
    vlak(0, 0, 319, 209, PAGINA)
    # Ook hier: het titelbudget hangt af van hoeveel ruimte "gem ..." rechts
    # nodig heeft, in plaats van een vaste 240px die bij een lang, spatieloos
    # vaknaam over de rechts uitgelijnde tekst heen kan lopen.
    rechts = "gem " + (gem if gem else "-")
    titel_breedte = right_x(rechts) - 8 - 6
    kop(truncate(naam, titel_breedte).upper(), rechts)
    # PERIODE stond hier zonder budget rechts uitgelijnd: bij vijf perioden
    # ("P1 · P2 · P3 · P4 · P5", 22 tekens) botste dat met "N cijfers"
    # links. Het budget wordt, net als bij de vaknaam en de docent
    # elders, van die buurtekst afgeleid.
    links = "%d cijfers" % len(cijfers)
    contextbalk(links, truncate(PERIODE, budget_naast(links)))

    scroll = max(0, min(scroll, max(0, len(cijfers) - ZICHTBAAR)))
    zichtbaar = cijfers[scroll:scroll + ZICHTBAAR]
    for n in range(len(zichtbaar)):
        y = LIJST_Y + n * RIJ_PITCH
        oms, cijfer, meta, soort = zichtbaar[n]
        blokkleur = {"onvoldoende": ORANJE, "tekst": GEDEMPT}.get(soort, BLAUW)
        vlak(0, y, 319, 36, BAND)
        vlak(0, y, 4, 36, blokkleur)
        tekst(14, y + 2, truncate(oms, 247), DONKER)
        tekst(14, y + 18, truncate(meta, 247), GEDEMPT)
        vlak(CIJFER_X, y + 8, CIJFER_W, 20, blokkleur)
        # cijfer was de enige tekst op deze rij die niet werd ingekort; een
        # tekstwaardering van zes tekens tekende tot x=321, voorbij de rand.
        waarde = truncate(cijfer, CIJFER_TEKST_W)
        tekst(CIJFER_X + (CIJFER_W - text_width(waarde)) // 2, y + 10, waarde, WIT)

    scrollbar(scroll, ZICHTBAAR, len(cijfers))
    voetbalk("^v scroll  CLEAR vakken")


# --- tekenlaag: geen-data-scherm ---

def toon_geen_data():
    vlak(0, 0, 319, 209, PAGINA)
    kop("MAGISTER")
    mededeling("geen gegevens gevonden",
               "sync opnieuw vanaf de pc")
    voetbalk("CLEAR sluiten")


# --- hoofdlus ---

# Toetscodes: gemeten op het apparaat op 2026-09-01 met het KEYS-probe-
# programma (elke toets ingedrukt, de code afgelezen). Vier van de acht
# eerdere gok-waarden bleken fout - ENTER, 1 en 2 het verst ernaast - dus
# gok hier niets bij: een nieuwe toets meet je eerst met KEYS.
K_OMHOOG = 25
K_OMLAAG = 34
K_LINKS = 24
K_RECHTS = 26
K_ENTER = 105
K_CLEAR = 45
K_1 = 92
K_2 = 93


def volgende_les(rijen, vanaf, richting):
    """Index van de eerste lesregel vanaf `vanaf`, zoekend in `richting`.

    `vanaf` telt zelf mee; `richting` is +1 (omlaag) of -1 (omhoog).
    Tussenuren worden overgeslagen, want gatregel() tekent geen
    selectiekader: een selectie op een tussenuur laat de cursor van het
    scherm verdwijnen. Is er in die richting geen lesregel meer, dan is het
    antwoord -1 en laat de aanroeper de selectie staan waar hij stond.
    """
    i = vanaf
    while 0 <= i < len(rijen):
        if rijen[i][L_SOORT] == "les":
            return i
        i += richting
    return -1


def eerste_les(rijen):
    """De eerste lesregel van een dag; 0 bij een dag zonder lesregels.

    Een dag zonder lessen tekent zijn eigen mededeling-scherm, dus daar doet
    de selectie er niet toe - hij mag alleen niet buiten de rij wijzen.
    """
    return max(0, volgende_les(rijen, 0, 1))


def main():
    if not data_ok():
        # Gemeten op het apparaat op 2026-09-01: met een enkele wait_key()
        # sloot dit scherm meteen weer af na het starten van de app -- de
        # toets waarmee je hem start staat nog in de buffer en telt als
        # antwoord. De voetbalk belooft "CLEAR sluiten", dus dat is ook de
        # enige toets die sluit; elke andere tekent het scherm opnieuw.
        while True:
            toon_geen_data()
            D.show_draw()
            if wait_key() == K_CLEAR:
                return

    scherm = "dag"
    dag, selectie, scroll = 0, eerste_les(DAGEN[0][3]), 0
    detail_scroll = 0
    vak, vak_scroll = 0, 0

    while True:
        if scherm == "dag":
            toon_dag(dag, selectie, scroll)
        elif scherm == "detail":
            toon_lesdetail(dag, selectie, detail_scroll)
        elif scherm == "vakken":
            toon_vakken(vak, vak_scroll)
        else:
            toon_cijfers(vak, vak_scroll)
        D.show_draw()

        k = wait_key()
        rijen = DAGEN[dag][3]

        if k == K_CLEAR:
            if scherm == "dag":
                # Elke voetbalk buiten vandaag belooft "CLR vandaag": van een
                # andere dag springt CLEAR eerst terug naar vandaag (dag 0),
                # en pas vanaf vandaag sluit hij de app af.
                if dag == 0:
                    return
                dag, scroll = 0, 0
                selectie = eerste_les(DAGEN[0][3])
            elif scherm == "cijfers":
                # Dezelfde soort reset als hierboven bij "vakken": vak_scroll
                # terugzetten zonder vak zelf zou vak 11 geselecteerd laten
                # terwijl de lijst weer bij vak 1 begint.
                scherm, vak, vak_scroll = "vakken", 0, 0
            elif scherm == "vakken":
                # Ruling (progress.md): CLEAR vanuit vakken gaat net als
                # CLEAR vanuit dag terug naar vandaag, dus ook dag=0 en de
                # selectie op de eerste lesrij -- niet alleen scroll en
                # vak_scroll op 0, want dan bleef je op de dag en de
                # (mogelijk onzichtbare) selectie staan waar je vandaan kwam.
                scherm, dag, scroll, vak_scroll = "dag", 0, 0, 0
                selectie = eerste_les(DAGEN[0][3])
            else:                       # scherm == "detail"
                # scroll is van het dagscherm en blijft hier onaangeroerd:
                # de lijstpositie moet exact zijn zoals de gebruiker hem
                # achterliet, ook als selectie op de laatste rij stond.
                scherm = "dag"
        elif k == K_1:
            scherm, scroll = "dag", 0
        elif k == K_2:
            scherm, vak, vak_scroll = "vakken", 0, 0
        elif k == K_LINKS:
            if scherm == "dag":
                dag = max(0, dag - 1)
                selectie, scroll = eerste_les(DAGEN[dag][3]), 0
            elif scherm == "detail":
                # <> bladert op het detailscherm door de lessen van de dag,
                # zoals de voetbalk belooft. Een ander lesuur heeft een andere
                # omschrijving, dus de huiswerk-scroll begint weer bovenaan.
                doel = volgende_les(rijen, selectie - 1, -1)
                if doel >= 0:
                    selectie, detail_scroll = doel, 0
        elif k == K_RECHTS:
            if scherm == "dag":
                dag = min(len(DAGEN) - 1, dag + 1)
                selectie, scroll = eerste_les(DAGEN[dag][3]), 0
            elif scherm == "detail":
                doel = volgende_les(rijen, selectie + 1, 1)
                if doel >= 0:
                    selectie, detail_scroll = doel, 0
        elif k == K_OMLAAG:
            # Elk scherm heeft zijn eigen arm: het detailscherm scrolt door
            # het huiswerk (detail_scroll), niet door de cijferlijst
            # (vak_scroll).
            if scherm == "dag":
                doel = volgende_les(rijen, selectie + 1, 1)
                if doel >= 0:
                    selectie = doel
                    scroll = max(scroll, selectie - ZICHTBAAR + 1)
            elif scherm == "detail":
                detail_scroll += 1
            elif scherm == "vakken":
                vak = min(len(VAKKEN) - 1, vak + 1)
                vak_scroll = max(vak_scroll, vak - 5)
            elif scherm == "cijfers":
                vak_scroll += 1
        elif k == K_OMHOOG:
            if scherm == "dag":
                doel = volgende_les(rijen, selectie - 1, -1)
                if doel >= 0:
                    selectie = doel
                    scroll = min(scroll, selectie)
            elif scherm == "detail":
                detail_scroll = max(0, detail_scroll - 1)
            elif scherm == "vakken":
                vak = max(0, vak - 1)
                vak_scroll = min(vak_scroll, vak)
            elif scherm == "cijfers":
                vak_scroll = max(0, vak_scroll - 1)
        elif k == K_ENTER:
            if scherm == "dag" and rijen and rijen[selectie][L_SOORT] == "les":
                scherm, detail_scroll = "detail", 0
            elif scherm == "vakken" and VAKKEN:
                scherm, vak_scroll = "cijfers", 0


# De Evo start een programma met "from MAGISTER import *". __name__ is daar dus
# "MAGISTER" en niet "__main__", en een gewone main-guard vuurt er nooit.
# Gemeten op 2026-09-01: het scherm flitste even wit en de app was meteen weer
# weg, zonder foutmelding -- want er werd niets aangeroepen.
#
# Starten doet hij daarom zodra ti_draw er echt is. Op de Mac zonder ti_draw is
# D None, en in de testsuite draagt de neppe ti_draw het merk IS_NEP; in
# allebei die gevallen wordt dit bestand alleen gelezen, niet gestart.
if D is not None and not getattr(D, "IS_NEP", False):
    main()
