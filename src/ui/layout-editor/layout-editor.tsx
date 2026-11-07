/**
 * Layout Editor UI - Phase 7.1
 * Produktionsbaumaschine für Innenwände im Gameplay.
 * Erreichbar im normalen Gameplay (nicht nur hinter VITE_RBD_EDITOR_MODE).
 */

import type { WallType } from "../../core/sim/layout/wall";
import type { LayoutEditor } from "../../core/sim/layout/layout-editor";
import { DEFAULT_LAYOUT_EDITOR_CONFIG } from "../../core/sim/layout/layout-editor";

export interface LayoutEditorProps {
  readonly editor: LayoutEditor;
  readonly onWallPlaced?: (wallId: string) => void;
  readonly onWallRemoved?: (wallId: string) => void;
  readonly onModeChange?: (mode: "wall" | "door" | "opening" | "none") => void;
}

export interface WallPlacementTool {
  readonly type: WallType;
  readonly active: boolean;
}

export function LayoutEditorComponent(props: LayoutEditorProps): string {
  const { editor } = props;

  const walls = editor.listWalls();
  const revision = editor.getRevision();

  const tools: WallPlacementTool[] = [
    { type: "WALL", active: false },
    { type: "DOOR", active: false },
    { type: "OPENING", active: false },
  ];

  return `
    <div class="layout-editor" data-revision="${revision}">
      <div class="layout-editor-toolbar">
        <h3>Layout Editor (Produktionsbuild)</h3>
        <div class="tool-group">
          ${tools
            .map(
              (tool) => `
                <button
                  class="tool-btn ${tool.active ? "active" : ""}"
                  data-tool="${tool.type}"
                  title="${tool.type}"
                >
                  ${tool.type}
                </button>
              `
            )
            .join("")}
        </div>
        <div class="wall-count">
          Wände: ${walls.length}/${DEFAULT_LAYOUT_EDITOR_CONFIG.maxWalls}
        </div>
        <div class="revision">
          Revision: ${revision}
        </div>
      </div>

      <div class="layout-editor-canvas">
        ${walls
          .map(
            (wall) => `
              <div
                class="wall-render"
                data-wall-id="${wall.id}"
                data-wall-type="${wall.type}"
                style="
                  position: absolute;
                  left: ${wall.x * 20}px;
                  top: ${wall.y * 20}px;
                  width: ${wall.width * 20}px;
                  height: ${wall.height * 20}px;
                  background-color: ${wall.type === "WALL" ? "#4a4a4a" : wall.type === "DOOR" ? "#8b4513" : "#cccccc"};
                  opacity: ${wall.type === "WALL" ? 0.8 : wall.type === "DOOR" ? 0.6 : 0.3};
                  border: 1px solid #333;
                "
              ></div>
            `
          )
          .join("")}
      </div>

      <div class="layout-editor-actions">
        <button class="btn-save" onclick="saveLayout()">Speichern</button>
        <button class="btn-load" onclick="loadLayout()">Laden</button>
        <button class="btn-clear" onclick="clearWalls()">Alle Wände entfernen</button>
      </div>
    </div>
  `;
}

export function createLayoutEditorUI(
  editor: LayoutEditor,
  callbacks: Partial<LayoutEditorProps>
): LayoutEditorProps {
  return {
    editor,
    onWallPlaced: callbacks.onWallPlaced,
    onWallRemoved: callbacks.onWallRemoved,
    onModeChange: callbacks.onModeChange,
  };
}

export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production" || !process.env.VITE_RBD_EDITOR_MODE;
}

export function isBuildModeAvailable(): boolean {
  // Im Produktionsbuild erreichbar (nicht nur hinter VITE_RBD_EDITOR_MODE)
  return true;
}