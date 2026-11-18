# Art-Audit und offene Art-Needs

<!-- rbd-doc: managed -->

**Zweck:** Klassifikation der Environment- und Casino-Assets, plus die Liste
dessen, was fuer Wohnung, Strasse und NPC-Pipeline fehlt.

**Stand:** 2026-11-18 · Basis `d7844ba0` ·
[Kontaktbogen](visual-rework/phase1/environment-contact-sheet.png)

## 1. Methode

Kontaktbogen: `node scripts/build-art-contact-sheet.mjs`, 27 Assets.
Klassen: **KEEP** (passt), **REWORK** (Perspektive/Material/Kontrast),
**REPLACE** (Grundform/Massstab), **BROKEN** (laedt nicht/beschnitten).

## 2. Environment (19 Assets)

| # | Asset-ID | Typ | Groesse | Klasse | Begruendung |
| ---: | --- | --- | --- | --- | --- |
| 1 | `environment/floor/apartment-rug.svg` | Boden | 64×64 | REWORK | Flache braune Flaeche; als „Rug" nicht erkennbar. |
| 2 | `environment/floor/city/doors/door.svg` | Tuer | 96×24 | REWORK | Nur ein dunkler Balken; Rahmen und Griff fehlen. |
| 3 | `environment/floor/city/facades/apartment.svg` | Fassade | 256×192 | KEEP | Klare Suedansicht, warme Fenster, Palette passt. |
| 4 | `environment/floor/city/facades/casino.svg` | Fassade | 256×192 | KEEP | Gold/Teal-Akzent, Casino-Rolle sofort lesbar. |
| 5 | `environment/floor/city/facades/pub.svg` | Fassade | 256×192 | KEEP | Gruene Fassade, konsistente Kontur. |
| 6 | `environment/floor/city/facades/shop.svg` | Fassade | 256×192 | KEEP | Schaufenster und Markise tragen die Rolle. |
| 7 | `environment/floor/city/props/bench.svg` | Requisite | 96×64 | KEEP | Holzlatten und Beine lesen korrekt. |
| 8 | `environment/floor/city/props/bus-stop.svg` | Requisite | 96×128 | KEEP | Schild und Haltestelle klar, Teal als Akzent. |
| 9 | `environment/floor/city/props/street-light.svg` | Requisite | 64×128 | KEEP | Schlanke Form, warmer Lichtkopf. |
| 10 | `environment/floor/city/props/trash-bin.svg` | Requisite | 64×80 | KEEP | Metall und Deckel plausibel. |
| 11 | `environment/floor/city/props/tree.svg` | Requisite | 96×128 | KEEP | Baumkrone in drei Gruentoenen. |
| 12 | `environment/floor/concrete-slab.svg` | Boden | 64×64 | REWORK | Zu wenig Kontrast; Fugen verschwinden. |
| 13 | `environment/floor/linoleum-speckle.svg` | Boden | 64×64 | REWORK | Sprenkel zu spaerlich; wirkt wie leerer Fleck. |
| 14 | `environment/floor/stone-marble.svg` | Boden | 64×64 | REWORK | Riss wirkt wie Kratzer, nicht wie Marmoradern. |
| 15 | `environment/floor/tile-grid.svg` | Boden | 64×64 | REWORK | Fugen zu gleichmaessig, keine Materialtiefe. |
| 16 | `environment/floor/wood-planks.svg` | Boden | 64×64 | REWORK | Muster wirkt wie Ziegelwand, nicht wie Diele. |
| 17 | `environment/fx/light-pool.svg` | Licht | 256×256 | REWORK | Weicher Radialverlauf, aber banding-anfaellig. |
| 18 | `environment/tiles/casino-carpet-plum.png` | Teppich | 512×512 | KEEP | Wiederholbares Motiv, Gold/Plum, gute Kachelgrenze. |
| 19 | `environment/tiles/wallpaper-damask-plum.png` | Tapete | 512×512 | KEEP | Ruhiges Damastmuster. |

## 3. Relevante Casino-Assets (8 Assets)

| # | Asset-ID | Typ | Groesse | Klasse | Begruendung |
| ---: | --- | --- | --- | --- | --- |
| 20 | `characters/head-01-01.png` | Kopf | 32×36 | KEEP | Erste Familie, klare Kontur, LOD-taugliche Silhouette. |
| 21 | `characters/head-02-01.png` | Kopf | 32×36 | KEEP | Zweite Familie mit Muetze; im LOD lesbar. |
| 22 | `characters/head-03-01.svg` | Kopf | 32×36 | KEEP | Dritte Familie: Silberbob, Teal-Akzent, LOD-lesbar. |
| 23 | `machines/table-games/card-back.png` | Tisch | 64×96 | KEEP | Kartenruecken mit Rahmenkante. |
| 24 | `machines/table-games/poker-chip-single.png` | Tisch | 64×64 | KEEP | Chip mit zwei Werten und sauberer Kante. |
| 25 | `machines/blackjack-table.png` | Tisch | 192×128 | KEEP | Gruener Filz, Goldrand, passende Perspektive. |
| 26 | `machines/cash-register.png` | Requisite | 64×64 | KEEP | Metall-/Displaywerte konsistent. |
| 27 | `machines/bar-bottle-amber.png` | Requisite | 32×64 | KEEP | Flasche und Amber-Glas lesbar. |

**Ergebnis:** 0 BROKEN, 0 REPLACE, 8 REWORK, 19 KEEP. Kein Asset wird
geloescht; REWORK bleibt bis zur Neufassung im Einsatz.

## 4. Offene Art-Needs

Fehlende Assets; Platzhalter ersetzen sie **nicht**:

| Bedarf | Fuer | Warum jetzt | Groesse |
| --- | --- | --- | --- |
| Apartment-Moebel-Set | Wohnung | `player-apartment.ts` kennt 9 Moebel; eigene Sprites fuer Bett, Sofa, Tisch, Kochzeile, Kuehlschrank, Bad und Schrank fehlen. | 32–96 px |
| Apartment-Boden/Wand | Wohnung | Nur Casino-Teppich und Damast-Tapete existieren; ruhige Wohnungs-Varianten fehlen. | 64/512 px |
| Strassen-Infrastruktur | Strasse | Bordstein, Kreuzung, Hydrant, parkendes Auto und Muelltonnen-Variante fehlen; die Props decken nur Gehweg und Haltestelle. | 32–128 px |
| NPC-Rig-Teile | NPC-Pipeline | Torso (8), Arme (14), Beine (15), Schuhe (14) sind Atlasframes und werden je Seed gewaehlt; `head-03-01.svg` ist im Gast-Pool. Editor-Set fehlt. | 32 px Basis |
| LOD-Identitaetsframes | NPC-Pipeline | 12×16-Silhouette mit Haarton und drei Kopfformen (rund/Bob/Kappe); Sprite-Set je Familie fehlt. | 12×16 |
| Konflikt-/Dispute-Icons | UI/Floor | Keine eigenen Icons fuer Streit, Hausverbot, Razzia; UI nutzt Text. | 16–24 px |

