# 설정 UI 스프라이트 시트를 개별 PNG로 자른다.
#
# 원본은 assets/images/ui/settings/settings_ui_assets_cyber_archive_exact_2k.png
# (2048x2048, 투명 배경) 한 장이고, css/settings.css 가 참조하는 조각 파일들을
# 여기서 만들어 낸다. 시트를 다시 그리면 이 스크립트를 다시 돌리면 된다.
#
# 잘라낼 위치는 알파 채널 투영으로 자동 검출한다. 행(가로 띠)을 먼저 찾고,
# 각 띠 안에서 열을 찾아 조각 경계를 잡는다. 검출 순서는 시트의 배치 순서와
# 같으므로 $spriteNames 의 순서가 곧 조각 이름이다.

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$settingsRoot = Join-Path $projectRoot "assets\images\ui\settings"
$sheetPath = Join-Path $settingsRoot "settings_ui_assets_cyber_archive_exact_2k.png"

# 시트에 놓인 순서 그대로다(위에서 아래로, 각 줄은 왼쪽에서 오른쪽으로).
$spriteNames = @(
  "title-pill",
  "icon-gear",
  "panel-frame",
  "row-slot",
  "knob-paw",
  "toggle-on",
  "toggle-off",
  "icon-volume",
  "icon-bgm",
  "icon-sfx",
  "icon-display",
  "button-apply",
  "button-back",
  "icon-check",
  "icon-undo"
)

Add-Type -AssemblyName System.Drawing

$sliceSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class SettingsSheetSlicer
{
    // 투명에 가까운 픽셀은 글로우 잔여물로 보고 버린다.
    const int AlphaThreshold = 12;
    // 이보다 얇은 띠/조각은 잡티로 본다.
    const int MinSize = 10;
    // 이 정도 틈은 한 조각 내부의 빈 공간으로 보고 이어 붙인다.
    const int GapMerge = 10;

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

    // "x,y,w,h" 문자열 목록을 시트 배치 순서대로 돌려준다.
    public static List<string> FindSprites(string path)
    {
        int width, height;
        byte[] alpha = ReadAlpha(path, out width, out height);
        List<string> boxes = new List<string>();

        int[] rowCounts = new int[height];
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
                if (alpha[y * width + x] >= AlphaThreshold) rowCounts[y]++;

        foreach (int[] band in FindRuns(rowCounts))
        {
            int[] colCounts = new int[width];
            for (int y = band[0]; y <= band[1]; y++)
                for (int x = 0; x < width; x++)
                    if (alpha[y * width + x] >= AlphaThreshold) colCounts[x]++;

            foreach (int[] column in FindRuns(colCounts))
            {
                // 띠 전체가 아니라 이 조각만의 위/아래 끝을 다시 잡는다.
                int top = -1, bottom = -1;
                for (int y = band[0]; y <= band[1]; y++)
                {
                    for (int x = column[0]; x <= column[1]; x++)
                    {
                        if (alpha[y * width + x] < AlphaThreshold) continue;
                        if (top < 0) top = y;
                        bottom = y;
                        break;
                    }
                }
                boxes.Add(column[0] + "," + top + "," + (column[1] - column[0] + 1) + "," + (bottom - top + 1));
            }
        }
        return boxes;
    }

    static List<int[]> FindRuns(int[] counts)
    {
        List<int[]> runs = new List<int[]>();
        int start = -1;
        for (int i = 0; i < counts.Length; i++)
        {
            if (counts[i] > 0)
            {
                if (start < 0) start = i;
            }
            else if (start >= 0)
            {
                runs.Add(new int[] { start, i - 1 });
                start = -1;
            }
        }
        if (start >= 0) runs.Add(new int[] { start, counts.Length - 1 });

        List<int[]> merged = new List<int[]>();
        foreach (int[] run in runs)
        {
            if (merged.Count > 0 && run[0] - merged[merged.Count - 1][1] - 1 <= GapMerge)
                merged[merged.Count - 1][1] = run[1];
            else
                merged.Add(new int[] { run[0], run[1] });
        }

        List<int[]> kept = new List<int[]>();
        foreach (int[] run in merged)
            if (run[1] - run[0] + 1 >= MinSize) kept.Add(run);
        return kept;
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

$boxes = [SettingsSheetSlicer]::FindSprites($sheetPath)
if ($boxes.Count -ne $spriteNames.Count) {
  throw "시트에서 조각 $($boxes.Count)개를 찾았는데 이름은 $($spriteNames.Count)개다. 시트 배치가 바뀌었는지 확인하라."
}

for ($index = 0; $index -lt $boxes.Count; $index++) {
  $box = $boxes[$index].Split(",")
  $targetPath = Join-Path $settingsRoot ($spriteNames[$index] + ".png")
  [SettingsSheetSlicer]::Crop($sheetPath, $targetPath, [int]$box[0], [int]$box[1], [int]$box[2], [int]$box[3])
  "{0,-13} {1,4}x{2,-4} (x={3}, y={4})" -f $spriteNames[$index], $box[2], $box[3], $box[0], $box[1]
}

# ── webp 굽기 ────────────────────────────────────────────────────────
#
# 실제로 로드하는 건 webp 쪽이다(css/settings.css · index.html). png는 원본으로 남긴다.
# 시트가 AI 렌더라 노이즈·그라디언트가 많아 무손실은 손실본의 3~7배로 무겁다.
# q92 + alpha_q 100이면 네온 선과 투명 가장자리가 눈에 띄게 뭉개지지 않는다.
#
# cwebp는 https://storage.googleapis.com/downloads.webmproject.org/releases/webp/ 의
# libwebp 배포판에 들어 있다. PATH에 없으면 png까지만 만들고 넘어간다.

$cwebp = Get-Command cwebp -ErrorAction SilentlyContinue
if (-not $cwebp) {
  Write-Warning "cwebp를 찾지 못해 webp는 굽지 않았다. libwebp를 PATH에 두고 다시 실행하라."
  return
}

""
foreach ($spriteName in $spriteNames) {
  $pngPath = Join-Path $settingsRoot "$spriteName.png"
  $webpPath = Join-Path $settingsRoot "$spriteName.webp"
  & $cwebp.Source -quiet -q 92 -alpha_q 100 -m 6 -sharp_yuv $pngPath -o $webpPath
  if ($LASTEXITCODE -ne 0) { throw "cwebp 실패: $spriteName" }
  "{0,-13} png {1,9:N0} -> webp {2,8:N0}" -f `
    $spriteName, (Get-Item $pngPath).Length, (Get-Item $webpPath).Length
}
