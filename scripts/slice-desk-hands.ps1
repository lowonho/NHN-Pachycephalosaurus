# 스테이지 선택 화면의 책상 위 양손을 좌/우 한 짝씩 잘라 webp로 굽는다.
#
# 원본은 손 두 짝이 한 장에 들어 있는 2048폭 PNG다
# (assets/images/ui/stage select/female_hands_nailart_2048x1152.png).
# index.html은 이 원본을 그대로 쓰지 않고 여기서 나온 조각 두 장을 쓴다.
# 한 장이면 입력이 들어올 때 두 손이 통째로 같이 흔들려 어색해서, 좌우를
# 따로 두고 타자 애니메이션 주기를 어긋나게 준다(css/protocol-select.css).
#
# 자를 위치는 알파 채널 투영으로 찾는다. 두 손 사이는 완전히 비어 있으므로
# 그 빈 열 구간이 곧 경계다. 각 조각은 자기 알파 경계상자에 딱 맞게 잘린다
# ─ 그래서 조각의 윗변은 언제나 손끝, 아랫변은 화면 밖으로 나가는 팔뚝이다.
# 원본을 다시 그리면 이 스크립트를 다시 돌리고, index.html의 width/height
# 속성을 출력된 크기로 맞춰 주면 된다.

param(
  [string]$Source = "female_hands_nailart_2048x1152.png",
  [string]$LeftName = "04a_nailart_hand_left",
  [string]$RightName = "04b_nailart_hand_right",
  # webp 화질. 기존 조각들과 같은 기준이다(scripts/slice-settings-sheet.ps1 참고).
  [int]$Quality = 92
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$sceneRoot = Join-Path $projectRoot "assets\images\ui\stage select"
$sourcePath = Join-Path $sceneRoot $Source
if (-not (Test-Path $sourcePath)) { throw "원본을 찾지 못했다: $sourcePath" }

Add-Type -AssemblyName System.Drawing

$sliceSource = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class DeskHandSlicer
{
    // 이보다 옅은 픽셀은 글로우 잔여물로 보고 경계상자에서 뺀다.
    const int AlphaThreshold = 8;

    static byte[] ReadAlpha(string path, out int width, out int height)
    {
        using (Bitmap bmp = new Bitmap(path))
        {
            width = bmp.Width;
            height = bmp.Height;
            BitmapData data = bmp.LockBits(
                new Rectangle(0, 0, width, height),
                ImageLockMode.ReadOnly,
                PixelFormat.Format32bppArgb);
            byte[] raw = new byte[Math.Abs(data.Stride) * height];
            Marshal.Copy(data.Scan0, raw, 0, raw.Length);
            bmp.UnlockBits(data);

            byte[] alpha = new byte[width * height];
            for (int y = 0; y < height; y++)
                for (int x = 0; x < width; x++)
                    alpha[y * width + x] = raw[y * data.Stride + x * 4 + 3];
            return alpha;
        }
    }

    // 두 손의 경계상자를 "x,y,w,h" 두 줄로 돌려준다(왼쪽 먼저).
    public static string[] FindHands(string path)
    {
        int width, height;
        byte[] alpha = ReadAlpha(path, out width, out height);

        int[] columns = new int[width];
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                if (alpha[y * width + x] >= AlphaThreshold) columns[x]++;

        // 가장 넓은 빈 열 구간이 두 손 사이의 틈이다.
        int gapStart = -1, gapEnd = -1, runStart = -1;
        for (int x = 0; x <= width; x++)
        {
            bool empty = x < width && columns[x] == 0;
            if (empty) { if (runStart < 0) runStart = x; }
            else if (runStart >= 0)
            {
                if (x - runStart > gapEnd - gapStart) { gapStart = runStart; gapEnd = x - 1; }
                runStart = -1;
            }
        }
        if (gapStart <= 0 || gapEnd >= width - 1)
            throw new Exception("두 손 사이의 빈 열을 찾지 못했다. 원본이 정말 두 짝인지 확인하라.");

        return new string[] {
            Box(alpha, width, height, 0, gapStart - 1),
            Box(alpha, width, height, gapEnd + 1, width - 1)
        };
    }

    static string Box(byte[] alpha, int width, int height, int x0, int x1)
    {
        int minX = int.MaxValue, minY = int.MaxValue, maxX = -1, maxY = -1;
        for (int y = 0; y < height; y++)
            for (int x = x0; x <= x1; x++)
                if (alpha[y * width + x] >= AlphaThreshold)
                {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
        if (maxX < 0) throw new Exception("빈 조각이 나왔다. 원본 알파를 확인하라.");
        return minX + "," + minY + "," + (maxX - minX + 1) + "," + (maxY - minY + 1);
    }

    public static void Crop(string sourcePath, string targetPath, int x, int y, int width, int height)
    {
        using (Bitmap source = new Bitmap(sourcePath))
        using (Bitmap cropped = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        using (Graphics graphics = Graphics.FromImage(cropped))
        {
            graphics.Clear(Color.Transparent);
            graphics.DrawImage(
                source,
                new Rectangle(0, 0, width, height),
                new Rectangle(x, y, width, height),
                GraphicsUnit.Pixel);
            cropped.Save(targetPath, ImageFormat.Png);
        }
    }
}
'@

Add-Type -TypeDefinition $sliceSource -ReferencedAssemblies System.Drawing

$boxes = [DeskHandSlicer]::FindHands($sourcePath)
$names = @($LeftName, $RightName)
$sizes = @{}

for ($index = 0; $index -lt 2; $index++) {
  $box = $boxes[$index].Split(",")
  $pngPath = Join-Path $sceneRoot ($names[$index] + ".png")
  [DeskHandSlicer]::Crop($sourcePath, $pngPath, [int]$box[0], [int]$box[1], [int]$box[2], [int]$box[3])
  $sizes[$names[$index]] = @([int]$box[2], [int]$box[3])
  "{0,-24} {1,4}x{2,-4} (원본 x={3}, y={4})" -f $names[$index], $box[2], $box[3], $box[0], $box[1]
}

# ── webp 굽기 ────────────────────────────────────────────────────────
#
# 실제로 로드하는 건 webp 쪽이다(index.html). png는 자른 원본으로 남긴다.
# cwebp가 PATH에 있으면 그걸 쓰고, 없으면 헤드리스 크롬의 캔버스 인코더로
# 굽는다(이 저장소에는 node·cwebp·ImageMagick이 없다 ─ tests/minigame-browser.ps1
# 과 같은 CDP 연결 방식이다). 둘 다 알파를 살린 손실 webp를 낸다.

$script:requestId = 0
$script:socket = $null

function Send-Cdp($method, $parameters = @{}) {
  $script:requestId++
  $id = $script:requestId
  $json = @{ id = $id; method = $method; params = $parameters } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $timeout = [Threading.CancellationTokenSource]::new(60000)
  try {
    # GetResult()가 VoidTaskResult를 뱉는다. 삼키지 않으면 함수 반환값에 섞인다.
    [void]$script:socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $timeout.Token).GetAwaiter().GetResult()
    do {
      $stream = [IO.MemoryStream]::new()
      do {
        $buffer = [byte[]]::new(65536)
        $received = $script:socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $timeout.Token).GetAwaiter().GetResult()
        $stream.Write($buffer, 0, $received.Count)
      } while (!$received.EndOfMessage)
      $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
      $stream.Dispose()
    } while ($message.id -ne $id)
    if ($message.error) { throw ($message.error | ConvertTo-Json) }
    return $message.result
  } finally { $timeout.Dispose() }
}

function Invoke-CwebpBake($cwebpPath) {
  foreach ($name in $names) {
    $pngPath = Join-Path $sceneRoot "$name.png"
    $webpPath = Join-Path $sceneRoot "$name.webp"
    & $cwebpPath -quiet -q $Quality -alpha_q 100 -m 6 -sharp_yuv $pngPath -o $webpPath
    if ($LASTEXITCODE -ne 0) { throw "cwebp 실패: $name" }
  }
}

function Invoke-ChromeBake {
  $chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"
  if (-not (Test-Path $chrome)) { throw "크롬을 찾지 못해 webp를 굽지 못했다: $chrome" }

  # 캔버스를 오염시키지 않으려고 png를 data: URI로 심는다. file:// 이미지는
  # 같은 출처로 쳐 주지 않아서 toDataURL이 막힌다.
  $builder = [Text.StringBuilder]::new()
  [void]$builder.Append('<!doctype html><meta charset="utf-8"><body>')
  foreach ($name in $names) {
    $bytes = [IO.File]::ReadAllBytes((Join-Path $sceneRoot "$name.png"))
    [void]$builder.Append('<img id="' + $name + '" src="data:image/png;base64,')
    [void]$builder.Append([Convert]::ToBase64String($bytes))
    [void]$builder.Append('">')
  }
  [void]$builder.Append('</body>')
  $pagePath = Join-Path ([IO.Path]::GetTempPath()) ("desk-hands-" + [guid]::NewGuid() + ".html")
  [IO.File]::WriteAllText($pagePath, $builder.ToString(), [Text.UTF8Encoding]::new($false))

  [Net.WebRequest]::DefaultWebProxy = $null
  $userDataDir = Join-Path ([IO.Path]::GetTempPath()) ("desk-hands-" + [guid]::NewGuid())
  $browser = Start-Process -FilePath $chrome -WindowStyle Hidden -PassThru -ArgumentList @(
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--user-data-dir=`"$userDataDir`"", "about:blank"
  )
  $script:socket = [Net.WebSockets.ClientWebSocket]::new()
  $script:socket.Options.Proxy = [Net.WebProxy]::new()

  try {
    $portFile = Join-Path $userDataDir "DevToolsActivePort"
    for ($i = 0; $i -lt 100 -and !(Test-Path $portFile); $i++) { Start-Sleep -Milliseconds 100 }
    if (-not (Test-Path $portFile)) { throw "크롬이 디버깅 포트를 열지 않았다." }
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
    [void]$script:socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    Send-Cdp "Page.enable" | Out-Null
    Send-Cdp "Runtime.enable" | Out-Null
    Send-Cdp "Page.navigate" @{ url = ([Uri]$pagePath).AbsoluteUri } | Out-Null

    $quality = ($Quality / 100.0).ToString([Globalization.CultureInfo]::InvariantCulture)
    foreach ($name in $names) {
      $expression = @"
(async () => {
  const image = document.getElementById('$name');
  if (!image) throw new Error('아직 로드 전');
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' });
  context.drawImage(image, 0, 0);
  const url = canvas.toDataURL('image/webp', $quality);
  if (!url.startsWith('data:image/webp')) throw new Error('크롬이 webp로 굽지 않았다: ' + url.slice(0, 32));
  return url.slice(url.indexOf(',') + 1);
})()
"@
      $result = $null
      for ($i = 0; $i -lt 100; $i++) {
        $result = Send-Cdp "Runtime.evaluate" @{ expression = $expression; returnByValue = $true; awaitPromise = $true }
        if (-not $result.exceptionDetails) { break }
        Start-Sleep -Milliseconds 100
      }
      if ($result.exceptionDetails) { throw ($result.exceptionDetails | ConvertTo-Json -Depth 10) }
      [IO.File]::WriteAllBytes((Join-Path $sceneRoot "$name.webp"), [Convert]::FromBase64String($result.result.value))
    }
  } finally {
    if ($script:socket.State -eq [Net.WebSockets.WebSocketState]::Open) {
      [void]$script:socket.CloseAsync([Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    }
    $script:socket.Dispose()
    if ($browser -and -not $browser.HasExited) { $browser.Kill() }
    Remove-Item $pagePath -Force -ErrorAction SilentlyContinue
    Remove-Item $userDataDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$cwebp = Get-Command cwebp -ErrorAction SilentlyContinue
if ($cwebp) { Invoke-CwebpBake $cwebp.Source } else { Invoke-ChromeBake }

""
foreach ($name in $names) {
  $pngPath = Join-Path $sceneRoot "$name.png"
  $webpPath = Join-Path $sceneRoot "$name.webp"
  "{0,-24} png {1,9:N0} -> webp {2,8:N0}   (index.html width={3} height={4})" -f `
    $name, (Get-Item $pngPath).Length, (Get-Item $webpPath).Length, $sizes[$name][0], $sizes[$name][1]
}
