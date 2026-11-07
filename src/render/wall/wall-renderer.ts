/**
 * Wall Renderer - Phase 7.1
 * Rendering von Wänden für das Produktionsbuild.
 * Kein Editor-only-Code; Wände sind im normalen Gameplay sichtbar und wirksam.
 */

import type { Wall, WallType } from "../../core/sim/layout/wall";

export interface WallRenderData {
  readonly id: string;
  readonly type: WallType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly opacity: number;
}

export interface WallRenderConfig {
  readonly wallColor: string;
  readonly doorColor: string;
  readonly openingColor: string;
  readonly wallOpacity: number;
  readonly doorOpacity: number;
  readonly openingOpacity: number;
}

export const DEFAULT_WALL_RENDER_CONFIG: WallRenderConfig = {
  wallColor: "#4a4a4a",
  doorColor: "#8b4513",
  openingColor: "#cccccc",
  wallOpacity: 0.8,
  doorOpacity: 0.6,
  openingOpacity: 0.3,
};

export function wallToRenderData(wall: Wall, config: Partial<WallRenderConfig> = {}): WallRenderData {
  const cfg = { ...DEFAULT_WALL_RENDER_CONFIG, ...config };

  let color: string;
  let opacity: number;

  switch (wall.type) {
    case "DOOR":
      color = cfg.doorColor;
      opacity = cfg.doorOpacity;
      break;
    case "OPENING":
      color = cfg.openingColor;
      opacity = cfg.openingOpacity;
      break;
    case "WALL":
    default:
      color = cfg.wallColor;
      opacity = cfg.wallOpacity;
      break;
  }

  return {
    id: wall.id,
    type: wall.type,
    x: wall.x,
    y: wall.y,
    width: wall.width,
    height: wall.height,
    color,
    opacity,
  };
}

export function wallsToRenderData(walls: Wall[], config?: Partial<WallRenderConfig>): WallRenderData[] {
  return walls.map((wall) => wallToRenderData(wall, config));
}

export function isWallRenderable(wallType: WallType): boolean {
  return ["WALL", "DOOR", "OPENING"].includes(wallType);
}