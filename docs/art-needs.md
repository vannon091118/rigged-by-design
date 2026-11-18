# Art-Audit und offene Art-Needs

<!-- rbd-doc: managed -->

**Zweck:** Klassifikation der vorhandenen Environment- und relevanten
Casino-Assets fuer Phase 1, plus die Liste dessen, was fuer Wohnung, Strasse
und NPC-Pipeline fehlt.

**Stand:** 2026-11-18 · Basis `d7844ba0`, `head-03-01` nach Freigabe ergaenzt ·
Kontaktbogen
[`environment-contact-sheet.png`](visual-rework/phase1/environment-contact-sheet.png)

## 1. Methode

Der Kontaktbogen wird mit `node scripts/build-art-contact-sheet.mjs` erzeugt. Er
zeigt 27 Assets in zeilenweiser Reihenfolge (5 Spalten); die Tabelle nennt
dieselbe Reihenfolge und die Quellgroesse.

Klassen:

- **KEEP** — Stil, Kontur und Palette passen; keine Aenderung noetig.
- **REWORK** — lesbar, aber Perspektive, Material oder Kontrast verletzen den
  Style Guide.
- **REPLACE** — falsche Grundform oder falscher Massstab; neu zeichnen.
- **BROKEN** — Asset laedt nicht, ist beschnitten oder technisch unbrauchbar.

## 2. Environment (19 Assets)

| # | Asset-ID | Typ | Groesse | Klasse | Begruendung |
| ---: | --- | --- | --- | --- | --- |
| 1 | `environment/floor/apartment-rug.svg` | Boden | 64×64 | REWORK | Flache braune Flaeche ohne Teppichmotiv; als „Rug" nicht erkennbar. |
| 2 | `environment/floor/city/doors/door.svg` | Tuer | 96×24 | REWORK | Nur ein dunkler Balken; Rahmen und Griff fehlen, Tiefe geht verloren. |
| 3 | `environment/floor/city/facades/apartment.svg` | Fassade | 256×192 | KEEP | Klare Suedansicht, warme Fenster, passt zur Palette. |
| 4 | `environment/floor/city/facades/casino.svg` | Fassade | 256×192 | KEEP | Gold/Teal-Akzent, Casino-Rolle sofort lesbar. |
| 5 | `environment/floor/city/facades/pub.svg` | Fassade | 256×192 | KEEP | Gruene Fassade, konsistente Kontur und Lichtkante. |
| 6 | `environment/floor/city/facades/shop.svg` | Fassade | 256×192 | KEEP | Schaufenster und Markise tragen die Funktion. |
| 7 | `environment/floor/city/props/bench.svg` | Requisite | 96×64 | KEEP | Holzlatten und Beine lesen sich korrekt. |
| 8 | `environment/floor/city/props/bus-stop.svg` | Requisite | 96×128 | KEEP | Schild und Haltestelle klar, Teal als kalter Akzent. |
| 9 | `environment/floor/city/props/street-light.svg` | Requisite | 64×128 | KEEP | Schlanke Form, Lichtkopf mit warmem Kern. |
| 10 | `environment/floor/city/props/trash-bin.svg` | Requisite | 64×80 | KEEP | Metallwerte und Deckel plausibel. |
| 11 | `environment/floor/city/props/tree.svg` | Requisite | 96×128 | KEEP | Baumkrone mit drei Gruentoenen, Kontur stimmt. |
| 12 | `environment/floor/concrete-slab.svg` | Boden | 64×64 | REWORK | Zu wenig Kontrast; Fugen verschwinden auf dunklem Grund. |
| 13 | `environment/floor/linoleum-speckle.svg` | Boden | 64×64 | REWORK | Sprenkel zu spaerlich, liest sich als leerer Fleck. |
| 14 | `environment/floor/stone-marble.svg` | Boden | 64×64 | REWORK | Riss wirkt wie ein Kratzer, nicht wie Marmoradern. |
| 15 | `environment/floor/tile-grid.svg` | Boden | 64×64 | REWORK | Fugen zu gleichmaessig und flach; keine Materialtiefe. |
| 16 | `environment/floor/wood-planks.svg` | Boden | 64×64 | REWORK | Muster liest sich als Ziegelwand, nicht als Diele. |
| 17 | `environment/fx/light-pool.svg` | Licht | 256×256 | REWORK | Weicher Radialverlauf, aber banding-anfaellig; fuer 1× zu grob. |
| 18 | `environment/tiles/casino-carpet-plum.png` | Teppich | 512×512 | KEEP | Wiederholbares Motiv, Gold/Plum-Palette, gute Kachelgrenze. |
| 19 | `environment/tiles/wallpaper-damask-plum.png` | Tapete | 512×512 | KEEP | Ruhiges Damastmuster, wiederholbar. |

## 3. Relevante Casino-Assets (8 Assets)

| # | Asset-ID | Typ | Groesse | Klasse | Begruendung |
| ---: | --- | --- | --- | --- | --- |
| 20 | `characters/head-01-01.png` | Kopf | 32×36 | KEEP | Erste Kopf-Familie, klare Kontur, LOD-taugliche Silhouette. |
| 21 | `characters/head-02-01.png` | Kopf | 32×36 | KEEP | Zweite Familie mit Muetze; Farbe bleibt im LOD lesbar. |
| 22 | `characters/head-03-01.svg` | Kopf | 32×36 | KEEP | Dritte Familie: Silberbob mit Teal-Akzent; im LOD lesbar. |
| 23 | `machines/table-games/card-back.png` | Tisch | 64×96 | KEEP | Kartenruecken mit klarer Rahmenkante. |
| 24 | `machines/table-games/poker-chip-single.png` | Tisch | 64×64 | KEEP | Chip mit zwei Werten und sauberer Kante. |
| 25 | `machines/blackjack-table.png` | Tisch | 192×128 | KEEP | Gruener Filz, Goldrand, passende Perspektive. |
| 26 | `machines/cash-register.png` | Requisite | 64×64 | KEEP | Metall-/Displaywerte konsistent. |
| 27 | `machines/bar-bottle-amber.png` | Requisite | 32×64 | KEEP | Flaschenform und Amber-Glas lesbar. |

**Ergebnis:** 0 BROKEN, 0 REPLACE, 8 REWORK, 19 KEEP. Kein Asset wird
geloescht; die REWORK-Faelle bleiben bis zur Neufassung im Einsatz.

## 4. Offene Art-Needs

Diese Assets fehlen und werden **nicht** durch Platzhalter ersetzt:

| Bedarf | Fuer | Warum jetzt | Groesse |
| --- | --- | --- | --- |
| Apartment-Moebel-Set | Wohnung | `player-apartment.ts` kennt 9 Moebel, aber es gibt keine eigenen Sprites fuer Bett, Sofa, Tisch, Kochzeile, Kuehlschrank, Toilette, Waschbecken, Dusche, Schrank. | 32–96 px |
| Apartment-Boden/Wand | Wohnung | Nur Casino-Teppich und Damast-Tapete existieren; fuer das 1-Zimmer-Appartement fehlen ruhige Wohnungs-Varianten. | 64/512 px |
| Strassen-Infrastruktur | Strasse | Bordstein, Kreuzung, Hydrant, parkendes Auto und Muelltonnen-Variante fehlen; die vorhandenen Props decken nur Gehweg und Haltestelle. | 32–128 px |
| NPC-Rig-Teile | NPC-Pipeline | Kopf, Torso, Arme und Beine sind nur als Casino-PNG-Familien vorhanden; ein drittes Set fuer den Editor fehlt. | 32 px Basis |
| LOD-Identitaetsframes | NPC-Pipeline | Die 12×16-Silhouette existiert als Zeichnung, aber nicht als Sprite-Set je Kopf-/Outfit-Familie. | 12×16 |
| Konflikt-/Dispute-Icons | UI/Floor | Keine eigenen Icons fuer Streit, Hausverbot und Razzia; UI nutzt Text. | 16–24 px |

## 5. head-03-01

Negativsuche und Freigabe: Issue #1133. Die SVG-Quelle liegt im selben Atlas.
