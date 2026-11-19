#!/usr/bin/env bash
# Run before every release. Stops at the first failure.
set -e
cd "$(dirname "$0")/.."
echo "1. Page structure"
python3 - <<'PY'
import re, subprocess
s = open("index.html", encoding="utf-8").read()
assert s.count("<script>") == 1 and s.count("</script>") == 1, "script tags"
assert s.rstrip().endswith("</html>"), "html not closed"
js = re.search(r"<script>([\s\S]*)</script>", s).group(1)
open("/tmp/intel_check.js", "w", encoding="utf-8").write(js)
subprocess.run(["node", "--check", "/tmp/intel_check.js"], check=True)
print("   ok")
PY
echo "2. No personal data or secrets"
if grep -n -i -E "mekala|vikram|riaan|inaaya|@gmail|\+447|SUPABASE_KEY|SERVICE_ROLE|sk-ant|ghp_" index.html; then
  echo "   FAIL: personal data or a secret found"; exit 1
fi
echo "   ok"
echo "3. Behaviour with real Tesco data"
node dev/load_test.js | tail -1
echo "All checks passed."
