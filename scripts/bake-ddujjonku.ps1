# e5 두쫀쿠 새총 — 스테이지 원본 png 를 게임이 쓰는 webp 로 굽는다.
#
# 원본은 assets/images/minigame/ddujjonku/ 의 번호 붙은 png 17 장이고,
# 같은 폴더에 역할 이름의 webp 로 굽는다. 매니페스트(assets/minigames/manifest.js)의
# e5 항목이 그 역할 이름을 그대로 가리킨다.
#
# 한 장마다 하는 일은 세 가지다.
#   1) 알파 여백을 자른다. 그래야 게임이 지정한 표시 크기가 곧 그림 크기가 된다.
#   2) 투명한 칸의 "색"을 이웃한 불투명 색으로 번지게 한다(알파는 그대로).
#      이걸 안 하면 줄일 때 투명한 검정이 섞여 가장자리에 검은 테두리가 남는다.
#   3) 표시 크기의 두 배쯤으로 줄이고 webp 로 굽는다.
# 배경(cafe)만 예외로, 불투명한 16:9 한 장이라 자르지 않고 필드 비율로 늘려 굽는다.
#
# webp 인코더로는 libwebp(cwebp) 대신 이미 깔려 있는 크롬을 쓴다 —
# scripts/bake-geoje-sea.ps1 과 같은 방식이다. 알파를 살려야 하므로 캔버스를
# 투명하게 두고 toDataURL('image/webp', q) 로 받는다.
#
# 원본 그림을 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # webp 품질. 사진이 아니라 부드러운 채색 그림이라 0.9면 눈으로 원본과 구분되지 않는다.
  [double]$Quality = .9
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\ddujjonku"
if (-not (Test-Path $artRoot)) { throw "원본 폴더가 없다: $artRoot" }
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e5-ddujjonku-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

# 원본 -> 역할 이름과 구울 크기. max 는 긴 변 기준이고, 게임 표시 크기의 두 배쯤이다.
# (표시 크기는 js/archive/stages/e5_slingshot.js 의 render 가 정한다.)
$plan = @(
  @{ src = "01_ddujjonku_proud.png";              out = "proud.webp";         max = 192 }  # 대기 중인 두쫀쿠
  @{ src = "02_ddujjonku_tense.png";              out = "tense.webp";         max = 192 }  # 고무줄을 당기는 동안
  @{ src = "03_ddujjonku_launch.png";             out = "launch.webp";        max = 192 }  # 날아가는 중
  @{ src = "04_ddujjonku_split.png";              out = "split.webp";         max = 192 }  # 무언가에 맞은 뒤
  @{ src = "05_slingshot_no_band.png";            out = "slingshot.webp";     max = 256 }  # 새총 몸통(고무줄은 코드가 그린다)
  @{ src = "06_dduttakkang_before.png";           out = "target.webp";        max = 176 }  # 멀쩡한 두딱깡
  @{ src = "07_dduttakkang_hit.png";              out = "target-hit.webp";    max = 176 }  # 한 번 이상 맞은 두딱깡
  @{ src = "08_strawberry_roof_top.png";          out = "roof.webp";          max = 320 }  # 지붕
  @{ src = "09_strawberry_roof_middle_wide.png";  out = "floor-wide.webp";    max = 320 }  # 1층 천장(=2층 바닥)
  @{ src = "10_strawberry_roof_middle_small.png"; out = "floor-small.webp";   max = 288 }  # 2층 천장
  @{ src = "11_wafer_pillar_long.png";            out = "pillar-long.webp";   max = 224 }  # 1층 기둥
  @{ src = "12_wafer_pillar_medium.png";          out = "pillar-medium.webp"; max = 192 }  # 2층 기둥
  @{ src = "13_wafer_pillar_short.png";           out = "pillar-short.webp";  max = 160 }  # 부러진 조각
  @{ src = "14_chocolate_brick_star.png";         out = "brick-star.webp";    max = 128 }  # 조리대 장식
  @{ src = "15_chocolate_brick_plain.png";        out = "brick.webp";         max = 256 }  # 집이 올라앉은 초콜릿 받침
  @{ src = "16_wood_table.png";                   out = "table.webp";         max = 1024 } # 조리대 상판
  # 배경만 자르지 않고 필드와 같은 16:9(원본도 2048x1152 라 늘어나는 곳이 없다)로 굽는다.
  @{ src = "17_cafe_background.png";              out = "cafe.webp";          width = 1440; height = 810 }
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

Add-Type -AssemblyName System.Drawing

$bakerSource = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class DdujjonkuBaker
{
    // 이 알파 위쪽만 그림이 있는 것으로 본다(여백 자르기 기준).
    const int TrimAlpha = 12;
    // 이 알파 위쪽 픽셀의 색만 믿고 나머지로 번지게 한다.
    const int OpaqueAlpha = 250;
    // 색을 몇 겹 번지게 할지. 줄이는 배율이 커도 검은 테두리가 남지 않을 만큼이다.
    const int BleedPasses = 10;

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

        int[] queue = new int[width * height];
        for (int pass = 0; pass < BleedPasses; pass++)
        {
            int filled = 0;
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
                    queue[filled++] = i;
                }
            if (filled == 0) break;
            for (int k = 0; k < filled; k++) known[queue[k]] = true;
        }
    }

    /*
     * 한 장을 굽는다. trim 이면 알파 여백을 자르고 색을 번지게 한다.
     * forceW/forceH 가 0 보다 크면 그 크기로 늘리고, 아니면 긴 변을 maxSide 로 줄인다.
     * 돌려주는 문자열은 "원본가로 원본세로 결과가로 결과세로" 다.
     */
    public static string Bake(string sourcePath, string pngPath, int maxSide, bool trim, int forceW, int forceH)
    {
        int width, height;
        byte[] px = ReadBgra(sourcePath, out width, out height);
        int sourceW = width, sourceH = height;

        if (trim)
        {
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
            byte[] trimmed = new byte[tw * th * 4];
            for (int y = 0; y < th; y++)
                Buffer.BlockCopy(px, ((y + y0) * width + x0) * 4, trimmed, y * tw * 4, tw * 4);
            px = trimmed; width = tw; height = th;
            Bleed(px, width, height);
        }

        int outW, outH;
        if (forceW > 0 && forceH > 0) { outW = forceW; outH = forceH; }
        else
        {
            double scale = Math.Min(1.0, (double)maxSide / Math.Max(width, height));
            outW = Math.Max(1, (int)Math.Round(width * scale));
            outH = Math.Max(1, (int)Math.Round(height * scale));
        }

        using (Bitmap source = ToBitmap(px, width, height))
        using (Bitmap canvas = new Bitmap(outW, outH, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(canvas))
            using (ImageAttributes attributes = new ImageAttributes())
            {
                g.CompositingMode = CompositingMode.SourceCopy;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;
                // 가장자리 픽셀을 되접어 써서 테두리 한 줄이 흐려지지 않게 한다.
                attributes.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(source, new Rectangle(0, 0, outW, outH),
                    0, 0, width, height, GraphicsUnit.Pixel, attributes);
            }
            canvas.Save(pngPath, ImageFormat.Png);
        }
        return sourceW + " " + sourceH + " " + outW + " " + outH;
    }
}
'@
Add-Type -TypeDefinition $bakerSource -ReferencedAssemblies System.Drawing

# ── 크롬 띄우고 CDP 로 붙기 ────────────────────────────────────────
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

  # 캔버스를 투명하게 두고(alpha: true) 굽는다. 배경만 알파가 없을 뿐 코드는 같다.
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

  $quality = $Quality.ToString([Globalization.CultureInfo]::InvariantCulture)
  $rows = @()
  foreach ($item in $plan) {
    $sourcePath = Join-Path $artRoot $item.src
    if (-not (Test-Path $sourcePath)) { throw "원본이 없다: $sourcePath" }
    $tempPng = Join-Path $tempRoot ($item.out -replace "\.webp$", ".png")
    $forceW = if ($item.width) { [int]$item.width } else { 0 }
    $forceH = if ($item.height) { [int]$item.height } else { 0 }
    $maxSide = if ($item.max) { [int]$item.max } else { 0 }
    $size = ([DdujjonkuBaker]::Bake($sourcePath, $tempPng, $maxSide, ($forceW -le 0), $forceW, $forceH)) -split " "

    $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tempPng))
    $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
    if (-not $webp64) { throw ("webp 인코딩 실패: " + $item.out) }
    $webpPath = Join-Path $artRoot $item.out
    [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))

    $rows += [pscustomobject]@{
      Name = $item.out
      Source = "{0}x{1}" -f $size[0], $size[1]
      Baked = "{0}x{1}" -f $size[2], $size[3]
      Png = (Get-Item $sourcePath).Length
      Webp = (Get-Item $webpPath).Length
    }
  }

  ""
  foreach ($row in $rows) {
    "{0,-20} {1,-12} -> {2,-10} png {3,9:N0} -> webp {4,8:N0}  ({5,4:N1}%)" -f `
      $row.Name, $row.Source, $row.Baked, $row.Png, $row.Webp, (100 * $row.Webp / $row.Png)
  }
  ""
  "합계 png {0:N0} -> webp {1:N0}" -f ($rows | Measure-Object Png -Sum).Sum, ($rows | Measure-Object Webp -Sum).Sum
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
