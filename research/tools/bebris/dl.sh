#!/bin/bash
cd "$(dirname "$0")"
mkdir -p subs
while IFS='|' read n v; do
  ls subs/$v.* >/dev/null 2>&1 && continue
  timeout 90 yt-dlp --write-auto-sub --sub-lang ru --skip-download --sub-format vtt -o "subs/%(id)s" "https://www.youtube.com/watch?v=$v" >>dl.log 2>&1
  if ! ls subs/$v.* >/dev/null 2>&1; then echo "FAIL $n $v" >> fail.log; grep -q "429" dl.log && sleep 60; fi
  sleep 8
done < targets.txt
echo DONE >> dl.log
