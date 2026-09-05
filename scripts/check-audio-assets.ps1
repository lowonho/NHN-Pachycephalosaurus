$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$tuningPath = Join-Path $projectRoot "js/audio/audio-tuning.js"
$manifestPath = Join-Path $projectRoot "js/assets/audio-manifest.js"
$soundRoot = Join-Path $projectRoot "sounds"
$ignored = @("sounds/bgm/e9 우당탕탕 밈축제5.mp3")

$source = [IO.File]::ReadAllText($tuningPath) + [Environment]::NewLine + [IO.File]::ReadAllText($manifestPath)
$source = (($source -split '[\r\n]+') | Where-Object { $_ -notmatch '^[ ]*//' }) -join [Environment]::NewLine
$pattern = '["](sounds/[^"]+[.](?:mp3|ogg|wav))["]'
$matches = [Text.RegularExpressions.Regex]::Matches($source, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
$configured = @($matches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$missing = @()

Write-Output "CONFIGURED AUDIO"
foreach ($relative in $configured) {
  $fullPath = Join-Path $projectRoot ($relative -replace '/', [IO.Path]::DirectorySeparatorChar)
  $exists = Test-Path -LiteralPath $fullPath -PathType Leaf
  if (!$exists) { $missing += $relative }
  [pscustomobject]@{ Status = $(if ($exists) { "OK" } else { "MISSING" }); Path = $relative }
}

$configuredAbsolute = @($configured | ForEach-Object {
  [IO.Path]::GetFullPath((Join-Path $projectRoot ($_ -replace '/', [IO.Path]::DirectorySeparatorChar)))
})
$unassigned = @(Get-ChildItem -LiteralPath $soundRoot -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Extension -match '^[.](mp3|ogg|wav)$' -and $_.Name -notlike 'e9 *' -and
      ($configuredAbsolute -notcontains $_.FullName)
  })

if ($unassigned.Count) {
  Write-Output ([Environment]::NewLine + "UNASSIGNED AUDIO")
  $unassigned | ForEach-Object { $_.FullName.Substring($projectRoot.Length + 1) }
}

Write-Output ([Environment]::NewLine + "SUMMARY")
Write-Output "Configured: $($configured.Count) / Missing: $($missing.Count) / Unassigned: $($unassigned.Count) / Ignored: $($ignored.Count)"
if ($missing.Count) { exit 1 }
