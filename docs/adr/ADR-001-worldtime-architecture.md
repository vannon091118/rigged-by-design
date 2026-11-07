# ADR-001: Einzelne autoritative Weltzeit und Life-Sim-Schichtenarchitektur

## Status
Accepted

## Kontext
Das Life-Sim-Projekt (v0.3.183) benötigt eine klare Trennung zwischen:
- **Host Pacing** (TICK_MS = 520, setzt den physischen Takt)
- **Wall Clock** (systemzeitliche Uhrzeit, nicht deterministisch)
- **WorldTime** (einzelne autoritative, deterministische Simulationszeit)
- **Presentation Clock** (Render-FPS, unabhängig vom Spielzustand)

Bisher wird `tickWorld()` direkt über `setInterval(TICK_MS)` in `world-store.ts` getrieben.
Es gibt keine autoritative WorldTime getrennt vom Host-Pacing. Es gibt keinen ADR mit Schichten-Diagramm.

## Entscheidung

### 1. Eine einzige autoritative Weltzeit (WorldTime)
WorldTime ist die einzige Quelle für Simulationszeit. Sie ist ein Integer-Tickstand,
der deterministisch fortgeschritten wird. Alle spielrelevanten Zeitabhängigkeiten
(Cooldowns, Eventfristen, Tageswechsel, NPC-Zyklen) beziehen sich ausschließlich auf WorldTime.

### 2. Trennung von Zeitdomänen
| Domäne | Verantwortung | Deterministisch? |
|--------|--------------|------------------|
| Host Pacing | Physischer Takt (setInterval, TICK_MS) | Nein (jitter) |
| Wall Clock | Systemuhrzeit | Nein |
| WorldTime | Simulationszeit (Integer-Ticks) | Ja |
| Presentation Clock | Render-FPS | Nein |

### 3. Schichtenarchitektur (Layer Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (UI, Render, FPS)                      │
│  └─ liest WorldTime nur zum Anzeigen (nicht zum Steuern)   │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (ActionSet, Menüs, Commands)            │
│  └─ ruft Domänen-Dienste auf, ändert keinen Zustand direkt │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer (Casino, Social, Work, Everyday, ...)        │
│  └─ konsumiert WorldTime, emittiert Domain-Events          │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (WorldTime, Calendar, ClockAdapter)  │
│  └─ einzige autoritative Zeitquelle                        │
├─────────────────────────────────────────────────────────────┤
│  Host Layer (setInterval, TICK_MS, OS)                     │
│  └─ treibt Ticks an, kennt keine Domänenlogik              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Domain-Grenzen
Der Simulationskern enthält **keine** Casino-Begriffe oder Casino-Annahmen.
Casino ist eine von mehreren gleichberechtigten Domänen:
- Casino (Slots, Blackjack, etc.) — optional, erweiterbar
- Social/Kommunikation (Nachrichten, Beziehungen)
- Arbeit (Jobs, Karriere, Einkommen)
- Alltag (Wohnen, Essen, Freizeit)
- Zukünftige Lebensbereiche — erweiterbar über Content-Pakete

Jede Domäne registriert sich über ein Manifest mit stabilen IDs und Versionen.

### 5. Ownership-Matrix

| Daten | Besitzer | Erlaubte Leser | Erlaubte Schreiber |
|-------|----------|----------------|--------------------|
| WorldTime | Infrastructure (sim/time) | Alle Domänen | Infrastructure nur |
| Actor-IDs | Core Identity | Alle | Core Identity |
| Beziehungen | Core Social | Alle | Core Social |
| Ledger/Contostände | Core Economy | Alle | Core Economy |
| Domain-Events | Core Events | Alle | Core Events |
| Casino-Zustand | Domain Casino | Casino | Casino |
| Social-Zustand | Domain Social | Social | Social |
| Arbeit-Zustand | Domain Work | Work | Work |

### 6. Akzeptanzkriterien Phase 1
- [x] Genau eine Quelle für Weltzeit (WorldTime)
- [ ] Ein neues System kann eine eigene Rate verwenden, ohne eigene Weltuhr einzuführen (TimeDomain)
- [ ] Gleiche WorldTime-Fortschritte und Eingaben erzeugen identische Zustandsübergänge (deterministisch)
- [ ] Wall Clock und Render-FPS können Gameplay nicht unbemerkt verändern
- [ ] Kein globales Limit für NPC-/Event-/Ortsanzahl als Performance-Lösung

## Konsequenzen
- `world-store.ts` wird auf WorldTime umgestellt (Phase 1.2)
- Neue Domänen benötigen keinen eigenen Zeitstand
- Alle Event-Fristen und Cooldowns basieren auf Ticks, nicht auf ms
- Presentation Layer darf WorldTime nur lesen, nie schreiben

## Siehe auch
- docs/capabilities.json (Capability-Inventar)
- .lane-claims/claims.json (Lane-Governance)