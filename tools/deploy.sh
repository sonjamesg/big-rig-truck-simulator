#!/usr/bin/env bash
# deploy.sh - staging -> live workflow for trucksim.co.uk (see AGENTS.md "Release workflow")
#   tools/deploy.sh staging         build, then publish the current branch's built site to the STAGING repo
#   tools/deploy.sh live            fast-forward live main to the commit that is on staging (tags live-YYYYMMDD-HHMM first)
#   tools/deploy.sh rollback <tag>  put main back to <tag> with a NEW commit on top (never a force push)
# Live  = sonjamesg/big-rig-truck-simulator           main, Pages, CNAME trucksim.co.uk
# Stage = sonjamesg/big-rig-truck-simulator-staging   main, Pages, noindex + STAGING badge, CNAME staging.trucksim.co.uk
#         (the CNAME is only written once that DNS record points at GitHub; until then it is served at
#          https://sonjamesg.github.io/big-rig-truck-simulator-staging/). The live CNAME is never copied to staging.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LIVE_REPO=sonjamesg/big-rig-truck-simulator
STAGE_REPO=sonjamesg/big-rig-truck-simulator-staging
STAGE_DOMAIN=staging.trucksim.co.uk
GIT=(git -c credential.https://github.com.helper= -c 'credential.https://github.com.helper=!/usr/local/bin/gh auth git-credential')
die() { echo "deploy: $*" >&2; exit 1; }
clean_tree() { # BigRigWeb.zip is a local build artefact and never committed
  [ -z "$(git status --porcelain -- . ':!BigRigWeb.zip')" ] || die "uncommitted changes: commit them first (staging must match a commit)"
}
stage_dns_ok() { # true once staging.trucksim.co.uk is a CNAME to GitHub Pages (DNS over HTTPS; no dig needed)
  curl -fsS "https://dns.google/resolve?name=$STAGE_DOMAIN&type=CNAME" 2>/dev/null | grep -qi 'github\.io'
}
staged_sha() { # the source commit currently published on staging
  curl -fsSL "https://raw.githubusercontent.com/$STAGE_REPO/main/STAGING_SOURCE?$(date +%s)" | head -1
}

cmd_staging() {
  clean_tree
  python3 build.py
  # every build stamps a new build id into index.html: commit the build output so staging == a commit == what goes live
  local other; other=$(git status --porcelain -- . ':!BigRigWeb.zip' ':!index.html' ':!mapdata.bin' ':!dist' ':!BigRig.html')
  [ -z "$other" ] || die "build changed files other than its output: $other"
  if [ -n "$(git status --porcelain -- index.html mapdata.bin)" ]; then
    git add index.html mapdata.bin && git commit -qm "build for staging"
  fi
  local sha br tmp
  sha=$(git rev-parse HEAD); br=$(git branch --show-current)
  tmp=$(mktemp -d)
  "${GIT[@]}" clone -q "https://github.com/$STAGE_REPO.git" "$tmp/site"
  find "$tmp/site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  # the public site = tracked files minus sources / tooling / the live domain file
  git ls-files -z | grep -zvE '^(src|tools|tests|supabase|dist)/|^(BigRigWeb\.zip|BigRig\.html|AGENTS\.md|SYMBOLS\.md|build\.py|README\.md|CNAME|sitemap\.xml)$' \
    | xargs -0 -I{} cp --parents {} "$tmp/site/"
  python3 - "$tmp/site" <<'PY'
import os, re, sys
site = sys.argv[1]
BADGE = ('<div id="stagingBadge" style="position:fixed;left:6px;bottom:6px;z-index:2147483647;pointer-events:none;'
         'background:#ff2d55;color:#fff;font:900 11px system-ui;letter-spacing:2px;padding:3px 7px;border-radius:6px;'
         'box-shadow:0 2px 8px rgba(0,0,0,.5);opacity:.92">STAGING</div>')
for dp, _, fs in os.walk(site):
    if '.git' in dp: continue
    for f in fs:
        if not f.endswith('.html'): continue
        p = os.path.join(dp, f); depth = os.path.relpath(p, site).count(os.sep)
        pre = './' if depth == 0 else '../' * depth
        s = open(p, encoding='utf-8').read()
        s = re.sub(r'<meta name="robots"[^>]*>', '', s)
        s = re.sub(r'<link rel="canonical"[^>]*>', '', s)
        s = s.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">', 1)
        s = re.sub(r'(href|src)="/(?!/)', lambda m: m.group(1) + '="' + pre, s)  # works under /<repo>/ and on the subdomain
        s = re.sub(r'<title>', '<title>[STAGING] ', s, count=1)
        i = s.rfind('</body>')
        s = s[:i] + BADGE + s[i:] if i >= 0 else s + BADGE
        open(p, 'w', encoding='utf-8').write(s)
open(os.path.join(site, 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
PY
  touch "$tmp/site/.nojekyll"
  printf '%s\n%s\n' "$sha" "$br" > "$tmp/site/STAGING_SOURCE"
  if stage_dns_ok; then echo "$STAGE_DOMAIN" > "$tmp/site/CNAME"; fi
  grep -qx 'trucksim.co.uk' "$tmp/site/CNAME" 2>/dev/null && die "refusing: live CNAME in staging build"
  (cd "$tmp/site" && git add -A && { git diff --cached --quiet || git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -qm "staging: $br @ ${sha:0:7}"; } \
    && "${GIT[@]}" push -q origin HEAD:main)
  rm -rf "$tmp"
  echo "staging <- $br @ ${sha:0:7}"
  if stage_dns_ok; then echo "  https://$STAGE_DOMAIN/"; else echo "  https://sonjamesg.github.io/big-rig-truck-simulator-staging/"; fi
}

cmd_live() {
  local sha tag
  sha=$(staged_sha); [ -n "$sha" ] || die "could not read STAGING_SOURCE from staging"
  "${GIT[@]}" fetch -q origin
  git cat-file -e "$sha^{commit}" 2>/dev/null || die "staged commit $sha is not in this repo"
  git merge-base --is-ancestor origin/main "$sha" || die "staged $sha is not a fast-forward of live main: rebase and re-stage"
  tag="live-$(date +%Y%m%d-%H%M)"
  git tag -a "$tag" origin/main -m "Live main before deploying ${sha:0:7}"
  "${GIT[@]}" push -q origin "$tag"
  "${GIT[@]}" push -q origin "$sha:main"
  echo "live main: $(git rev-parse --short "$tag") -> ${sha:0:7} (previous live tagged $tag; undo: tools/deploy.sh rollback $tag)"
}

cmd_rollback() {
  local tag=${1:-}; [ -n "$tag" ] || die "usage: deploy.sh rollback <tag>"
  "${GIT[@]}" fetch -q origin --tags
  git rev-parse -q --verify "$tag^{commit}" >/dev/null || die "no such tag: $tag"
  local wt; wt=$(mktemp -d)
  git worktree add -q --detach "$wt" origin/main
  (cd "$wt" && git rm -q -r --cached . >/dev/null && git checkout "$tag" -- . && git clean -fdq \
     && git checkout "$tag" -- . && git add -A \
     && { git diff --cached --quiet && echo "main already matches $tag"; true; } \
     && { git diff --cached --quiet || git commit -qm "Rollback live to $tag (revert of everything after it; no force push)"; } \
     && "${GIT[@]}" push -q origin HEAD:main)
  git worktree remove --force "$wt"
  echo "live main now matches $tag (new commit on top; history kept)"
}

case "${1:-}" in
  staging) cmd_staging ;;
  live) cmd_live ;;
  rollback) shift; cmd_rollback "$@" ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
