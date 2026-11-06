/**
 * Editor-Freigabe: nur ein Build mit `RBD_EDITOR_MODE=1` und `?editor=1`
 * oeffnet den Entwicklungslayout-Editor. Der Query-Parameter allein reicht nie,
 * damit ein Produktions- oder APK-Build keinen Editor enthalten kann.
 */
const BUILD_FLAG: string | undefined = import.meta.env.VITE_RBD_EDITOR_MODE;

export function editorEnabled(search: string, buildFlag: string | undefined = BUILD_FLAG): boolean {
  if (buildFlag !== '1') return false;
  return new URLSearchParams(search).get('editor') === '1';
}
