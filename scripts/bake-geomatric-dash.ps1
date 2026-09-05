# e1 거제 야호 — 캐릭터 원본 png 를 게임이 쓰는 webp 로 굽는다.
#
# 하는 일은 세 가지다.
#   1) 투명 여백을 자른다. 원점이 그림 정중앙이 되어야 게임 쪽에서 발끝을 맞출 수 있다.
#   2) 가장자리 색을 투명 쪽으로 번지게 한다. webp 손실 압축이 실루엣에 테두리를 남기지 않는다.
#   3) 긴 변을 MaxSide 로 줄여 굽는다. 게임 표시 높이(92~104)의 네 배 남짓이라 화면이 커져도 뭉개지지 않는다.
#
# webp 인코더로는 libwebp(cwebp) 대신 이미 깔려 있는 크롬을 쓴다. 캔버스에 그린 뒤
# toDataURL('image/webp', q) 로 받는데, 알파를 그대로 살리고 화질도 cwebp -q 92 와 같은 급이다.
#
# 원본 그림을 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # 굽고 싶은 밈 에셋 세트. 비우면 기본 세트, "woni" 면 하위 폴더 woni 안의 원본을 굽는다.
  [string]$Variant = "",
  # 구운 텍스처의 긴 변 픽셀 수.
  [int]$MaxSide = 416,
  # webp 품질. 부드러운 채색 원본이라 0.92면 눈으로 원본과 구분되지 않는다.
  [double]$Quality = .92
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\geomatric dash"
if ($Variant) { $artRoot = Join-Path $artRoot $Variant }
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e1-dash-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

# 굽는 차례. 이름이 곧 manifest.js 의 역할 이름이고 게임은 e1:<이름> 텍스처로 읽는다.
$roles = @(
  @{ Key = "run";  Note = "기본 이동" },
  @{ Key = "jump"; Note = "중력 뒤집기(공중)" },
  @{ Key = "hurt"; Note = "장애물 부딪침" },
  @{ Key = "fall"; Note = "실패 시 주저앉음" },
  @{ Key = "goal"; Note = "골지점 표시" }
)

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

# ── 자르기 · 번지기 · 줄이기 ────────────────────────────────────────
$trimmerSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class DashPoseTrimmer
{
    // 이 알파 위쪽만 그림이 있는 것으로 본다(여백 자르기 기준).
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

    /* 한 장을 자르고 줄여 pngPath 에 쓴다. 돌려주는 문자열은 "원본가로 원본세로 결과가로 결과세로". */
    public static string Trim(string sourcePath, string pngPath, int maxSide)
    {
        int width, height;
        byte[] source = ReadBgra(sourcePath, out width, out height);

        int x0 = width, y0 = height, x1 = -1, y1 = -1;
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                if (source[(y * width + x) * 4 + 3] >= TrimAlpha)
                {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
        if (x1 < 0) throw new Exception(sourcePath + " 에 그림이 없다.");

        int tw = x1 - x0 + 1, th = y1 - y0 + 1;
        byte[] trimmed = new byte[tw * th * 4];
        for (int y = 0; y < th; y++)
            Buffer.BlockCopy(source, ((y + y0) * width + x0) * 4, trimmed, y * tw * 4, tw * 4);
        Bleed(trimmed, tw, th);

        double scale = (double)maxSide / Math.Max(tw, th);
        int ow = Math.Max(1, (int)Math.Round(tw * scale));
        int oh = Math.Max(1, (int)Math.Round(th * scale));
        using (Bitmap src = ToBitmap(trimmed, tw, th))
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
        return tw + " " + th + " " + ow + " " + oh;
    }
}
'@

Add-Type -TypeDefinition $trimmerSource -ReferencedAssemblies System.Drawing

$baked = @()
foreach ($role in $roles) {
  $sourcePath = Join-Path $artRoot ($role.Key + ".png")
  if (-not (Test-Path $sourcePath)) { throw "원본이 없다: $sourcePath" }
  $tempPng = Join-Path $tempRoot ($role.Key + ".png")
  $size = [DashPoseTrimmer]::Trim($sourcePath, $tempPng, $MaxSide).Split(" ")
  $baked += [pscustomobject]@{
    Key = $role.Key; Note = $role.Note; Png = $tempPng; Source = $sourcePath
    SourceW = [int]$size[0]; SourceH = [int]$size[1]; Width = [int]$size[2]; Height = [int]$size[3]
  }
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
  $socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
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
  foreach ($record in $baked) {
    $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($record.Png))
    $quality = $Quality.ToString([Globalization.CultureInfo]::InvariantCulture)
    $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
    if (-not $webp64) { throw "webp 인코딩 실패: $($record.Key)" }
    $webpPath = Join-Path $artRoot ($record.Key + ".webp")
    [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))
    "{0,-5} {1,-18} {2,4}x{3,-4} <- {4,4}x{5,-5} png {6,9:N0} -> webp {7,7:N0}" -f `
      $record.Key, $record.Note, $record.Width, $record.Height, $record.SourceW, $record.SourceH, `
      (Get-Item $record.Source).Length, (Get-Item $webpPath).Length
  }
  ""
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
