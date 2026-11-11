#!/bin/sh
{{HEADER}}
# Refreshes match certificates and profiles. Set FASTLANE_USER to your Apple ID first.
# If the Matchfile has no git_url (fastlane.ios.matchGitUrl is unset), pass git_url: or set MATCH_GIT_URL.
set -e
cd "$(dirname "$0")/.."

{{MATCH_COMMANDS}}
