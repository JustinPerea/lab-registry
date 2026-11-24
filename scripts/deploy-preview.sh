#!/usr/bin/env bash
# Deploys a Vercel preview of the registry site from the local tree and fails
# if any of its addresses answers without Vercel sign-in. Production deploys
# come from pushes to main (implementation-notes.md, "Deploying").
#
# On 2026-11-24 a plain `vercel deploy` on this new, unlinked project made a
# production deployment, and Vercel gave it lab-registry-psi.vercel.app, which
# Standard Protection leaves public. So this always deploys to preview, never
# production, and checks every alias afterwards.
set -euo pipefail

TEAM="justins-projects-aa256ca2"
cd "$(dirname "$0")/.."

# An invalid VERCEL_TOKEN in the shell overrides the CLI's own login.
vc() { env -u VERCEL_TOKEN vercel "$@" --scope "$TEAM"; }

# The CLI prints the deployment as JSON on stdout.
out=$(vc deploy --yes --environment preview \
  --build-env ENABLE_EXPERIMENTAL_COREPACK=1 2>/dev/null)
read -r url target < <(printf '%s' "$out" | python3 -c '
import json, sys
d = json.load(sys.stdin)["deployment"]
print(d["url"], d.get("target") or "preview")')
[ -n "$url" ] || { echo "deploy-preview: no deployment URL" >&2; exit 1; }
if [ "$target" != "preview" ]; then
  echo "deploy-preview: $url is a $target deployment, not preview" >&2
  exit 1
fi

public=0
aliases=$(vc inspect "$url" 2>&1 | grep -oE 'https://[a-z0-9.-]+\.vercel\.app' | sort -u || true)
for alias in $aliases; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$alias/")
  if [ "$code" != "302" ] && [ "$code" != "401" ]; then
    echo "deploy-preview: $alias answered $code without sign-in" >&2
    public=1
  fi
done
[ "$public" = 0 ] || exit 1

echo "$url"
