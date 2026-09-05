# e3 사람 쌓기 — 메챠 포즈 원본에서 표시용 webp와 충돌 형상을 굽는다.
#
# 원본은 assets/images/minigame/stacks/metcha/pose1..8.png 와 line.png 다.
# (셋 다 투명 배경이지만 투명 픽셀 밑에 하늘색이 깔려 있어 가장자리에 파란 띠가 남는다.)
#
# 굽는 것은 두 가지다.
#   1) 같은 폴더의 pose1..8.webp / line.webp — 여백을 자르고 색을 바깥으로 번지게 한 뒤
#      게임 표시 크기의 TextureScale 배로 줄여 굽는다.
#   2) assets/minigames/e3/pose-shapes.js — 알파 채널에서 뽑은 사각형 충돌 조각들.
#      투명한 칸은 절대 덮지 않으므로 투명 여백끼리는 겹치고 사람 모형끼리는 겹치지 않는다.
#
# 원본 그림을 다시 그렸다면 이 스크립트를 다시 돌리고 나서
# scripts/build-archive-classic.ps1 로 번들을 다시 빌드한다.

param(
  # libwebp 의 cwebp.exe. 비우면 PATH 에서 찾는다.
  [string]$Cwebp = "",
  # 원본에서 가장 큰 세로 길이(=똑바로 선 사람)를 게임 좌표 몇 픽셀로 볼지.
  [double]$StandHeight = 116,
  # 텍스처를 표시 크기의 몇 배로 구울지. 캔버스가 2배로 늘어나도 뭉개지지 않는다.
  [int]$TextureScale = 2,
  # 충돌 격자 한 칸의 게임 좌표 크기. 작을수록 실루엣에 붙지만 조각이 늘어난다.
  [double]$CellSize = 4.2,
  # 사람 하나가 가질 수 있는 최대 충돌 조각 수. 20이면 덮개 89~100%로,
  # 남는 부분은 큰대자 포즈의 팔다리 끝처럼 격자보다 얇은 자리뿐이다.
  [int]$MaxParts = 20
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$artRoot = Join-Path $projectRoot "assets\images\minigame\stacks\metcha"
$shapePath = Join-Path $projectRoot "assets\minigames\e3\pose-shapes.js"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("e3-poses-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

# HUD 의 "다음: OO" 에 그대로 쓰이는 이름. 순서는 pose1..pose8 이다.
$poseNames = @(
  "옆으로 눕기", "머리 감싸기", "큰대자", "웅크리기",
  "숙이기", "알통 자랑", "차렷", "앉기"
)

if (-not $Cwebp) {
  $found = Get-Command cwebp -ErrorAction SilentlyContinue
  if ($found) { $Cwebp = $found.Source }
}
if (-not $Cwebp -or -not (Test-Path $Cwebp)) {
  throw "cwebp 를 찾지 못했다. libwebp(https://storage.googleapis.com/downloads.webmproject.org/releases/webp/)를 PATH 에 두거나 -Cwebp 로 경로를 넘겨라."
}

Add-Type -AssemblyName System.Drawing

$bakerSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

public class StackPoseBaker
{
    // 이 알파 위쪽만 그림이 있는 것으로 본다(여백 자르기 기준).
    const int TrimAlpha = 16;
    // 이 알파 위쪽만 "속이 찬 몸"으로 본다(충돌 격자 기준).
    const int SolidAlpha = 140;
    // 이 알파 위쪽 픽셀의 색만 믿고 나머지로 번지게 한다(하늘색 테두리 제거).
    const int OpaqueAlpha = 250;
    // 색을 바깥으로 몇 겹 번지게 할지. webp 손실 압축이 가장자리를 물들이지 않게 한다.
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

    // 히스토그램 안에서 가장 넓은 직사각형. bar[] 는 각 열의 연속 높이다.
    static int[] WidestBar(int[] bar)
    {
        int best = 0, bestLeft = 0, bestRight = -1, bestHeight = 0;
        int[] stack = new int[bar.Length + 1];
        int top = 0;
        for (int i = 0; i <= bar.Length; i++)
        {
            int value = i == bar.Length ? 0 : bar[i];
            while (top > 0 && bar[stack[top - 1]] >= value)
            {
                int height = bar[stack[--top]];
                int left = top > 0 ? stack[top - 1] + 1 : 0;
                int area = height * (i - left);
                if (area > best) { best = area; bestLeft = left; bestRight = i - 1; bestHeight = height; }
            }
            stack[top++] = i;
        }
        return new int[] { best, bestLeft, bestRight, bestHeight };
    }

    // 남은 칸에서 가장 넓은 "빈 칸 없는" 직사각형 하나. {행0, 열0, 행1, 열1}.
    static int[] LargestRect(bool[,] free, int rows, int cols)
    {
        int[] bar = new int[cols];
        int best = 0;
        int[] found = null;
        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < cols; c++) bar[c] = free[r, c] ? bar[c] + 1 : 0;
            int[] hit = WidestBar(bar);
            if (hit[0] > best)
            {
                best = hit[0];
                found = new int[] { r - hit[3] + 1, hit[1], r, hit[2] };
            }
        }
        return found;
    }

    /*
     * 한 장을 굽는다. 돌려주는 문자열은
     *   "가로 세로 덮개|cx,cy,w,h|cx,cy,w,h|..." 이고
     *   충돌 형상이 필요 없으면(maxParts <= 0) 사각형 목록은 비어 있다.
     */
    public static string Bake(string sourcePath, string pngPath, double scale,
        int textureScale, double cellSize, int maxParts)
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

        double gameW = tw * scale, gameH = th * scale;

        StringBuilder parts = new StringBuilder();
        double coverage = 1;
        if (maxParts > 0)
        {
            int cols = Math.Max(1, (int)Math.Round(gameW / cellSize));
            int rows = Math.Max(1, (int)Math.Round(gameH / cellSize));
            bool[,] free = new bool[rows, cols];
            int solidCells = 0;
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                {
                    int px0 = c * tw / cols, px1 = Math.Max(px0 + 1, (c + 1) * tw / cols);
                    int py0 = r * th / rows, py1 = Math.Max(py0 + 1, (r + 1) * th / rows);
                    int hit = 0, total = 0;
                    for (int y = py0; y < py1; y++)
                        for (int x = px0; x < px1; x++)
                        {
                            total++;
                            if (trimmed[(y * tw + x) * 4 + 3] >= SolidAlpha) hit++;
                        }
                    // 칸의 절반 이상이 몸일 때만 충돌 칸으로 삼는다(테두리만큼 안쪽으로 들어간다).
                    free[r, c] = hit * 2 >= total;
                    if (free[r, c]) solidCells++;
                }

            double cellW = gameW / cols, cellH = gameH / rows;
            int covered = 0;
            for (int i = 0; i < maxParts; i++)
            {
                int[] box = LargestRect(free, rows, cols);
                if (box == null) break;
                int area = (box[2] - box[0] + 1) * (box[3] - box[1] + 1);
                // 한 칸짜리 부스러기는 물리를 흔들기만 하므로 덮지 않고 남긴다.
                if (area < 2) break;
                for (int r = box[0]; r <= box[2]; r++)
                    for (int c = box[1]; c <= box[3]; c++) free[r, c] = false;
                covered += area;

                double left = box[1] * cellW - gameW / 2, right = (box[3] + 1) * cellW - gameW / 2;
                double up = box[0] * cellH - gameH / 2, down = (box[2] + 1) * cellH - gameH / 2;
                parts.Append("|")
                     .Append(Fmt((left + right) / 2)).Append(",").Append(Fmt((up + down) / 2))
                     .Append(",").Append(Fmt(right - left)).Append(",").Append(Fmt(down - up));
            }
            coverage = solidCells == 0 ? 0 : (double)covered / solidCells;
        }

        Bleed(trimmed, tw, th);
        int ow = Math.Max(1, (int)Math.Round(gameW * textureScale));
        int oh = Math.Max(1, (int)Math.Round(gameH * textureScale));
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

        return Fmt(gameW) + " " + Fmt(gameH) + " " + Fmt(coverage) + parts.ToString();
    }

    // 원본에서 여백을 뺀 크기. 배율을 정하려면 이것부터 알아야 한다.
    public static string Measure(string sourcePath)
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
        return (x1 - x0 + 1) + " " + (y1 - y0 + 1);
    }

    static string Fmt(double value)
    {
        return Math.Round(value, 2).ToString("0.##", CultureInfo.InvariantCulture);
    }
}
'@

Add-Type -TypeDefinition $bakerSource -ReferencedAssemblies System.Drawing

# ── 공통 배율 ───────────────────────────────────────────────────────
#
# 여덟 포즈는 같은 마네킹을 다른 자세로 렌더한 그림이다. 자세마다 크기를 따로 맞추면
# 누운 사람이 선 사람만큼 커져 버리므로, 원본에서 가장 긴 세로(=선 사람)만
# $StandHeight 에 맞추고 나머지는 같은 배율로 줄인다.
$sources = @(1..8 | ForEach-Object { "pose$_" })
$tallest = 0
foreach ($name in $sources) {
  $size = [StackPoseBaker]::Measure((Join-Path $artRoot "$name.png")).Split(" ")
  if ([int]$size[1] -gt $tallest) { $tallest = [int]$size[1] }
}
$scale = $StandHeight / $tallest
"원본 최대 세로 {0}px -> 게임 {1}px (배율 {2:N4})" -f $tallest, $StandHeight, $scale
""

$records = @()
$index = 0
foreach ($name in $sources) {
  $pngPath = Join-Path $tempRoot "$name.png"
  $baked = [StackPoseBaker]::Bake((Join-Path $artRoot "$name.png"), $pngPath, $scale, $TextureScale, $CellSize, $MaxParts)
  $fields = $baked.Split("|")
  $head = $fields[0].Split(" ")
  $records += [pscustomobject]@{
    Key = $name
    Name = $poseNames[$index]
    Width = [double]$head[0]
    Height = [double]$head[1]
    Coverage = [double]$head[2]
    Parts = @($fields | Select-Object -Skip 1)
    Png = $pngPath
  }
  $index++
}

$lineTemp = Join-Path $tempRoot "line.png"
$lineBaked = [StackPoseBaker]::Bake((Join-Path $artRoot "line.png"), $lineTemp, $scale, $TextureScale, 0, 0).Split(" ")
$records += [pscustomobject]@{
  Key = "line"; Name = "성공선 표지"; Width = [double]$lineBaked[0]; Height = [double]$lineBaked[1]
  Coverage = 1; Parts = @(); Png = $lineTemp
}

# ── webp 굽기 ───────────────────────────────────────────────────────
#
# 원본은 부드러운 3D 렌더라 무손실보다 q90 손실본이 훨씬 가볍고 눈으로는 구분되지 않는다.
# 알파는 -alpha_q 100 이라 무손실이고, 실루엣 경계가 뭉개지지 않는다.
""
foreach ($record in $records) {
  $webpPath = Join-Path $artRoot ($record.Key + ".webp")
  & $Cwebp -quiet -q 90 -alpha_q 100 -m 6 -sharp_yuv $record.Png -o $webpPath
  if ($LASTEXITCODE -ne 0) { throw "cwebp 실패: $($record.Key)" }
  $sourceSize = (Get-Item (Join-Path $artRoot ($record.Key + ".png"))).Length
  "{0,-6} {1,6:N1}x{2,-6:N1} 조각 {3,2}개 덮개 {4,4:P0}  png {5,8:N0} -> webp {6,7:N0}" -f `
    $record.Key, $record.Width, $record.Height, $record.Parts.Count, $record.Coverage, $sourceSize, (Get-Item $webpPath).Length
}

# ── 형상 데이터 ─────────────────────────────────────────────────────
$builder = [Text.StringBuilder]::new()
[void]$builder.AppendLine("/*")
[void]$builder.AppendLine(" * scripts/bake-stack-poses.ps1 이 만든 파일이다. 손으로 고치지 마라.")
[void]$builder.AppendLine(" *")
[void]$builder.AppendLine(" * e3 사람 쌓기가 떨어뜨리는 여덟 포즈다. 원본은")
[void]$builder.AppendLine(" * assets/images/minigame/stacks/metcha/pose1..8.png 이고, 여기 값은 전부 게임 좌표다.")
[void]$builder.AppendLine(" *")
[void]$builder.AppendLine(" * width/height = 여백을 자른 그림의 표시 크기. 원점은 그 그림의 정중앙이다.")
[void]$builder.AppendLine(" * parts = [중심x, 중심y, 가로, 세로] 사각형들. 알파가 반 넘게 찬 칸만 덮으므로")
[void]$builder.AppendLine(" *   투명한 여백끼리는 지나가고 실제 몸끼리는 겹치지 않는다.")
[void]$builder.AppendLine(" */")
[void]$builder.AppendLine("globalThis.E3_POSE_SHAPES = {")
[void]$builder.AppendLine("  poses: [")
foreach ($record in $records | Where-Object Key -ne "line") {
  [void]$builder.AppendLine("    {")
  [void]$builder.AppendLine(("      id: '{0}', name: '{1}', width: {2}, height: {3}," -f $record.Key, $record.Name, $record.Width, $record.Height))
  [void]$builder.AppendLine("      parts: [")
  foreach ($part in $record.Parts) { [void]$builder.AppendLine("        [$part],") }
  [void]$builder.AppendLine("      ],")
  [void]$builder.AppendLine("    },")
}
[void]$builder.AppendLine("  ],")
$lineRecord = $records | Where-Object Key -eq "line"
[void]$builder.AppendLine(("  line: {{ width: {0}, height: {1} }}," -f $lineRecord.Width, $lineRecord.Height))
[void]$builder.AppendLine("};")
[IO.File]::WriteAllText($shapePath, $builder.ToString(), [Text.UTF8Encoding]::new($false))
""
"Wrote $shapePath"

Remove-Item -Recurse -Force $tempRoot
