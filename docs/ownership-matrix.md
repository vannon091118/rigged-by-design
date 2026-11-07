# Ownership-Matrix — Life-Sim Domäne

Legt fest, welche Domäne welche Daten besitzt, wer lesen und wer schreiben darf.

## Prinzipien
- Jede Datenquelle hat genau einen Besitzer (Data Owner).
- Besitzer kontrolliert Schreibzugriff; Leser können nur konsumieren.
- Cross-Domain-Schreiben erfordert explizite Registration über Manifest.
- Der Simulationskern kennt keine Casino-Begriffe.

## Matrix

| Datenbereich | Besitzer | Erlaubte Leser | Erlaubte Schreiber |
|--------------|----------|----------------|--------------------|
| WorldTime (tick, day, tickInDay) | Infrastructure/sim/time | Alle Domänen, UI | Infrastructure/sim/time |
| Actor-IDs | Core Identity (actor-id) | Alle | Core Identity |
| Relationships | Core Social (relationship) | Alle | Core Social |
| Ledger / Kontostände | Core Economy (ledger) | Alle | Core Economy |
| Domain-Events | Core Events (domain-event) | Alle | Core Events |
| Save-State | Core Persistence (save) | Alle | Core Persistence |
| Casino-Zustand (Slots, Blackjack) | Domain Casino | Casino | Casino |
| Social / Kommunikation | Domain Social | Social | Social |
| Arbeit / Karriere | Domain Work | Work | Work |
| Alltag / Wohnen / Freizeit | Domain Everyday | Everyday | Everyday |
| ActionSet-Einträge | UI ActionSet | UI, Domain | UI ActionSet |
| Content-Pakete (Manifest) | Infrastructure | Alle | Infrastructure |

## Cross-Domain-Regeln
- Eine Domäne darf fremde Daten nur über öffentliche APIs lesen.
- Schreiben in fremde Datenbereiche ist verboten; stattdessen Events emittieren.
- Der Besitzer entscheidet über Mutationen eigener Daten.
