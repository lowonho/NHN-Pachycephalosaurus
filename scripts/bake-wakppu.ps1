# e2 왁뿌볼 — 스테이지 원본 png 를 게임이 쓰는 webp 로 굽는다.
#
# 원본은 assets/images/minigame/wakppu/ 의 번호 붙은 png 12 장이고, 같은 폴더에
# 역할 이름의 webp 로 굽는다. 매니페스트(assets/minigames/manifest.js)의 e2 항목이
# 그 역할 이름을 그대로 가리킨다.
#
# 원본마다 손질하는 방식이 다르다.
#   ball : 왁뿌볼 넉 장. 알파는 이미 잘려 있고, 공의 원(가장 넓은 가로줄 = 지름)을 찾아
#          그 중심이 정사각 캔버스 한가운데 오게 자른다. 게임이 그림을 굴릴 때
#          회전축이 곧 공의 중심이 되어야 하기 때문이다. 매듭이 잘리지 않도록
#          한 변을 지름의 -BallPad 배로 잡고, 그래도 모자라면 오류로 멈춘다.
#   cut  : 파란 호빵 두 장. 중립 회색 배경 위에 그려져 있어 가장자리에서 번져 들어가는
#          칠하기로 배경만 지운다. 안쪽의 흰 광택은 배경색과 멀어 살아남는다.
#   trim : 나머지 투명 png. 알파 여백만 자른다.
#   cover: 배경 한 장. 자르지 않고 필드와 같은 16:9 로 늘린다.
# ball/cut/trim 은 자른 뒤 투명한 칸의 "색"을 이웃한 불투명 색으로 번지게 한다(알파는 그대로).
# 이걸 안 하면 줄일 때 투명한 검정이 섞여 가장자리에 검은 테두리가 남는다.
#
# webp 인코더로는 libwebp(cwebp) 대신 이미 깔려 있는 크롬을 쓴다 —
# scripts/bake-ddujjonku.ps1 과 같은 방식이다.
#
# 원본 그림을 바꿨다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # 인코더로 쓸 크롬. 비우면 아래 기본 경로와 PATH 를 찾는다.
  [string]$Chrome = "",
  # webp 품질. 사진이 아니라 부드러운 채색 그림이라 0.9면 눈으로 원본과 구분되지 않는다.
  [double]$Quality = .9,
  # 왁뿌볼 정사각 캔버스 한 변 / 공 지름. 위로 솟은 매듭이 들어갈 만큼 남긴다.
  # 이 값은 e2_bounceBall.js 의 BALL_ART 와 같아야 공이 판정 지름 그대로 그려진다.
  [double]$BallPad = 1.6
)

$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\wakppu"
if (-not (Test-Path $artRoot)) { throw "원본 폴더가 없다: $artRoot" }
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e2-wakppu-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

# 원본 -> 역할 이름과 구울 크기. max 는 긴 변 기준이고, 게임 표시 크기의 두 배쯤이다.
# (표시 크기는 js/archive/stages/e2_bounceBall.js 의 render 가 발판 폭에서 정한다.)
$plan = @(
  @{ src = "01_wakppu_ball_intact_2k.png";           out = "ball1.webp";           mode = "ball"; max = 128 } # 점프 0~2회
  @{ src = "02_wakppu_ball_slightly_broken_2k.png";  out = "ball2.webp";           mode = "ball"; max = 128 } # 3~5회
  @{ src = "03_wakppu_ball_half_broken_2k.png";      out = "ball3.webp";           mode = "ball"; max = 128 } # 6~8회
  @{ src = "04_wakppu_ball_fully_mixed_2k.png";      out = "ball4.webp";           mode = "ball"; max = 128 } # 9회 이상
  @{ src = "05_butter_platform_long_2k.png";         out = "platform-long.webp";   mode = "trim"; max = 640 } # 폭 240 이상 발판
  @{ src = "06_butter_platform_medium_2k.png";       out = "platform-medium.webp"; mode = "trim"; max = 384 } # 폭 150~239
  @{ src = "07_butter_platform_short_2k.png";        out = "platform-short.webp";  mode = "trim"; max = 288 } # 폭 149 이하
  @{ src = "08_wakppu_bar_half_broken_2k.png";       out = "crumble.webp";         mode = "trim"; max = 352 } # 밟기 전 붕괴 발판
  @{ src = "09_wakppu_bar_split_in_two_2k.png";      out = "crumble-split.webp";   mode = "trim"; max = 352 } # 밟고 무너지는 중
  @{ src = "10_blue_hoppang_platform_medium_2k.png"; out = "lift-wide.webp";       mode = "cut";  max = 320 } # 폭 135 이상 승강 발판
  @{ src = "11_blue_hoppang_platform_short_2k.png";  out = "lift-narrow.webp";     mode = "cut";  max = 320 } # 폭 134 이하
  # 배경만 자르지 않고 필드와 같은 16:9(원본도 2048x1152 라 늘어나는 곳이 없다)로 굽는다.
  @{ src = "12_kidult_room_background_2k.png";       out = "room.webp";            mode = "cover"; width = 1440; height = 810 }
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
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class WakppuBaker
{
    // 이 알파 위쪽만 그림이 있는 것으로 본다(여백 자르기 기준).
    const int TrimAlpha = 12;
    // 이 알파 위쪽 픽셀의 색만 믿고 나머지로 번지게 한다.
    const int OpaqueAlpha = 250;
    // 색을 몇 겹 번지게 할지. 줄이는 배율이 커도 검은 테두리가 남지 않을 만큼이다.
    const int BleedPasses = 10;
    // 회색 배경 지우기: 배경색과 이만큼 이내면 완전히 지우고, KeepDistance 이상이면 남긴다.
    const double DropDistance = 20;
    const double KeepDistance = 46;

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
     * 중립 회색 배경을 지운다. 테두리 픽셀의 평균을 배경색으로 잡고, 배경색과 가까운 칸을
     * 가장자리에서부터 이어 붙여 나간다(가운데에 있는 회색빛 광택은 이어지지 않아 남는다).
     * 배경색에서 DropDistance~KeepDistance 사이인 칸은 알파를 중간값으로 두어 경계가
     * 톱니로 서지 않게 한다.
     */
    static void KeyOutFlatBackground(byte[] px, int width, int height)
    {
        double bb = 0, bg = 0, br = 0;
        int n = 0;
        for (int x = 0; x < width; x++)
        {
            int[] rows = { 0, height - 1 };
            foreach (int y in rows) { int i = (y * width + x) * 4; bb += px[i]; bg += px[i + 1]; br += px[i + 2]; n++; }
        }
        for (int y = 0; y < height; y++)
        {
            int[] cols = { 0, width - 1 };
            foreach (int x in cols) { int i = (y * width + x) * 4; bb += px[i]; bg += px[i + 1]; br += px[i + 2]; n++; }
        }
        bb /= n; bg /= n; br /= n;

        // 배경색과의 거리에서 뽑은 "남길 정도". 0이면 배경, 255면 그림이다.
        byte[] keep = new byte[width * height];
        for (int i = 0; i < keep.Length; i++)
        {
            double db = px[i * 4] - bb, dg = px[i * 4 + 1] - bg, dr = px[i * 4 + 2] - br;
            double distance = Math.Sqrt(db * db + dg * dg + dr * dr);
            double t = (distance - DropDistance) / (KeepDistance - DropDistance);
            keep[i] = (byte)Math.Round(255 * Math.Max(0, Math.Min(1, t)));
        }

        // 가장자리에서 이어지는 배경만 지운다. 그림 안쪽의 옅은 칸은 건드리지 않는다.
        bool[] outside = new bool[width * height];
        Stack<int> stack = new Stack<int>();
        for (int x = 0; x < width; x++) { stack.Push(x); stack.Push((height - 1) * width + x); }
        for (int y = 0; y < height; y++) { stack.Push(y * width); stack.Push(y * width + width - 1); }
        while (stack.Count > 0)
        {
            int i = stack.Pop();
            if (outside[i] || keep[i] == 255) continue;
            outside[i] = true;
            int x = i % width, y = i / width;
            if (x > 0) stack.Push(i - 1);
            if (x < width - 1) stack.Push(i + 1);
            if (y > 0) stack.Push(i - width);
            if (y < height - 1) stack.Push(i + width);
        }
        for (int i = 0; i < outside.Length; i++)
            if (outside[i]) px[i * 4 + 3] = (byte)(px[i * 4 + 3] * keep[i] / 255);
    }

    static void AlphaBounds(byte[] px, int width, int height, out int x0, out int y0, out int x1, out int y1)
    {
        x0 = width; y0 = height; x1 = -1; y1 = -1;
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                if (px[(y * width + x) * 4 + 3] >= TrimAlpha)
                {
                    if (x < x0) x0 = x;
                    if (x > x1) x1 = x;
                    if (y < y0) y0 = y;
                    if (y > y1) y1 = y;
                }
    }

    static byte[] Crop(byte[] px, int width, int height, int x0, int y0, int cropW, int cropH)
    {
        byte[] cut = new byte[cropW * cropH * 4];
        for (int y = 0; y < cropH; y++)
        {
            int sy = y0 + y;
            if (sy < 0 || sy >= height) continue;
            for (int x = 0; x < cropW; x++)
            {
                int sx = x0 + x;
                if (sx < 0 || sx >= width) continue;
                Buffer.BlockCopy(px, (sy * width + sx) * 4, cut, (y * cropW + x) * 4, 4);
            }
        }
        return cut;
    }

    /*
     * 왁뿌볼을 정사각으로 자른다. 가장 넓은 가로줄이 공의 지름이고 그 줄의 한가운데가
     * 공의 중심 가로 좌표다. 세로 중심은 알파 아래끝에서 반지름만큼 올라간 자리다.
     * 남은 여백(매듭)이 pad 안에 들어가지 않으면 오류로 멈춘다 — 잘린 채 굽는 것보다 낫다.
     */
    static byte[] CropBall(byte[] px, int width, int height, double pad, out int side, out double needed)
    {
        int x0, y0, x1, y1;
        AlphaBounds(px, width, height, out x0, out y0, out x1, out y1);
        if (x1 < 0) throw new Exception("그림이 없다.");

        int diameter = 0, centerX = 0;
        for (int y = y0; y <= y1; y++)
        {
            int left = -1, right = -1;
            for (int x = x0; x <= x1; x++)
                if (px[(y * width + x) * 4 + 3] >= TrimAlpha) { if (left < 0) left = x; right = x; }
            if (left < 0) continue;
            if (right - left + 1 > diameter) { diameter = right - left + 1; centerX = (left + right) / 2; }
        }
        double cx = centerX, cy = y1 - diameter / 2.0;
        needed = 2 * Math.Max(Math.Max(cx - x0, x1 - cx), Math.Max(cy - y0, y1 - cy)) / diameter;
        if (needed > pad + 0.001)
            throw new Exception(string.Format("공 바깥 여백이 pad 를 넘는다: {0:F3} > {1:F3}", needed, pad));

        side = (int)Math.Round(diameter * pad);
        return Crop(px, width, height, (int)Math.Round(cx - side / 2.0), (int)Math.Round(cy - side / 2.0), side, side);
    }

    /*
     * 한 장을 굽는다. 돌려주는 문자열은 "원본가로 원본세로 결과가로 결과세로 필요pad" 다.
     * 필요pad 는 ball 모드에서만 뜻이 있다.
     */
    public static string Bake(string sourcePath, string pngPath, string mode, int maxSide, double pad, int forceW, int forceH)
    {
        int width, height;
        byte[] px = ReadBgra(sourcePath, out width, out height);
        int sourceW = width, sourceH = height;
        double needed = 0;

        if (mode == "cut") KeyOutFlatBackground(px, width, height);

        if (mode == "ball")
        {
            int side;
            px = CropBall(px, width, height, pad, out side, out needed);
            width = side; height = side;
            Bleed(px, width, height);
        }
        else if (mode != "cover")
        {
            int x0, y0, x1, y1;
            AlphaBounds(px, width, height, out x0, out y0, out x1, out y1);
            if (x1 < 0) throw new Exception(sourcePath + " 에 그림이 없다.");
            int tw = x1 - x0 + 1, th = y1 - y0 + 1;
            px = Crop(px, width, height, x0, y0, tw, th);
            width = tw; height = th;
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
        return sourceW + " " + sourceH + " " + outW + " " + outH + " "
            + needed.ToString("F3", System.Globalization.CultureInfo.InvariantCulture);
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
    $size = ([WakppuBaker]::Bake($sourcePath, $tempPng, $item.mode, $maxSide, $BallPad, $forceW, $forceH)) -split " "

    $png64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tempPng))
    $webp64 = Evaluate "toWebp('data:image/png;base64,$png64', $quality)"
    if (-not $webp64) { throw ("webp 인코딩 실패: " + $item.out) }
    $webpPath = Join-Path $artRoot $item.out
    [IO.File]::WriteAllBytes($webpPath, [Convert]::FromBase64String($webp64))

    $rows += [pscustomobject]@{
      Name = $item.out
      Mode = $item.mode
      Source = "{0}x{1}" -f $size[0], $size[1]
      Baked = "{0}x{1}" -f $size[2], $size[3]
      Need = [double]$size[4]
      Png = (Get-Item $sourcePath).Length
      Webp = (Get-Item $webpPath).Length
    }
  }

  ""
  foreach ($row in $rows) {
    "{0,-20} {1,-6} {2,-12} -> {3,-10} png {4,9:N0} -> webp {5,8:N0}  ({6,4:N1}%)  pad {7:F2}" -f `
      $row.Name, $row.Mode, $row.Source, $row.Baked, $row.Png, $row.Webp, (100 * $row.Webp / $row.Png), $row.Need
  }
  ""
  "합계 png {0:N0} -> webp {1:N0}" -f ($rows | Measure-Object Png -Sum).Sum, ($rows | Measure-Object Webp -Sum).Sum
  "공 캔버스 = 지름 x {0} (e2_bounceBall.js 의 BALL_ART 와 같아야 한다)" -f $BallPad
  "구운 곳: $artRoot"
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
