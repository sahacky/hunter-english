#!/bin/bash
# show.sh from to [start end chars]
cd "$(dirname "$0")"
A=${3:-0}; B=${4:-180}; C=${5:-1100}
while IFS='|' read n v; do
  [ $n -lt $1 -o $n -gt $2 ] && continue
  f=subs/$v.ru.vtt
  if [ -f $f ]; then echo "## $n $v: $(python3 ext.py $f $A $B | cut -c${6:-1}-$C)"; else echo "## $n $v: NOSUB"; fi
done < targets.txt
