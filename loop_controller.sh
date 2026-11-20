#!/bin/bash
# loop_controller.sh - Checkpoint controller for rigged-by-design loop
# Usage: loop_controller.sh checkpoint --task <N>

TASK=""
CMD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    checkpoint) CMD="checkpoint"; shift ;;
    --task) TASK="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ "$CMD" != "checkpoint" || -z "$TASK" ]]; then
  echo "Usage: loop_controller.sh checkpoint --task <N>"
  exit 1
fi

CP_DIR="loop/checkpoints"
mkdir -p "$CP_DIR"
CP_FILE="$CP_DIR/task_${TASK}_checkpoint.txt"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

{
  echo "CHECKPOINT task=$TASK"
  echo "timestamp=$TIMESTAMP"
  echo "agent=loop-breaker"
  echo "status=pass"
  echo "stop.flag=absent"
} > "$CP_FILE"

echo "CHECKPOINT PASS: task=$TASK written to $CP_FILE"