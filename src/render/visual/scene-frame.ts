/**
 * Deterministischer Bildvertrag für die vier R1-Szenen.
 *
 * Der Vertrag liest ausschließlich den vorhandenen `GameView` und zeichnet ein
 * reproduzierbares SVG. Er ist kein Ersatz für den Pixi-Screenshot, sondern
 * das lokale, browserfreie Sicherheitsnetz: Rollen, Layout, Figuren und
 * Kameraausschnitt müssen bei drei Läufen identisch bleiben. Der Browserlauf
 * mit echter Pixi-Ausgabe bleibt der ergänzende Sichtbeleg.
 */
import { Ledger } from '../../core/economy/ledger';
import { createWorld } from '../../core/sim/templates';
import { TILE, type SceneState } from '../../core/sim/types';

type SceneKind = SceneState['kind'];
import { buildView } from '../../store/snapshot';
import type { GameView } from '../../store/types';
import { floorArtFor } from '../floor-material';
import { resolveFurnitureRole, type FurnitureRole } from '../decor-roles';

type VisualSceneId = 'casino-overview' | 'casino-detail' | 'city' | 'apartment';

interface VisualCamera {
  /** Mittelpunkt in Tile-Koordinaten. */
  readonly x: number;
  readonly y: number;
  /** 1 = Übersicht; >1 schneidet einen Ausschnitt. */
  readonly zoom: number;
}

interface VisualScene {
  readonly id: VisualSceneId;
  readonly label: string;
  readonly view: GameView;
  readonly camera: VisualCamera;
}

const VISUAL_SIZE = Object.freeze({ width: 640, height: 360 });

function viewFor(kind: SceneKind): GameView {
  const world = createWorld('MEDIUM');
  world.scene = { kind };
  return buildView(world, new Ledger(), '');
}

/** Vier Szenen, die dieselbe Projektion wie die Bühne lesen. */
export function createVisualScenes(): readonly VisualScene[] {
  const casino = viewFor('OWN');
  return [
    { id: 'casino-overview', label: 'Casino · Übersicht', view: casino, camera: { x: 15, y: 15, zoom: 1 } },
    { id: 'casino-detail', label: 'Casino · Detail', view: casino, camera: { x: 16, y: 14, zoom: 2.4 } },
    { id: 'city', label: 'Stadt · Straßenraum', view: viewFor('CITY'), camera: { x: 15, y: 15, zoom: 1 } },
    { id: 'apartment', label: 'Wohnung · vier Bereiche', view: viewFor('APARTMENT'), camera: { x: 8, y: 8, zoom: 1 } },
  ];
}

const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;

const ROLE_TINT: Readonly<Record<FurnitureRole, number>> = {
  SLOT: 0xb06bff, BLACKJACK: 0x8a9a64, POKER: 0x8a9a64, VIDEO_POKER: 0xb06bff,
  ROULETTE: 0x8a9a64, PLINKO: 0xffd166, SHELL: 0x8a9a64, DICE: 0x8a9a64,
  BAR: 0xff9a3d, TOILET: 0x9fe6ff, EXCHANGE: 0xffd166, STORAGE: 0x8a7aa8,
  SOFA: 0xff2e88, ARMCHAIR: 0xff2e88, PALM: 0x2dd4a0, PLANT: 0x2dd4a0,
  NEON: 0xb06bff, COLUMN: 0x8a7aa8, CHANDELIER: 0xffd166, CANDELABRA: 0xffd166,
  STATUE: 0xffd166, ROPE: 0xff2e88, LAMP: 0xffd9a0, NEWSPAPER: 0xcdbfd9,
  SIDE_TABLE: 0x8a6a4a, COUNTER: 0xff9a3d, SIGN: 0xb06bff, MIRROR: 0x9fe6ff,
  BED: 0xd8c8e8, WARDROBE: 0x8a7aa8, TABLE: 0x8a6a4a, KITCHEN: 0x9fc4cc,
  FRIDGE: 0x9ab0c0, SINK: 0x9ac8d8, SMARTPHONE: 0x00ffcc,
};

interface SvgRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly fill: string; }

function visibleWorld(view: GameView, camera: VisualCamera): { x: number; y: number; w: number; h: number; scale: number } {
  const worldW = view.size * TILE;
  const worldH = view.size * TILE;
  const scale = Math.min(VISUAL_SIZE.width / worldW, VISUAL_SIZE.height / worldH) * camera.zoom;
  const visibleW = VISUAL_SIZE.width / scale;
  const visibleH = VISUAL_SIZE.height / scale;
  return {
    x: camera.x * TILE - visibleW / 2,
    y: camera.y * TILE - visibleH / 2,
    w: visibleW,
    h: visibleH,
    scale,
  };
}

/** SVG-Frame; alle Farben und Rollen sind aus demselben Vertrag abgeleitet. */
export function renderSceneSvg(scene: VisualScene): string {
  const { view, camera } = scene;
  const frame = visibleWorld(view, camera);
  const theme = view.scene.kind === 'APARTMENT' ? 'apartment' : 'casino';
  const rects: SvgRect[] = [];
  for (let y = 0; y < view.size; y += 1) {
    for (let x = 0; x < view.size; x += 1) {
      const material = view.layout.floor[y * view.size + x];
      if (!material) continue;
      rects.push({
        x: x * TILE, y: y * TILE, w: TILE, h: TILE,
        fill: hex(floorArtFor(material, theme).base),
      });
    }
  }
  const furniture = view.furniture.map((item) => {
    const role = resolveFurnitureRole(item);
    return `<rect x="${item.x * TILE}" y="${item.y * TILE}" width="${item.w * TILE}" height="${item.h * TILE}" fill="${hex(role ? ROLE_TINT[role.role] : 0xff9a3d)}" data-role="${role?.key ?? 'unresolved'}"/>`;
  }).join('');
  const guests = view.guests.map((guest) =>
    `<circle cx="${(guest.position.x + 0.5) * TILE}" cy="${(guest.position.y + 0.8) * TILE}" r="${3 + guest.addiction / 50}" fill="#ff2e88" data-guest="${guest.id}"/>`,
  ).join('');
  const player = `<circle cx="${(view.player.position.x + 0.5) * TILE}" cy="${(view.player.position.y + 0.8) * TILE}" r="4.5" fill="#00ffcc" data-player="1"/>`;
  const viewBox = `${frame.x} ${frame.y} ${frame.w} ${frame.h}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VISUAL_SIZE.width}" height="${VISUAL_SIZE.height}" viewBox="${viewBox}" data-scene="${scene.id}" data-label="${scene.label}">`
    + `<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="#140d24"/>`
    + rects.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill}"/>`).join('')
    + furniture + guests + player
    + '</svg>';
}

/** FNV-1a über den ganzen Frame; stabil über Läufe und Plattformen. */
export function frameHash(svg: string): string {
  let hash = 2166136261;
  for (let index = 0; index < svg.length; index += 1) {
    hash ^= svg.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface VisualEvidence {
  readonly id: VisualSceneId;
  readonly hash: string;
  readonly svg: string;
}

/** Drei Läufe je Szene: ein einzelner grüner Lauf ist kein Bildbeleg. */
export function captureVisualEvidence(scenes = createVisualScenes()): VisualEvidence[] {
  return scenes.map((scene) => {
    const runs = [0, 1, 2].map(() => renderSceneSvg(scene));
    const stable = runs.every((run) => run === runs[0]);
    return { id: scene.id, hash: stable ? frameHash(runs[0]!) : 'unstable', svg: runs[0]! };
  });
}
