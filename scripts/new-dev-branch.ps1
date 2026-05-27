param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidatePattern("^codex\/[a-z0-9][a-z0-9._-]*$")]
  [string]$BranchName
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$status = git status --porcelain
if ($status) {
  Write-Error "Working tree is not clean. Commit, stash, or discard local changes before creating a new development branch."
}

git fetch origin master
git switch master
git pull --ff-only origin master
git switch -c $BranchName

Write-Host "Created development branch '$BranchName' from origin/master."

