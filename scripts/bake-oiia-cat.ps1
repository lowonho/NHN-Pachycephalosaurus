# e6 회전 고양이 — oiia 고양이 스프라이트시트를 게임이 쓰는 webp 여섯 장으로 굽는다.
#
# 원본은 가로로 이어 붙인 6프레임짜리 한 장(oiia_cat_spin_6frame_spritesheet.png)이다.
# 하는 일은 네 가지다.
#   1) 가로를 Frames 로 나눠 칸을 뜬다. 칸 크기는 원본 가로/6 이므로 시트를 다시 뽑아도 맞는다.
#   2) 여섯 칸의 그림이 차지하는 영역을 하나로 합쳐, 그 한 사각형으로 모든 칸을 자른다.
#      칸마다 따로 자르면 도는 동안 고양이 중심이 흔들린다 — 회전 축은 여섯 장이 같아야 한다.
#   3) 가장자리 색을 투명 쪽으로 번지게 한다. webp 손실 압축이 실루엣에 테두리를 남기지 않는다.
#   4) 긴 변을 MaxSide 로 줄여 굽는다. 게임 표시 높이(약 66)의 네 배라 화면이 커져도 뭉개지지 않는다.
#
# webp 인코더는 scripts/bake-geomatric-dash.ps1 과 같다 — libwebp(cwebp) 대신 이미 깔려 있는
# 크롬의 캔버스 toDataURL('image/webp', q) 를 쓴다. 알파를 그대로 살린다.
#
# 원본 시트를 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # 시트에 들어 있는 프레임 수. 가로로만 이어 붙어 있다고 본다.
  [int]$Frames = 6,
  # 구운 텍스처의 긴 변 픽셀 수.
  [int]$MaxSide = 280,
  # webp 품질. 부드러운 채색 원본이라 0.92면 눈으로 원본과 구분되지 않는다.
  [double]$Quality = .92
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\geomatric fly"
$sheetPath = Join-Path $artRoot "oiia_cat_spin_6frame_spritesheet.png"
if (-not (Test-Path $sheetPath)) { throw "원본 시트가 없다: $sheetPath" }
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e6-oiia-" + [guid]::NewGuid())
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

# ── 칸 뜨기 · 공통 사각형 자르기 · 번지기 · 줄이기 ──────────────────
$slicerSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class SpinSheetSlicer
{
    // 이 알파 위쪽만 그림이 있는 것으로 본다(공통 사각형 기준).
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

    /* 시트를 잘라 pngPaths 에 한 장씩 쓴다.
       돌려주는 문자열은 "칸가로 칸세로 자른가로 자른세로 결과가로 결과세로". */
    public static string Slice(string sheetPath, string[] pngPaths, int maxSide)
    {
        int width, height;
        byte[] sheet = ReadBgra(sheetPath, out width, out height);
        int frames = pngPaths.Length;
        if (width % frames != 0)
            throw new Exception("시트 가로 " + width + " 가 프레임 수 " + frames + " 로 나누어떨어지지 않는다.");
        int cw = width / frames, ch = height;

        // 여섯 칸을 겹쳐 본 공통 사각형. 회전 축이 흔들리지 않도록 모든 칸을 이걸로 자른다.
        int x0 = cw, y0 = ch, x1 = -1, y1 = -1;
        for (int f = 0; f < frames; f++)
            for (int y = 0; y < ch; y++)
                for (int x = 0; x < cw; x++)
                    if (sheet[(y * width + f * cw + x) * 4 + 3] >= TrimAlpha)
                    {
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
        if (x1 < 0) throw new Exception(sheetPath + " 에 그림이 없다.");

        int tw = x1 - x0 + 1, th = y1 - y0 + 1;
        double scale = (double)maxSide / Math.Max(tw, th);
        int ow = Math.Max(1, (int)Math.Round(tw * scale));
        int oh = Math.Max(1, (int)Math.Round(th * scale));

        for (int f = 0; f < frames; f++)
        {
            byte[] cell = new byte[tw * th * 4];
            for (int y = 0; y < th; y++)
                Buffer.BlockCopy(sheet, ((y + y0) * width + f * cw + x0) * 4, cell, y * tw * 4, tw * 4);
            Bleed(cell, tw, th);

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
                using (Bitmap final = ToBitmap(outPx, ow, oh)) final.Save(pngPaths[f], ImageFormat.Png);
            }
        }
        return cw + " " + ch + " " + tw + " " + th + " " + ow + " " + oh;
    }
}
'@

Add-Type -TypeDefinition $slicerSource -ReferencedAssemblies System.Drawing

# 굽는 차례. 이름이 곧 manifest.js 의 역할 이름이고 게임은 e6:spin1 … e6:spin6 으로 읽는다.
$keys = 1..$Frames | ForEach-Object { "spin$_" }
$tempPngs = $keys | ForEach-Object { Join-Path $tempRoot ($_ + ".png") }
$size = [SpinSheetSlicer]::Slice($sheetPath, [string[]]$tempPngs, $MaxSide).Split(" ")

""
"칸 {0}x{1} → 공통 사각형 {2}x{3} → 굽는 크기 {4}x{5}" -f $size[0], $size[1], $size[2], $size[3], $size[4], $size[5]

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
  for ($i = 0; $i -lt $keys.Count; $i++) {
    $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tempPngs[$i]))
    $quality = $Quality.ToString([Globalization.CultureInfo]::InvariantCulture)
    $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
    if (-not $webp64) { throw "webp 인코딩 실패: $($keys[$i])" }
    $webpPath = Join-Path $artRoot ($keys[$i] + ".webp")
    [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))
    $total += (Get-Item $webpPath).Length
    "{0,-6} {1,4}x{2,-4}  png {3,8:N0} -> webp {4,7:N0}" -f `
      $keys[$i], [int]$size[4], [int]$size[5], (Get-Item $tempPngs[$i]).Length, (Get-Item $webpPath).Length
  }
  ""
  "여섯 장 합계 {0:N0} 바이트 (원본 시트 {1:N0})" -f $total, (Get-Item $sheetPath).Length
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
