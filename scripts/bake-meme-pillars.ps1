# e6 중력 비행 — 통로를 막는 밈 글자 기둥과 골지점 표지를 게임이 쓰는 webp 로 굽는다.
#
# 원본은 assets/images/minigame/geomatric fly 의 '<낱말>_세로.png' 여섯 장과 goal.png 이다.
# 낱말 한 장에 한 낱말이 세로로 조판되어 있고, 배경은 모두 이미 지워져 있다(알파 컷아웃).
# 하는 일은 세 가지다.
#   1) 알파가 있는 자리만 남기고 빈 여백을 잘라 낸다 — 기둥 높이가 글자 높이와 같아야
#      벽에서 나온 길이(판정)와 눈에 보이는 글자가 어긋나지 않는다.
#   2) 가장자리 색을 투명 쪽으로 번지게 한다. webp 손실 압축이 실루엣에 테두리를 남기지 않는다.
#   3) 긴 변을 MaxSide 로 줄여 굽는다. 게임에서 가장 큰 기둥이 229 이므로 그 두 배 남짓이면
#      큰 모니터에서도 뭉개지지 않는다.
#
# webp 인코더는 scripts/bake-oiia-cat.ps1 과 같다 — libwebp(cwebp) 대신 이미 깔려 있는
# 크롬의 캔버스 toDataURL('image/webp', q) 를 쓴다. 알파를 그대로 살린다.
#
# 원본을 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # 구운 텍스처의 긴 변 픽셀 수.
  [int]$MaxSide = 560,
  # webp 품질. 광택이 심한 원본이라 0.9 아래로 내리면 띠가 진다.
  [double]$Quality = .92
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\geomatric fly"

# 원본 이름 → manifest.js 의 역할 이름. 게임은 e6:<역할> 로 읽고, 역할 이름은 URL 에 그대로
# 들어가므로 아스키로 둔다(원본 파일 이름은 한글이라 %ED%... 로 새어 나간다).
$pillars = [ordered]@{
  "여러분_세로.png"   = "word-yeoreobun"
  "저됐어요_세로.png" = "word-jeodwaess"
  "뭣됐어요_세로.png" = "word-mwotdwaess"
  "샤갈_세로.png"     = "word-shagal"
  "야르_세로.png"     = "word-yareu"
  "아자스!_세로.png"  = "word-ajaseu"
  # 골지점 표지. e1 중력 대쉬와 같이 통로 한가운데에서 통통 튄다.
  "goal.png"          = "goal"
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e6-meme-" + [guid]::NewGuid())
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

# ── 여백 자르기 · 번지기 · 줄이기 ───────────────────────────────────
$trimmerSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class MemePillarTrimmer
{
    // 이 알파 위쪽만 그림이 있는 것으로 본다.
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

    /* 한 장을 잘라 줄여 pngPath 에 쓴다.
       돌려주는 문자열은 "원본가로 원본세로 자른가로 자른세로 결과가로 결과세로". */
    public static string Trim(string sourcePath, string pngPath, int maxSide)
    {
        int width, height;
        byte[] px = ReadBgra(sourcePath, out width, out height);

        int x0 = width, y0 = height, x1 = -1, y1 = -1;
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                if (px[(y * width + x) * 4 + 3] >= TrimAlpha)
                {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
        if (x1 < 0) throw new Exception(sourcePath + " 에 그림이 없다.");

        int tw = x1 - x0 + 1, th = y1 - y0 + 1;
        byte[] cell = new byte[tw * th * 4];
        for (int y = 0; y < th; y++)
            Buffer.BlockCopy(px, ((y + y0) * width + x0) * 4, cell, y * tw * 4, tw * 4);
        Bleed(cell, tw, th);

        double scale = (double)maxSide / Math.Max(tw, th);
        if (scale > 1) scale = 1;                    // 원본보다 키우지는 않는다.
        int ow = Math.Max(1, (int)Math.Round(tw * scale));
        int oh = Math.Max(1, (int)Math.Round(th * scale));

        using (Bitmap src = ToBitmap(cell, tw, th))
        using (Bitmap dst = new Bitmap(ow, oh, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(dst))
            using (ImageAttributes attributes = new ImageAttributes())
            {
                // 가장자리를 되접어 읽어, 줄일 때 테두리가 투명 쪽으로 새지 않게 한다.
                attributes.SetWrapMode(System.Drawing.Drawing2D.WrapMode.TileFlipXY);
                g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                g.DrawImage(src, new Rectangle(0, 0, ow, oh), 0, 0, tw, th, GraphicsUnit.Pixel, attributes);
            }
            byte[] outPx = new byte[ow * oh * 4];
            BitmapData data = dst.LockBits(new Rectangle(0, 0, ow, oh),
                ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            for (int y = 0; y < oh; y++)
                Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), outPx, y * ow * 4, ow * 4);
            dst.UnlockBits(data);
            // 줄이면서 다시 생긴 반투명 가장자리도 한 번 더 색을 채워 둔다.
            Bleed(outPx, ow, oh);
            using (Bitmap final = ToBitmap(outPx, ow, oh)) final.Save(pngPath, ImageFormat.Png);
        }
        return width + " " + height + " " + tw + " " + th + " " + ow + " " + oh;
    }
}
'@

Add-Type -TypeDefinition $trimmerSource -ReferencedAssemblies System.Drawing

$jobs = @()
foreach ($entry in $pillars.GetEnumerator()) {
  $sourcePath = Join-Path $artRoot $entry.Key
  if (-not (Test-Path $sourcePath)) { throw "원본이 없다: $sourcePath" }
  $tempPng = Join-Path $tempRoot ($entry.Value + ".png")
  $size = [MemePillarTrimmer]::Trim($sourcePath, $tempPng, $MaxSide).Split(" ")
  $jobs += [pscustomobject]@{
    Key = $entry.Value; Source = $sourcePath; Png = $tempPng
    Ratio = [Math]::Round([double]$size[4] / [double]$size[5], 3)
    Note = "{0}x{1} → 자른 {2}x{3} → 굽는 {4}x{5}" -f $size[0], $size[1], $size[2], $size[3], $size[4], $size[5]
  }
  "{0,-16} {1}" -f $entry.Value, $jobs[-1].Note
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
  foreach ($job in $jobs) {
    $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($job.Png))
    $quality = $Quality.ToString([Globalization.CultureInfo]::InvariantCulture)
    $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
    if (-not $webp64) { throw "webp 인코딩 실패: $($job.Key)" }
    $webpPath = Join-Path $artRoot ($job.Key + ".webp")
    [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))
    $total += (Get-Item $webpPath).Length
    "{0,-16} 가로/세로 {1,-6}  원본 {2,9:N0} -> webp {3,7:N0}" -f `
      $job.Key, $job.Ratio, (Get-Item $job.Source).Length, (Get-Item $webpPath).Length
  }
  ""
  "구운 그림 {0}장 합계 {1:N0} 바이트" -f $jobs.Count, $total
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
