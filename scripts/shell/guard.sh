# Rigged by Design — guarded interactive Bash.
#
# Wird nur von `rbd shell watch` ueber `bash --rcfile` geladen. Kein Login-RC,
# keine Aenderung an der globalen Shell. Die Funktionen sind absichtlich
# schmal: sie pruefen die getippte Zeile und rufen danach das echte Werkzeug
# ueber `command` auf. So bleibt der Exit-Code des Werkzeugs unveraendert.
if [[ $- != *i* ]]; then
  return 0 2>/dev/null || exit 0
fi

RBD_GUARD_ROOT="${RBD_GUARD_ROOT:-$(pwd)}"
RBD_GUARD="${RBD_GUARD_ROOT}/scripts/shell-guard.mjs"

__rbd_guard() {
  local label="$1"
  shift
  # Eine Pipe auf ein Gate-/Testkommando verschluckt den Exit-Code. Das wird
  # vor dem Start blockiert, nicht nachtraeglich erraten.
  if [ -p /dev/stdout ] && [[ "$label" =~ ^(pnpm|npm|npx|rbd|node[[:space:]]+(scripts|bin)/) ]]; then
    printf '\n[RBD-GATE:LOSSY_PIPE] Gate-Ausgabe nicht pipen; Exit-Status bleibt sonst verborgen.\n' >&2
    return 2
  fi
  command node "$RBD_GUARD" --command "$label" 1>&2 || return $?
  command "$@"
}

grep() { __rbd_guard "grep $*" grep "$@"; }
rg() { __rbd_guard "rg $*" rg "$@"; }
git() { __rbd_guard "git $*" git "$@"; }
pnpm() { __rbd_guard "pnpm $*" pnpm "$@"; }
npm() { __rbd_guard "npm $*" npm "$@"; }
npx() { __rbd_guard "npx $*" npx "$@"; }
node() { __rbd_guard "node $*" node "$@"; }
gh() { __rbd_guard "gh $*" gh "$@"; }
pip() { __rbd_guard "pip $*" pip "$@"; }
pip3() { __rbd_guard "pip3 $*" pip3 "$@"; }
vitest() { __rbd_guard "vitest $*" vitest "$@"; }

__rbd_prompt() {
  local status=""
  if [ -f "$RBD_GUARD_ROOT/.verify-cache/shell-watch.status" ]; then
    status="$(command head -c 160 "$RBD_GUARD_ROOT/.verify-cache/shell-watch.status" 2>/dev/null)"
  fi
  case "$status" in
    ROT*) printf '\n[RBD-WATCHER] %s\n' "$status" >&2 ;;
  esac
}

PROMPT_COMMAND="__rbd_prompt${PROMPT_COMMAND:+; $PROMPT_COMMAND}"
PS1="(rbd) ${PS1:-\$ }"
printf '[RBD] guarded Shell · Watcher aktiv · Pflichtlektuere: pnpm rbd docs read · Tiefe nur bei Bedarf\n'
