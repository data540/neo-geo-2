param(
  [string]$MirrorPath = "",
  [string]$RemoteName = "origin",
  [string]$BranchName = "master"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$remoteUrl = git remote get-url $RemoteName
if (-not $remoteUrl) {
  Write-Error "Remote '$RemoteName' was not found."
}

if (-not $MirrorPath) {
  $parent = Split-Path -Parent $repoRoot
  $MirrorPath = Join-Path $parent "VS neo-geo-2-prod"
}

$resolvedRepoRoot = (Resolve-Path $repoRoot).Path
if (Test-Path $MirrorPath) {
  $resolvedMirrorPath = (Resolve-Path $MirrorPath).Path
  if ($resolvedMirrorPath -eq $resolvedRepoRoot) {
    Write-Error "Mirror path cannot be the development repository path."
  }

  Set-Location $resolvedMirrorPath
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Error "Production mirror has local changes. Resolve them before syncing: $resolvedMirrorPath"
  }

  git fetch $RemoteName $BranchName
  git switch $BranchName
  git pull --ff-only $RemoteName $BranchName
  Write-Host "Production mirror updated: $resolvedMirrorPath"
} else {
  git clone --branch $BranchName --single-branch $remoteUrl $MirrorPath
  Write-Host "Production mirror created: $MirrorPath"
}

