param(
  [Parameter(Mandatory=$true)][string]$FireUp,
  [Parameter(Mandatory=$true)][string]$FireDiagonal,
  [Parameter(Mandatory=$true)][string]$FireDown,
  [Parameter(Mandatory=$true)][string]$Crown,
  [Parameter(Mandatory=$true)][string]$Jena,
  [Parameter(Mandatory=$true)][string]$Foot,
  [Parameter(Mandatory=$true)][string]$Liv,
  [Parameter(Mandatory=$true)][string]$Yaho
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'assets/images/minigame/geomatric dash/memes'
New-Item -ItemType Directory -Force -Path $output | Out-Null

function Split-Sheet([string]$Source, [string]$Prefix, [int]$Frames = 5) {
  $sheet = [Drawing.Bitmap]::FromFile($Source)
  try {
    for ($frame = 0; $frame -lt $Frames; $frame++) {
      $left = [Math]::Floor($frame * $sheet.Width / $Frames)
      $right = [Math]::Floor(($frame + 1) * $sheet.Width / $Frames)
      $width = $right - $left
      $bitmap = New-Object Drawing.Bitmap($width, $sheet.Height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.Clear([Drawing.Color]::Transparent)
          $sourceRect = New-Object Drawing.Rectangle($left, 0, $width, $sheet.Height)
          $targetRect = New-Object Drawing.Rectangle(0, 0, $width, $sheet.Height)
          $graphics.DrawImage($sheet, $targetRect, $sourceRect, [Drawing.GraphicsUnit]::Pixel)
        } finally { $graphics.Dispose() }
        $path = Join-Path $output ("{0}{1}.png" -f $Prefix, ($frame + 1))
        $bitmap.Save($path, [Drawing.Imaging.ImageFormat]::Png)
      } finally { $bitmap.Dispose() }
    }
  } finally { $sheet.Dispose() }
}

Split-Sheet $FireUp 'woni-fire-up'
Split-Sheet $FireDiagonal 'woni-fire-diagonal'
Split-Sheet $FireDown 'woni-fire-down'
Copy-Item -LiteralPath $Crown -Destination (Join-Path $output 'jena-crown.png') -Force
Copy-Item -LiteralPath $Jena -Destination (Join-Path $output 'jena.png') -Force
Copy-Item -LiteralPath $Foot -Destination (Join-Path $output 'liv-foot.png') -Force
Copy-Item -LiteralPath $Liv -Destination (Join-Path $output 'liv.png') -Force
Copy-Item -LiteralPath $Yaho -Destination (Join-Path $output 'yaho.png') -Force
Write-Output "Imported E1 meme assets to $output"
