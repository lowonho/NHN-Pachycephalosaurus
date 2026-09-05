# e1 중력 대쉬 — 노란 가시로 쓰는 '거제'·'야호' 네 글자를 webp 로 굽는다.
#
# 원본은 obstacle 폴더의 낱글자 png 네 장(geo·je·ya·ho)이고, 캔버스 크기도 글자가
# 차지하는 넓이도 제각각이다. 게임은 이 넷을 한 변 길이 하나(SPIKE_ART)로만 그리므로
# 여기서 미리 같은 칸에 앉혀 둔다. 하는 일은 네 가지다.
#   1) 네 장을 각자 알파 경계로 자른다.
#   2) 넷 중 가장 큰 변을 한 칸(em)으로 삼아, 네 장 모두를 같은 배율로 줄인다.
#      글자마다 따로 맞추면 '거'와 '제'의 크기가 달라져 한 낱말로 읽히지 않는다.
#   3) 정사각 칸 한가운데에 앉힌다. 남는 자리는 투명이라 낱말로 세워도 자간이 남는다.
#   4) 가장자리 색을 투명 쪽으로 번지게 한다. webp 손실 압축이 네온 테두리에 띠를 남기지 않는다.
# 그리고 글자마다 어두운 짝(<이름>-dim)을 한 장 더 굽는다. 아직 벽에 붙어 있는 가시에 쓰는
# 그림이라 예전 삼각형의 갈색(0xb08341)만큼 죽인 색이다. 스프라이트를 tint 로 물들이는
# 방법은 못 쓴다 — index.html 을 파일로 직접 열면 Phaser.CANVAS 로 뜨는데(js/archive/game.mjs)
# 캔버스 렌더러는 tint 를 조용히 무시한다. 그래서 어두운 쪽을 아예 텍스처로 구워 둔다.
#
# webp 인코더는 scripts/bake-dash-run.ps1 과 같다 — libwebp(cwebp) 대신 이미 깔려 있는
# 크롬의 캔버스 toDataURL('image/webp', q) 를 쓴다. 알파를 그대로 살린다.
#
# 원본 글자를 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # 구운 텍스처 한 변의 픽셀 수. 게임 표시 크기(46)의 세 배라 화면이 커져도 뭉개지지 않는다.
  [int]$MaxSide = 144,
  # webp 품질. 매끈한 네온 원본이라 0.92면 눈으로 원본과 구분되지 않는다.
  [double]$Quality = .92
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\geomatric dash\obstacle"
# 굽는 차례. 이름이 곧 manifest.js 의 역할 이름이고 게임은 e1:geo … e1:ho 로 읽는다.
$keys = @("geo", "je", "ya", "ho")
$sources = $keys | ForEach-Object {
  $path = Join-Path $artRoot ($_ + ".png")
  if (-not (Test-Path $path)) { throw "원본 글자가 없다: $path" }
  $path
}
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e1-obstacle-" + [guid]::NewGuid())
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

# ── 자르기 · 공통 배율 · 정사각 칸에 앉히기 · 번지기 ────────────────
$letterSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class LetterBaker
{
    // 이 알파 위쪽만 글자가 있는 것으로 본다(자르는 경계).
    const int TrimAlpha = 16;
    // 이 알파 위쪽 픽셀의 색만 믿고 나머지로 번지게 한다.
    const int OpaqueAlpha = 250;
    // 색을 바깥으로 몇 겹 번지게 할지.
    const int BleedPasses = 8;

    static byte[] ReadBgra(string path, out int width, out int height)
    {
        using (Bitmap bmp = new Bitmap(path))
        {
            width = bmp.Width;
            height = bmp.Height;
            BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height),
                ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            byte[] raw = new byte[Math.Abs(data.Stride) * height];
            Marshal.Copy(data.Scan0, raw, 0, raw.Length);
            bmp.UnlockBits(data);

            byte[] px = new byte[width * height * 4];
            for (int y = 0; y < height; y++)
                Buffer.BlockCopy(raw, y * data.Stride, px, y * width * 4, width * 4);
            return px;
        }
    }

    static Bitmap ToBitmap(byte[] px, int width, int height)
    {
        Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height),
            ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        for (int y = 0; y < height; y++)
            Marshal.Copy(px, y * width * 4, IntPtr.Add(data.Scan0, y * data.Stride), width * 4);
        bmp.UnlockBits(data);
        return bmp;
    }

    // 투명·반투명 픽셀의 색을 이웃한 불투명 픽셀 색으로 덮는다. 알파는 건드리지 않는다.
    static void Bleed(byte[] px, int width, int height)
    {
        bool[] known = new bool[width * height];
        for (int i = 0; i < known.Length; i++) known[i] = px[i * 4 + 3] >= OpaqueAlpha;

        for (int pass = 0; pass < BleedPasses; pass++)
        {
            List<int> filled = new List<int>();
            for (int y = 0; y < height; y++)
                for (int x = 0; x < width; x++)
                {
                    int i = y * width + x;
                    if (known[i]) continue;
                    int b = 0, g = 0, r = 0, n = 0;
                    for (int dy = -1; dy <= 1; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            int nx = x + dx, ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            int j = ny * width + nx;
                            if (!known[j]) continue;
                            b += px[j * 4]; g += px[j * 4 + 1]; r += px[j * 4 + 2]; n++;
                        }
                    if (n == 0) continue;
                    px[i * 4] = (byte)(b / n); px[i * 4 + 1] = (byte)(g / n); px[i * 4 + 2] = (byte)(r / n);
                    filled.Add(i);
                }
            if (filled.Count == 0) break;
            foreach (int i in filled) known[i] = true;
        }
    }

    /* 벽에 붙어 있는 가시에 쓰는 어두운 짝. 예전 삼각형의 갈색(0xb08341)과 금색(0xffcf7b)의
       채널별 비율 그대로 낮춘다. 알파는 건드리지 않아 실루엣이 달라지지 않는다. */
    const double DimB = 0.53, DimG = 0.64, DimR = 0.69;

    static void Dim(byte[] px)
    {
        for (int i = 0; i < px.Length; i += 4)
        {
            px[i] = (byte)(px[i] * DimB);
            px[i + 1] = (byte)(px[i + 1] * DimG);
            px[i + 2] = (byte)(px[i + 2] * DimR);
        }
    }

    /* 낱글자 png 들을 같은 배율로 줄여 maxSide 정사각 칸 한가운데에 앉히고 pngPaths 에 쓴다.
       같은 그림의 어두운 짝은 dimPaths 에 쓴다.
       돌려주는 문자열은 글자마다 한 줄로 "자른가로 자른세로 앉힌가로 앉힌세로". */
    public static string Bake(string[] srcPaths, string[] pngPaths, string[] dimPaths, int maxSide)
    {
        int count = srcPaths.Length;
        byte[][] src = new byte[count][];
        int[] sw = new int[count], sh = new int[count];
        int[] bx = new int[count], by = new int[count], bw = new int[count], bh = new int[count];
        // 1) 각자 알파 경계로 자른다. 2) 넷 중 가장 큰 변이 한 칸(em)이 된다.
        int em = 1;
        for (int f = 0; f < count; f++)
        {
            src[f] = ReadBgra(srcPaths[f], out sw[f], out sh[f]);
            int x0 = sw[f], y0 = sh[f], x1 = -1, y1 = -1;
            for (int y = 0; y < sh[f]; y++)
                for (int x = 0; x < sw[f]; x++)
                    if (src[f][(y * sw[f] + x) * 4 + 3] >= TrimAlpha)
                    {
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
            if (x1 < 0) throw new Exception(srcPaths[f] + " 에 글자가 없다.");
            bx[f] = x0; by[f] = y0; bw[f] = x1 - x0 + 1; bh[f] = y1 - y0 + 1;
            em = Math.Max(em, Math.Max(bw[f], bh[f]));
        }

        double scale = (double)maxSide / em;
        string report = "";
        for (int f = 0; f < count; f++)
        {
            int tw = bw[f], th = bh[f];
            byte[] cell = new byte[tw * th * 4];
            for (int y = 0; y < th; y++)
                Buffer.BlockCopy(src[f], ((y + by[f]) * sw[f] + bx[f]) * 4, cell, y * tw * 4, tw * 4);
            Bleed(cell, tw, th);

            // 3) 같은 배율로 줄여 정사각 칸 한가운데에 앉힌다.
            int dw = Math.Max(1, (int)Math.Round(tw * scale));
            int dh = Math.Max(1, (int)Math.Round(th * scale));
            int ox = (maxSide - dw) / 2, oy = (maxSide - dh) / 2;

            using (Bitmap source = ToBitmap(cell, tw, th))
            using (Bitmap dst = new Bitmap(maxSide, maxSide, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(dst))
                using (ImageAttributes attributes = new ImageAttributes())
                {
                    // 가장자리를 되접어 읽어, 줄일 때 테두리가 투명 쪽으로 새지 않게 한다.
                    attributes.SetWrapMode(System.Drawing.Drawing2D.WrapMode.TileFlipXY);
                    g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                    g.DrawImage(source, new Rectangle(ox, oy, dw, dh), 0, 0, tw, th, GraphicsUnit.Pixel, attributes);
                }
                byte[] outPx = new byte[maxSide * maxSide * 4];
                BitmapData data = dst.LockBits(new Rectangle(0, 0, maxSide, maxSide),
                    ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                for (int y = 0; y < maxSide; y++)
                    Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), outPx, y * maxSide * 4, maxSide * 4);
                dst.UnlockBits(data);
                // 4) 줄이면서 다시 생긴 반투명 가장자리도 한 번 더 색을 채워 둔다.
                Bleed(outPx, maxSide, maxSide);
                using (Bitmap final = ToBitmap(outPx, maxSide, maxSide)) final.Save(pngPaths[f], ImageFormat.Png);
                Dim(outPx);
                using (Bitmap dim = ToBitmap(outPx, maxSide, maxSide)) dim.Save(dimPaths[f], ImageFormat.Png);
            }
            report += tw + " " + th + " " + dw + " " + dh + "\n";
        }
        return em + "\n" + report;
    }
}
'@

Add-Type -TypeDefinition $letterSource -ReferencedAssemblies System.Drawing

$tempPngs = $keys | ForEach-Object { Join-Path $tempRoot ($_ + ".png") }
$tempDims = $keys | ForEach-Object { Join-Path $tempRoot ($_ + "-dim.png") }
$report = [LetterBaker]::Bake([string[]]$sources, [string[]]$tempPngs, [string[]]$tempDims, $MaxSide).Trim().Split("`n")

""
"한 칸(em) {0}px → 구운 칸 {1}x{1}" -f $report[0].Trim(), $MaxSide
for ($i = 0; $i -lt $keys.Count; $i++) {
  $size = $report[$i + 1].Trim().Split(" ")
  "  {0,-4} 자른 {1,4}x{2,-4} → 앉힌 {3,3}x{4,-3}" -f $keys[$i], $size[0], $size[1], $size[2], $size[3]
}

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
  $socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  Send-Cdp "Runtime.enable" | Out-Null

  # 알파를 그대로 옮기려면 지운 캔버스에 한 장만 그려 넣어야 한다.
  $encoder = @'
window.toWebp = (dataUrl, quality) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  ""
  $total = 0
  $quality = $Quality.ToString([Globalization.CultureInfo]::InvariantCulture)
  for ($i = 0; $i -lt $keys.Count; $i++) {
    # 밝은 쪽(풀려난 가시)과 어두운 쪽(벽에 붙은 가시) 두 장을 나란히 굽는다.
    foreach ($pair in @(@{ Key = $keys[$i]; Png = $tempPngs[$i] }, @{ Key = $keys[$i] + "-dim"; Png = $tempDims[$i] })) {
      $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pair.Png))
      $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
      if (-not $webp64) { throw "webp 인코딩 실패: $($pair.Key)" }
      $webpPath = Join-Path $artRoot ($pair.Key + ".webp")
      [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))
      $total += (Get-Item $webpPath).Length
      "{0,-8} {1,3}x{2,-3}  webp {3,7:N0}" -f $pair.Key, $MaxSide, $MaxSide, (Get-Item $webpPath).Length
    }
  }
  ""
  "여덟 장 합계 {0:N0} 바이트 (원본 네 장 {1:N0})" -f $total, (($sources | ForEach-Object { (Get-Item $_).Length }) | Measure-Object -Sum).Sum
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
