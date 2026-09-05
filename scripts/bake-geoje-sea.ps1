# e1 중력 대쉬 — 배경 원본 png 를 게임이 쓰는 webp 로 굽는다.
#
# 하는 일은 두 가지다.
#   1) 필드와 같은 16:9 로 맞춰 Width×Height 로 줄인다. 원본(1672×941)이 이미 거의 16:9라
#      늘어나거나 잘리는 곳이 눈에 띄지 않는다.
#   2) webp 로 굽는다. 통로 밖은 벽이 덮으므로 화면에 뜨는 것은 가운데 띠뿐이지만,
#      배경은 필드를 통째로 덮는 한 장이라 전체를 그대로 굽는다.
#
# webp 인코더로는 libwebp(cwebp) 대신 이미 깔려 있는 크롬을 쓴다 —
# scripts/bake-geomatric-dash.ps1 과 같은 방식이다. 캔버스에 그린 뒤
# toDataURL('image/webp', q) 로 받는다.
#
# 원본 그림을 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # 구운 텍스처 크기. 필드(920×517.5)의 1.5배 남짓이라 화면이 커져도 뭉개지지 않는다.
  [int]$Width = 1440,
  [int]$Height = 810,
  # webp 품질. 사진이 아니라 부드러운 채색 그림이라 0.9면 눈으로 원본과 구분되지 않는다.
  [double]$Quality = .9
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\geomatric dash"
$sourcePath = Join-Path $artRoot "geoje-sea.png"
if (-not (Test-Path $sourcePath)) { throw "원본이 없다: $sourcePath" }
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e1-backdrop-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

if (-not $Chrome) {
  $candidates = @(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
  )
  foreach ($candidate in $candidates) { if (Test-Path $candidate) { $Chrome = $candidate; break } }
  if (-not $Chrome) {
    $found = Get-Command chrome -ErrorAction SilentlyContinue
    if ($found) { $Chrome = $found.Source }
  }
}
if (-not $Chrome -or -not (Test-Path $Chrome)) {
  throw "크롬을 찾지 못했다. -Chrome 으로 chrome.exe 경로를 넘겨라."
}

# ── 16:9 로 줄이기 ──────────────────────────────────────────────────
Add-Type -AssemblyName System.Drawing
$tempPng = Join-Path $tempRoot "backdrop.png"
$source = [Drawing.Image]::FromFile($sourcePath)
$sourceW = $source.Width; $sourceH = $source.Height
$canvas = New-Object Drawing.Bitmap $Width, $Height
$graphics = [Drawing.Graphics]::FromImage($canvas)
$graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage($source, (New-Object Drawing.Rectangle 0, 0, $Width, $Height))
$graphics.Dispose(); $source.Dispose()
$canvas.Save($tempPng, [Drawing.Imaging.ImageFormat]::Png)
$canvas.Dispose()

# ── 크롬으로 webp 굽기 ──────────────────────────────────────────────
$userDataDir = Join-Path $tempRoot "chrome"
$browser = Start-Process -FilePath $Chrome -WindowStyle Hidden -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", "--user-data-dir=`"$userDataDir`"", "about:blank"
)
$socket = [Net.WebSockets.ClientWebSocket]::new()
$socket.Options.Proxy = [Net.WebProxy]::new()
$script:requestId = 0
function Send-Cdp($method, $parameters = @{}) {
  $script:requestId++
  $id = $script:requestId
  $json = @{ id = $id; method = $method; params = $parameters } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $timeout = [Threading.CancellationTokenSource]::new(60000)
  try {
    $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $timeout.Token).GetAwaiter().GetResult()
    do {
      $stream = [IO.MemoryStream]::new()
      do {
        $buffer = [byte[]]::new(65536)
        $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $timeout.Token).GetAwaiter().GetResult()
        $stream.Write($buffer, 0, $received.Count)
      } while (!$received.EndOfMessage)
      $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
      $stream.Dispose()
    } while ($message.id -ne $id)
    if ($message.error) { throw ($message.error | ConvertTo-Json) }
    return $message.result
  } finally { $timeout.Dispose() }
}
function Evaluate($expression) {
  $result = Send-Cdp "Runtime.evaluate" @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
  if ($result.exceptionDetails) { throw ($result.exceptionDetails | ConvertTo-Json -Depth 10) }
  return $result.result.value
}
try {
  $portFile = Join-Path $userDataDir "DevToolsActivePort"
  for ($i = 0; $i -lt 100 -and !(Test-Path $portFile); $i++) { Start-Sleep -Milliseconds 100 }
  if (!(Test-Path $portFile)) { throw "크롬이 뜨지 않았다." }
  $port = (Get-Content $portFile)[0]
  $client = [Net.WebClient]::new()
  $client.Proxy = $null
  try {
    for ($i = 0; $i -lt 30; $i++) {
      try { $pages = $client.DownloadString("http://127.0.0.1:$port/json") | ConvertFrom-Json; break }
      catch { if ($i -eq 29) { throw }; Start-Sleep -Milliseconds 100 }
    }
  } finally { $client.Dispose() }
  $page = $pages | Where-Object type -eq "page" | Select-Object -First 1
  $socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  Send-Cdp "Runtime.enable" | Out-Null

  $encoder = @'
window.toWebp = (dataUrl, quality) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(image, 0, 0);
    const out = canvas.toDataURL('image/webp', quality);
    if (!out.startsWith('data:image/webp')) { reject(new Error('webp 인코더가 없다')); return; }
    resolve(out.slice(out.indexOf(',') + 1));
  };
  image.onerror = () => reject(new Error('원본 png 를 읽지 못했다'));
  image.src = dataUrl;
});
'@
  Evaluate $encoder | Out-Null

  $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tempPng))
  $quality = $Quality.ToString([Globalization.CultureInfo]::InvariantCulture)
  $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
  if (-not $webp64) { throw "webp 인코딩 실패: geoje-sea" }
  $webpPath = Join-Path $artRoot "geoje-sea.webp"
  [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))

  ""
  "{0,-10} {1,4}x{2,-4} <- {3,4}x{4,-5} png {5,9:N0} -> webp {6,7:N0}" -f `
    "geoje-sea", $Width, $Height, $sourceW, $sourceH, `
    (Get-Item $sourcePath).Length, (Get-Item $webpPath).Length
  ""
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
