$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot "docs\2026_ARCHIVE_해커톤_게임_소개서.docx"
$coverImagePath = Join-Path $projectRoot "assets\images\ui\Main\bg.png"

if (-not (Test-Path -LiteralPath $coverImagePath)) {
    throw "표지 이미지가 없습니다: $coverImagePath"
}

$wdAlignLeft = 0
$wdAlignCenter = 1
$wdAlignRight = 2
$wdAlignJustify = 3
$wdPageBreak = 7
$wdCollapseEnd = 0
$wdFormatDocumentDefault = 16
$wdStatisticPages = 2
$wdLineStyleSingle = 1
$wdCellAlignVerticalCenter = 1
$wdAutoFitWindow = 2
$wdPreferredWidthPercent = 2
$wdBorderTop = -1
$wdBorderLeft = -2
$wdBorderBottom = -3
$wdBorderRight = -4
$wdBorderHorizontal = -5
$wdBorderVertical = -6

function Get-OleColor {
    param([Parameter(Mandatory = $true)][string]$Hex)
    $clean = $Hex.TrimStart('#')
    $r = [Convert]::ToInt32($clean.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($clean.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($clean.Substring(4, 2), 16)
    return $r + ($g -shl 8) + ($b -shl 16)
}

$colorNavy = Get-OleColor "08172F"
$colorNavy2 = Get-OleColor "10284A"
$colorCyan = Get-OleColor "12CFE5"
$colorBlue = Get-OleColor "2E68E6"
$colorPink = Get-OleColor "E843B8"
$colorYellow = Get-OleColor "FFD84D"
$colorWhite = Get-OleColor "FFFFFF"
$colorInk = Get-OleColor "172033"
$colorBody = Get-OleColor "37445A"
$colorMuted = Get-OleColor "6B778C"
$colorLine = Get-OleColor "DCE5EF"
$colorPanel = Get-OleColor "EEF8FB"
$colorPanelBlue = Get-OleColor "EEF3FE"
$colorPanelPink = Get-OleColor "FCEFF8"
$colorPanelYellow = Get-OleColor "FFF8DD"
$colorRowAlt = Get-OleColor "F7F9FC"

$word = $null
$doc = $null
$checkDoc = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Add()
    $selection = $word.Selection

    function Cm {
        param([double]$Value)
        return $word.CentimetersToPoints($Value)
    }

    function Move-ToEnd {
        $end = $doc.Content.End - 1
        $selection.SetRange($end, $end)
    }

    function Add-Text {
        param(
            [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
            [double]$Size = 10.5,
            [int]$Color = $colorBody,
            [bool]$Bold = $false,
            [int]$Align = $wdAlignLeft,
            [double]$SpaceBefore = 0,
            [double]$SpaceAfter = 6,
            [double]$LeftIndentCm = 0,
            [double]$RightIndentCm = 0,
            [double]$FirstLineIndentCm = 0,
            [bool]$KeepWithNext = $false,
            [string]$FontName = "맑은 고딕"
        )
        Move-ToEnd
        $selection.Font.Name = $FontName
        $selection.Font.NameFarEast = $FontName
        $selection.Font.Size = $Size
        $selection.Font.Bold = [int]$Bold
        $selection.Font.Italic = 0
        $selection.Font.Color = $Color
        $selection.ParagraphFormat.Alignment = $Align
        $selection.ParagraphFormat.SpaceBefore = $SpaceBefore
        $selection.ParagraphFormat.SpaceAfter = $SpaceAfter
        $selection.ParagraphFormat.LeftIndent = Cm $LeftIndentCm
        $selection.ParagraphFormat.RightIndent = Cm $RightIndentCm
        $selection.ParagraphFormat.FirstLineIndent = Cm $FirstLineIndentCm
        $selection.ParagraphFormat.KeepWithNext = $(if ($KeepWithNext) { -1 } else { 0 })
        $selection.ParagraphFormat.LineSpacingRule = 0
        $selection.TypeText($Text)
        $selection.TypeParagraph()
    }

    function Add-Body {
        param([Parameter(Mandatory = $true)][string]$Text, [double]$SpaceAfter = 7)
        Add-Text -Text $Text -Size 10.4 -Color $colorBody -Align $wdAlignJustify -SpaceAfter $SpaceAfter
    }

    function Add-Bullet {
        param([Parameter(Mandatory = $true)][string]$Text, [double]$SpaceAfter = 4)
        Add-Text -Text ("•  " + $Text) -Size 9.9 -Color $colorBody -SpaceAfter $SpaceAfter -LeftIndentCm 0.55 -FirstLineIndentCm -0.45
    }

    function Add-SectionTitle {
        param([Parameter(Mandatory = $true)][int]$Number, [Parameter(Mandatory = $true)][string]$Title, [string]$Kicker = "GAME INTRODUCTION")
        Add-Text -Text (("{0:D2}" -f $Number) + "  ·  " + $Kicker) -Size 8.5 -Color $colorCyan -Bold $true -SpaceAfter 2 -KeepWithNext $true
        Add-Text -Text (("{0}. " -f $Number) + $Title) -Size 23 -Color $colorNavy -Bold $true -SpaceAfter 6 -KeepWithNext $true
        Add-Text -Text "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Size 5 -Color $colorCyan -SpaceAfter 13 -KeepWithNext $true
    }

    function Add-PageBreak {
        Move-ToEnd
        $selection.InsertBreak($wdPageBreak)
    }

    function Add-Table {
        param([int]$Rows, [int]$Columns)
        $range = $doc.Range($doc.Content.End - 1, $doc.Content.End - 1)
        $table = $doc.Tables.Add($range, $Rows, $Columns)
        $table.PreferredWidthType = $wdPreferredWidthPercent
        $table.PreferredWidth = 100
        $table.AutoFitBehavior($wdAutoFitWindow)
        $table.Rows.AllowBreakAcrossPages = 0
        $table.TopPadding = Cm 0.16
        $table.BottomPadding = Cm 0.16
        $table.LeftPadding = Cm 0.18
        $table.RightPadding = Cm 0.18
        return $table
    }

    function Set-Cell {
        param(
            [Parameter(Mandatory = $true)]$Cell,
            [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
            [int]$Fill = $colorWhite,
            [int]$FontColor = $colorBody,
            [double]$FontSize = 9.5,
            [bool]$Bold = $false,
            [int]$Align = $wdAlignLeft,
            [int]$BorderColor = $colorLine
        )
        $Cell.Range.Text = $Text
        $Cell.Range.Font.Name = "맑은 고딕"
        $Cell.Range.Font.NameFarEast = "맑은 고딕"
        $Cell.Range.Font.Size = $FontSize
        $Cell.Range.Font.Bold = [int]$Bold
        $Cell.Range.Font.Color = $FontColor
        $Cell.Range.ParagraphFormat.Alignment = $Align
        $Cell.Range.ParagraphFormat.SpaceAfter = 0
        $Cell.Range.ParagraphFormat.SpaceBefore = 0
        $Cell.VerticalAlignment = $wdCellAlignVerticalCenter
        $Cell.Shading.BackgroundPatternColor = $Fill
        foreach ($borderId in @($wdBorderTop, $wdBorderLeft, $wdBorderBottom, $wdBorderRight)) {
            $border = $Cell.Borders.Item($borderId)
            $border.LineStyle = $wdLineStyleSingle
            $border.LineWidth = 2
            $border.Color = $BorderColor
        }
    }

    function Add-AfterTableSpace {
        param([double]$Points = 7)
        Add-Text -Text "" -Size 2 -SpaceAfter $Points
    }

    function Add-Callout {
        param(
            [Parameter(Mandatory = $true)][string]$Text,
            [int]$Fill = $colorPanel,
            [int]$Accent = $colorCyan,
            [int]$TextColor = $colorNavy,
            [double]$FontSize = 13,
            [bool]$Center = $false
        )
        $table = Add-Table -Rows 1 -Columns 1
        Set-Cell -Cell $table.Cell(1, 1) -Text $Text -Fill $Fill -FontColor $TextColor -FontSize $FontSize -Bold $true -Align $(if ($Center) { $wdAlignCenter } else { $wdAlignLeft }) -BorderColor $Fill
        $leftBorder = $table.Cell(1, 1).Borders.Item($wdBorderLeft)
        $leftBorder.Color = $Accent
        $leftBorder.LineWidth = 18
        $table.Rows.Item(1).Height = Cm 1.4
        Add-AfterTableSpace -Points 10
    }

    function Add-FlowStack {
        param([Parameter(Mandatory = $true)][string[]]$Items)
        for ($i = 0; $i -lt $Items.Count; $i++) {
            $fill = if ($i -eq 0) { $colorNavy } elseif ($i -eq $Items.Count - 1) { $colorBlue } else { $colorPanelBlue }
            $fontColor = if (($i -eq 0) -or ($i -eq $Items.Count - 1)) { $colorWhite } else { $colorNavy }
            $border = if (($i -eq 0) -or ($i -eq $Items.Count - 1)) { $fill } else { $colorLine }
            $table = Add-Table -Rows 1 -Columns 1
            Set-Cell -Cell $table.Cell(1, 1) -Text $Items[$i] -Fill $fill -FontColor $fontColor -FontSize 11.2 -Bold $true -Align $wdAlignCenter -BorderColor $border
            $table.Rows.Item(1).Height = Cm 0.92
            if ($i -lt $Items.Count - 1) {
                Add-Text -Text "↓" -Size 13 -Color $colorCyan -Bold $true -Align $wdAlignCenter -SpaceAfter 1 -SpaceBefore 1
            }
        }
        Add-AfterTableSpace -Points 7
    }

    function Add-DesignFormula {
        $table = Add-Table -Rows 1 -Columns 5
        $table.PreferredWidth = 100
        Set-Cell -Cell $table.Cell(1, 1) -Text "2026년의 밈" -Fill $colorNavy -FontColor $colorWhite -FontSize 11 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy
        Set-Cell -Cell $table.Cell(1, 2) -Text "+" -Fill $colorWhite -FontColor $colorCyan -FontSize 17 -Bold $true -Align $wdAlignCenter -BorderColor $colorWhite
        Set-Cell -Cell $table.Cell(1, 3) -Text "물리법칙" -Fill $colorBlue -FontColor $colorWhite -FontSize 11 -Bold $true -Align $wdAlignCenter -BorderColor $colorBlue
        Set-Cell -Cell $table.Cell(1, 4) -Text "+" -Fill $colorWhite -FontColor $colorCyan -FontSize 17 -Bold $true -Align $wdAlignCenter -BorderColor $colorWhite
        Set-Cell -Cell $table.Cell(1, 5) -Text "제한" -Fill $colorPink -FontColor $colorWhite -FontSize 11 -Bold $true -Align $wdAlignCenter -BorderColor $colorPink
        $table.Rows.Item(1).Height = Cm 1.2
        Add-Text -Text "↓" -Size 17 -Color $colorCyan -Bold $true -Align $wdAlignCenter -SpaceBefore 3 -SpaceAfter 3
        $result = Add-Table -Rows 1 -Columns 1
        Set-Cell -Cell $result.Cell(1, 1) -Text "20.26초 밈 미니게임" -Fill $colorNavy -FontColor $colorWhite -FontSize 15 -Bold $true -Align $wdAlignCenter -BorderColor $colorCyan
        $result.Rows.Item(1).Height = Cm 1.5
        Add-AfterTableSpace -Points 10
    }

    function Add-NumberedPrinciple {
        param([int]$Number, [string]$Title, [string]$Description)
        $table = Add-Table -Rows 1 -Columns 2
        $table.AllowAutoFit = 0
        $table.Columns.Item(1).Width = Cm 1.25
        $table.Columns.Item(2).Width = Cm 16.1
        Set-Cell -Cell $table.Cell(1, 1) -Text ("{0:D2}" -f $Number) -Fill $colorNavy -FontColor $colorCyan -FontSize 12 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy
        Set-Cell -Cell $table.Cell(1, 2) -Text ($Title + "`r" + $Description) -Fill $colorRowAlt -FontColor $colorBody -FontSize 9.5 -Bold $false -Align $wdAlignLeft -BorderColor $colorLine
        $table.Cell(1, 2).Range.Paragraphs.Item(1).Range.Font.Bold = 1
        $table.Cell(1, 2).Range.Paragraphs.Item(1).Range.Font.Color = $colorNavy
        Add-AfterTableSpace -Points 3
    }

    function Add-MinigameTable {
        param([Parameter(Mandatory = $true)][object[]]$Rows)
        $table = Add-Table -Rows ($Rows.Count + 1) -Columns 4
        $table.AllowAutoFit = 0
        $widths = @(2.4, 4.0, 4.4, 6.5)
        for ($c = 1; $c -le 4; $c++) {
            $table.Columns.Item($c).Width = Cm $widths[$c - 1]
        }
        $headers = @("미니게임", "핵심 조작", "물리 규칙", "제한·변화")
        for ($c = 1; $c -le 4; $c++) {
            Set-Cell -Cell $table.Cell(1, $c) -Text $headers[$c - 1] -Fill $colorNavy -FontColor $colorWhite -FontSize 8.8 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
        }
        $table.Rows.Item(1).HeadingFormat = -1
        for ($r = 0; $r -lt $Rows.Count; $r++) {
            $fill = if (($r % 2) -eq 0) { $colorWhite } else { $colorRowAlt }
            for ($c = 0; $c -lt 4; $c++) {
                Set-Cell -Cell $table.Cell($r + 2, $c + 1) -Text ([string]$Rows[$r][$c]) -Fill $fill -FontColor $(if ($c -eq 0) { $colorNavy } else { $colorBody }) -FontSize 8.4 -Bold ($c -eq 0) -Align $(if ($c -eq 0) { $wdAlignCenter } else { $wdAlignLeft }) -BorderColor $colorLine
            }
        }
        Add-AfterTableSpace -Points 5
    }

    # Document setup
    $section = $doc.Sections.Item(1)
    $section.PageSetup.PageWidth = Cm 21.0
    $section.PageSetup.PageHeight = Cm 29.7
    $section.PageSetup.TopMargin = Cm 1.55
    $section.PageSetup.BottomMargin = Cm 1.55
    $section.PageSetup.LeftMargin = Cm 1.8
    $section.PageSetup.RightMargin = Cm 1.8
    $section.PageSetup.HeaderDistance = Cm 0.7
    $section.PageSetup.FooterDistance = Cm 0.75
    $section.PageSetup.DifferentFirstPageHeaderFooter = -1

    # -1 is Word's language-independent built-in Normal style identifier.
    $normal = $doc.Styles.Item(-1)
    $normal.Font.Name = "맑은 고딕"
    $normal.Font.NameFarEast = "맑은 고딕"
    $normal.Font.Size = 10.4
    $normal.Font.Color = $colorBody
    $normal.ParagraphFormat.SpaceAfter = 6

    $header = $section.Headers.Item(1).Range
    $header.Text = "2026 ARCHIVE: LAST WITNESS   ·   HACKATHON GAME INTRODUCTION"
    $header.Font.Name = "맑은 고딕"
    $header.Font.NameFarEast = "맑은 고딕"
    $header.Font.Size = 7.5
    $header.Font.Bold = 1
    $header.Font.Color = $colorMuted
    $header.ParagraphFormat.Alignment = $wdAlignLeft
    $header.ParagraphFormat.Borders.Item($wdBorderBottom).LineStyle = $wdLineStyleSingle
    $header.ParagraphFormat.Borders.Item($wdBorderBottom).Color = $colorCyan

    $footer = $section.Footers.Item(1).Range
    $footer.Text = "2026년의 밈 × 물리법칙 × 제한     |     "
    $footer.Font.Name = "맑은 고딕"
    $footer.Font.NameFarEast = "맑은 고딕"
    $footer.Font.Size = 7.5
    $footer.Font.Color = $colorMuted
    $footer.ParagraphFormat.Alignment = $wdAlignRight
    $footer.Collapse($wdCollapseEnd)
    [void]$footer.Fields.Add($footer, -1, "PAGE", $true)

    # 1. Cover / game title
    Add-Text -Text "01  ·  게임 제목" -Size 8.5 -Color $colorCyan -Bold $true -SpaceBefore 8 -SpaceAfter 8
    Add-Text -Text "2026 ARCHIVE" -Size 34 -Color $colorNavy -Bold $true -SpaceAfter 0
    Add-Text -Text "LAST WITNESS" -Size 20 -Color $colorBlue -Bold $true -SpaceAfter 4
    Add-Text -Text "2026년의 밈을 20.26초로 플레이하다" -Size 12 -Color $colorMuted -Bold $true -SpaceAfter 12

    Move-ToEnd
    $picture = $selection.InlineShapes.AddPicture($coverImagePath)
    $picture.LockAspectRatio = -1
    $picture.Width = Cm 17.35
    $selection.TypeParagraph()
    Add-Text -Text "" -Size 2 -SpaceAfter 5

    $coverMeta = Add-Table -Rows 1 -Columns 4
    $coverMeta.AllowAutoFit = 0
    for ($c = 1; $c -le 4; $c++) { $coverMeta.Columns.Item($c).Width = Cm 4.32 }
    $meta = @("공통 주제`r2026년", "핵심 소재`r2026년의 밈", "주어진 소재`r물리법칙 · 제한", "공통 규칙`r20.26초")
    for ($c = 1; $c -le 4; $c++) {
        Set-Cell -Cell $coverMeta.Cell(1, $c) -Text $meta[$c - 1] -Fill $colorNavy -FontColor $(if ($c -eq 4) { $colorYellow } else { $colorWhite }) -FontSize 8.6 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
    }
    $coverMeta.Rows.Item(1).Height = Cm 1.35
    Add-AfterTableSpace -Points 6
    Add-Text -Text "HACKATHON SUBMISSION  ·  WEB GAME  ·  PHASER 3" -Size 7.5 -Color $colorMuted -Bold $true -Align $wdAlignCenter -SpaceAfter 0

    # 2. One-line introduction / 3. Intent
    Add-PageBreak
    Add-SectionTitle -Number 2 -Title "한 줄 소개" -Kicker "ONE-LINE PITCH"
    Add-Callout -Text "2026년에 유행한 밈을 물리법칙과 제한으로 재해석해, 각 20.26초 안에 직접 플레이하며 한 해를 되돌아보는 미니게임 모음형 웹게임." -Fill $colorPanel -Accent $colorCyan -TextColor $colorNavy -FontSize 14

    $summary = Add-Table -Rows 2 -Columns 4
    $labels = @("YEAR", "CULTURE", "FORMAT", "TIME")
    $values = @("2026년", "밈", "짧은 미니게임", "20.26초")
    for ($c = 1; $c -le 4; $c++) {
        Set-Cell -Cell $summary.Cell(1, $c) -Text $labels[$c - 1] -Fill $colorNavy -FontColor $colorCyan -FontSize 7.5 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
        Set-Cell -Cell $summary.Cell(2, $c) -Text $values[$c - 1] -Fill $colorPanelBlue -FontColor $colorNavy -FontSize 10.5 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
    }
    Add-AfterTableSpace -Points 16

    Add-SectionTitle -Number 3 -Title "기획 의도" -Kicker "DESIGN INTENT"
    Add-Body "해커톤의 공통 주제는 「2026년」이다. 우리 팀은 이 한 해를 특정 사건 하나로 고정하기보다, 사람들이 실제로 무엇을 보고 웃고 따라 했는지에 주목했다. 여러 사건을 나열하는 대신, 한 해의 일상적인 문화 경험을 게임으로 압축하는 방향을 선택했다."
    Add-Callout -Text "「2026년을 살아간 사람들은 나중에 이 해를 무엇으로 기억하게 될까?」" -Fill $colorPanelYellow -Accent $colorYellow -TextColor $colorNavy -FontSize 13 -Center $true
    Add-Body "2026년에는 AI가 일상과 콘텐츠 소비에 더욱 가까워졌고, 인터넷과 SNS에서는 머신러닝 기반 추천 시스템이 이용자의 반응과 관심사를 분석해 콘텐츠의 추천과 노출에 영향을 준다. 이는 우리 게임의 중심 주제가 아니라, 왜 2026년의 인터넷 문화에 주목했는지를 설명하는 시대적 배경이다."
    Add-Body "빠르게 생성되고 공유되는 콘텐츠 사이에서 사람들은 같은 이미지와 영상, 행동과 대사를 반복하고 변형한다. 우리 팀은 이 과정에서 만들어지는 「밈」이 2026년을 함께 기억하게 하는 가장 적합한 소재라고 판단했다."

    # 4. Why memes
    Add-PageBreak
    Add-SectionTitle -Number 4 -Title "주제 해석 — 왜 밈인가" -Kicker "WHY MEMES"
    Add-Body "밈은 단순히 재미있는 이미지나 영상만을 뜻하지 않는다. 본래 밈은 사람들 사이에서 모방되고 전달되며 퍼지는 문화적 요소를 의미한다. 인터넷에서는 특정 이미지, 영상, 행동, 대사, 소리, 상황이 반복적으로 공유되고 모방되면서 하나의 인터넷 밈으로 발전한다."
    Add-Callout -Text "우리 팀의 정의`r「특정 시기에 많은 사람들이 함께 보고, 반복하고, 공유하면서 만들어진 문화적 기억.」" -Fill $colorPanelPink -Accent $colorPink -TextColor $colorNavy -FontSize 12.5 -Center $true
    Add-Body "2026년의 밈을 모아 보면 그해 사람들이 무엇에 웃었고, 무엇을 반복했으며, 무엇에 관심을 가졌는지를 자연스럽게 떠올릴 수 있다. 그래서 사건 목록을 그대로 옮기는 대신, 2026년의 인터넷 문화와 기억을 압축해서 보여 줄 수 있는 밈을 선택했다."
    Add-Text -Text "주제 도출 흐름" -Size 12 -Color $colorNavy -Bold $true -SpaceBefore 7 -SpaceAfter 8 -KeepWithNext $true
    Add-FlowStack -Items @(
        "2026년",
        "AI와 추천 시스템이 일상화된 콘텐츠 환경",
        "빠르게 변화하는 인터넷 문화",
        "밈",
        "2026년의 밈을 플레이"
    )
    Add-Text -Text "※ 밈은 사람들의 공유·반복·모방으로 형성된다. 추천 시스템은 콘텐츠의 노출과 확산에 영향을 주는 환경적 요소로만 본다." -Size 8.4 -Color $colorMuted -SpaceBefore 3 -SpaceAfter 0

    # 5. Desired player experience
    Add-PageBreak
    Add-SectionTitle -Number 5 -Title "우리가 유저에게 주고 싶은 경험" -Kicker "PLAYER EXPERIENCE"
    Add-Body "현재는 2026년 9월이다. 한 해가 아직 끝나지 않았지만 이미 수많은 사건과 유행, 인터넷 문화가 나타났다. 우리는 플레이어가 게임을 진행하며 「아, 올해 이런 것도 있었지.」, 「이게 2026년에 유행했었지.」라고 자연스럽게 떠올리기를 원한다."
    Add-Callout -Text "핵심 경험`r2026년의 밈을 플레이하면서 아직 끝나지 않은 2026년을 한 번 되돌아보는 것." -Fill $colorPanel -Accent $colorCyan -TextColor $colorNavy -FontSize 14 -Center $true
    Add-Body "밈 목록이나 영상을 감상하는 방식만으로는 기억이 수동적으로 머문다. 이 게임은 밈의 특징적인 행동과 상황을 이동, 점프, 충돌, 발사, 회전 같은 플레이 행동으로 바꾼다. 플레이어는 짧은 시간 안에 직접 조작하고 실패하고 다시 시도하면서 해당 밈을 몸으로 기억한다."

    $experience = Add-Table -Rows 1 -Columns 7
    $experienceItems = @("밈을 발견", "→", "행동을 이해", "→", "직접 조작", "→", "2026년을 회상")
    for ($c = 1; $c -le 7; $c++) {
        if (($c % 2) -eq 0) {
            Set-Cell -Cell $experience.Cell(1, $c) -Text $experienceItems[$c - 1] -Fill $colorWhite -FontColor $colorCyan -FontSize 14 -Bold $true -Align $wdAlignCenter -BorderColor $colorWhite
        } else {
            $fill = if ($c -eq 7) { $colorBlue } else { $colorNavy }
            Set-Cell -Cell $experience.Cell(1, $c) -Text $experienceItems[$c - 1] -Fill $fill -FontColor $colorWhite -FontSize 9.2 -Bold $true -Align $wdAlignCenter -BorderColor $fill
        }
    }
    $experience.Rows.Item(1).Height = Cm 1.35
    Add-AfterTableSpace -Points 14
    Add-Body "따라서 이 게임은 2026년을 정답처럼 설명하는 게임이 아니다. 서로 다른 밈과 규칙을 빠르게 경험하게 하여, 플레이어 자신의 기억에서 2026년을 다시 꺼내게 하는 게임을 목표로 한다."

    # 6. Physics and constraints
    Add-PageBreak
    Add-SectionTitle -Number 6 -Title "소재 해석 — 물리법칙 / 제한" -Kicker "MATERIAL INTERPRETATION"
    Add-Text -Text "물리법칙 — 밈의 행동을 플레이 규칙으로 바꾸는 도구" -Size 13 -Color $colorNavy -Bold $true -SpaceAfter 6 -KeepWithNext $true
    Add-Body "우리 게임은 물리법칙을 물리학 교육이나 복잡한 계산 문제로 다루지 않는다. 중력, 충돌, 속도, 가속, 관성, 마찰, 반동, 회전과 힘의 전달을 이용해 밈의 특징적인 행동과 상황을 직접 조작 가능한 규칙으로 만든다."

    $physics = Add-Table -Rows 4 -Columns 3
    $physicsData = @(
        @("중력 · 낙하", "위아래 방향을 전환하거나 비행 고도를 조절", "중력 대쉬 · 중력 비행"),
        @("속도 · 관성 · 마찰", "방향 전환과 미끄러짐을 위험과 선택으로 전환", "가속 대쉬 · 얼음 컬링 · 피겨 암호"),
        @("충돌 · 반발 · 반동", "부딪힘과 발사의 결과가 다음 행동에 누적", "바운스볼 · 두쫀쿠 새총"),
        @("회전 · 힘의 전달", "물체를 놓고 쌓고 휘두르는 손맛을 구성", "사람 쌓기 · 월드컵 조추첨 · 거미줄 질주")
    )
    for ($r = 1; $r -le 4; $r++) {
        Set-Cell -Cell $physics.Cell($r, 1) -Text $physicsData[$r - 1][0] -Fill $colorNavy -FontColor $colorWhite -FontSize 9 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
        Set-Cell -Cell $physics.Cell($r, 2) -Text $physicsData[$r - 1][1] -Fill $(if (($r % 2) -eq 0) { $colorRowAlt } else { $colorWhite }) -FontColor $colorBody -FontSize 8.7 -BorderColor $colorLine
        Set-Cell -Cell $physics.Cell($r, 3) -Text $physicsData[$r - 1][2] -Fill $colorPanelBlue -FontColor $colorNavy -FontSize 8.5 -BorderColor $colorLine
    }
    Add-AfterTableSpace -Points 13

    Add-Text -Text "제한 — 짧은 시간에 긴장과 선택을 만드는 장치" -Size 13 -Color $colorNavy -Bold $true -SpaceAfter 6 -KeepWithNext $true
    Add-Body "모든 스테이지에는 20.26초라는 공통 시간제한이 있다. 여기에 미니게임마다 이동, 행동 횟수, 공간, 시야, 충돌, 반복 입력에 따른 변화 같은 제한을 더한다. 제한은 플레이어를 일방적으로 방해하는 벌칙이 아니라, 짧은 시간 안에 각 밈만의 독특한 리듬을 만드는 핵심 규칙이다."
    Add-Bullet "방향을 바꾸거나 행동을 반복할수록 속도·마찰·조작 감각이 달라진다."
    Add-Bullet "충돌과 실패의 결과가 다음 시도 또는 남은 시간에 영향을 준다."
    Add-Bullet "목표는 빠르게 이해할 수 있지만, 제한 때문에 마지막까지 판단이 필요하다."
    Add-Callout -Text "물리법칙은 「어떻게 움직일까」를 만들고, 제한은 「언제 무엇을 선택할까」를 만든다." -Fill $colorPanelYellow -Accent $colorYellow -TextColor $colorNavy -FontSize 12.5 -Center $true

    # 7. Design principles
    Add-PageBreak
    Add-SectionTitle -Number 7 -Title "세 요소의 결합 — 미니게임 설계 원칙" -Kicker "MINIGAME DESIGN PRINCIPLE"
    Add-DesignFormula
    Add-NumberedPrinciple -Number 1 -Title "밈의 핵심을 찾는다" -Description "사람들이 가장 쉽게 기억하는 행동, 상황, 움직임, 대사 또는 시각적 특징을 한 문장으로 정리한다."
    Add-NumberedPrinciple -Number 2 -Title "플레이 행동으로 변환한다" -Description "밈의 핵심을 이동, 점프, 발사, 잡기, 놓기, 회전처럼 즉시 이해할 수 있는 입력으로 바꾼다."
    Add-NumberedPrinciple -Number 3 -Title "물리법칙을 적용한다" -Description "중력, 속도, 충돌, 관성, 마찰 등 밈의 움직임을 가장 잘 살리는 규칙으로 손맛을 만든다."
    Add-NumberedPrinciple -Number 4 -Title "제한을 적용한다" -Description "20.26초와 행동·공간·반복 제한을 더해 짧고 선명한 도전으로 완성한다."
    Add-NumberedPrinciple -Number 5 -Title "원본 밈의 특징을 유지한다" -Description "게임화를 위한 규칙이 원본의 재미와 인지도를 가리지 않도록 목표와 조작을 단순하게 유지한다."
    Add-Text -Text "설계 예시 · 거미줄 질주" -Size 11.5 -Color $colorNavy -Bold $true -SpaceBefore 7 -SpaceAfter 5 -KeepWithNext $true
    Add-Body "고리를 연결하고 놓는 동작을 입력으로 삼고, 장력·관성·낙하를 물리 규칙으로 사용한다. 새로운 고리를 잡을수록 속도가 높아지는 제한을 더해, 20.26초 안에 목표까지 도달하는 짧은 질주로 완성한다."

    # 8. Core concept and actual game snapshot
    Add-PageBreak
    Add-SectionTitle -Number 8 -Title "핵심 콘셉트" -Kicker "CORE CONCEPT"
    Add-Body "《2026 ARCHIVE: LAST WITNESS》는 2026년에 유행한 다양한 밈을 짧은 미니게임으로 직접 플레이하는 Phaser 3 기반 웹게임이다. 밈을 보여 주는 데서 끝내지 않고, 밈의 핵심 행동과 상황을 서로 다른 조작과 물리 규칙으로 재해석한다."
    Add-Callout -Text "짧게 이해하고 → 바로 조작하고 → 20.26초 안에 결과를 확인한다." -Fill $colorPanel -Accent $colorCyan -TextColor $colorNavy -FontSize 13 -Center $true

    $snapshot = Add-Table -Rows 3 -Columns 4
    $snapshotLabels = @("플랫폼", "구현 방식", "미니게임", "한 회차"), @("웹 브라우저", "Phaser 3", "10종", "3막 × 6 = 18개 기록"), @("공통 시간", "막별 기억", "선정 방식", "주요 입력"), @("20.26초", "3개", "막마다 10종 중 6종", "키보드 · 마우스 · 터치")
    for ($c = 1; $c -le 4; $c++) {
        Set-Cell -Cell $snapshot.Cell(1, $c) -Text $snapshotLabels[0][$c - 1] -Fill $colorNavy -FontColor $colorCyan -FontSize 7.4 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
        Set-Cell -Cell $snapshot.Cell(2, $c) -Text $snapshotLabels[1][$c - 1] -Fill $colorPanelBlue -FontColor $colorNavy -FontSize 9.2 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
        Set-Cell -Cell $snapshot.Cell(3, $c) -Text ($snapshotLabels[2][$c - 1] + "`r" + $snapshotLabels[3][$c - 1]) -Fill $colorWhite -FontColor $colorBody -FontSize 8.3 -Bold $false -Align $wdAlignCenter -BorderColor $colorLine
        $snapshot.Cell(3, $c).Range.Paragraphs.Item(1).Range.Font.Bold = 1
        $snapshot.Cell(3, $c).Range.Paragraphs.Item(1).Range.Font.Color = $colorMuted
    }
    Add-AfterTableSpace -Points 12

    Add-Text -Text "현재 구현된 10개 미니게임 · 1/2" -Size 12 -Color $colorNavy -Bold $true -SpaceAfter 7 -KeepWithNext $true
    $games1 = @(
        @("중력 대쉬", "Space로 중력 전환", "중력 · 낙하 · 충돌", "전환할수록 낙하 장애물 증가"),
        @("바운스볼", "A/D 이동, Space 점프, W/S 공중 제어", "점프 · 반발 · 낙하", "피해가 누적될수록 점프력이 감소"),
        @("사람 쌓기", "A/D 회전, Space·클릭으로 놓기", "회전 · 충돌 · 무게중심", "놓을수록 좌우 이동 속도 증가"),
        @("가속 대쉬", "방향키·WASD 이동, 입력 해제로 감속", "속도 · 가속 · 마찰", "새 방향마다 가속, 벽 충돌 시 시간 감소"),
        @("두쫀쿠 새총", "마우스로 당긴 뒤 놓아 발사", "탄성 · 궤적 · 반동", "발사할수록 새총의 장력이 감소")
    )
    Add-MinigameTable -Rows $games1
    Add-Text -Text "서사 프레임" -Size 11.5 -Color $colorNavy -Bold $true -SpaceBefore 4 -SpaceAfter 5 -KeepWithNext $true
    Add-Body "플레이어 김민은 사라지는 2026년의 밈 기록을 직접 재현하며 아카이브를 복구하고, 관리 AI ARIA-26의 기록 조작을 추적한다. 이 서사는 서로 다른 미니게임을 하나의 여정으로 연결하되, 게임의 중심 경험은 끝까지 「2026년의 밈을 직접 플레이하는 것」에 둔다."

    Add-PageBreak
    Add-Text -Text "08  ·  CORE CONCEPT" -Size 8.5 -Color $colorCyan -Bold $true -SpaceAfter 2 -KeepWithNext $true
    Add-Text -Text "8. 핵심 콘셉트 — 현재 구현 미니게임" -Size 21 -Color $colorNavy -Bold $true -SpaceAfter 6 -KeepWithNext $true
    Add-Text -Text "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -Size 5 -Color $colorCyan -SpaceAfter 13 -KeepWithNext $true
    Add-Text -Text "현재 구현된 10개 미니게임 · 2/2" -Size 12 -Color $colorNavy -Bold $true -SpaceAfter 7 -KeepWithNext $true
    $games2 = @(
        @("중력 비행", "Space를 누르고 떼어 고도 조절", "상승 · 하강 · 충돌", "장애물 충돌 시 뒤로 밀려남"),
        @("월드컵 조추첨", "공을 잡아 돌린 뒤 놓기", "회전 · 마찰 · 관성", "실패할수록 마찰 감소, 회전 지속 증가"),
        @("거미줄 질주", "Space·클릭으로 고리 연결·해제", "장력 · 관성 · 낙하", "새 고리 연결마다 속도 상승"),
        @("얼음 컬링", "마우스로 당긴 뒤 놓기", "마찰 · 관성 · 힘의 전달", "실패할수록 얼음이 더 미끄러워짐"),
        @("피겨 암호", "A/D·방향키 이동, Space 점프", "마찰 · 가속 · 충돌", "방향 입력이 쌓일수록 마찰과 가속 감소")
    )
    Add-MinigameTable -Rows $games2

    Add-Text -Text "미니게임 공통 설계 기준" -Size 12 -Color $colorNavy -Bold $true -SpaceBefore 10 -SpaceAfter 7 -KeepWithNext $true
    $commonRules = Add-Table -Rows 4 -Columns 2
    $commonData = @(
        @("즉시 이해", "긴 설명보다 목표 표시, 움직임과 피드백으로 규칙을 전달한다."),
        @("입력 다양성", "키보드, 방향키, WASD, 마우스, 터치를 밈의 행동에 맞게 선택한다."),
        @("짧은 완결", "20.26초 안에서 시작·판단·성공 또는 실패가 모두 끝난다."),
        @("원본 우선", "새 규칙을 과도하게 덧붙이지 않고 밈의 대표 행동을 중심에 둔다.")
    )
    for ($r = 1; $r -le 4; $r++) {
        Set-Cell -Cell $commonRules.Cell($r, 1) -Text $commonData[$r - 1][0] -Fill $colorNavy -FontColor $colorWhite -FontSize 9.2 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
        Set-Cell -Cell $commonRules.Cell($r, 2) -Text $commonData[$r - 1][1] -Fill $(if (($r % 2) -eq 0) { $colorRowAlt } else { $colorWhite }) -FontColor $colorBody -FontSize 9 -BorderColor $colorLine
    }
    Add-AfterTableSpace -Points 13
    Add-Callout -Text "미니게임마다 규칙은 다르지만, 「밈의 특징을 조작한다」는 경험과 「20.26초 안에 끝난다」는 리듬은 같다." -Fill $colorPanelYellow -Accent $colorYellow -TextColor $colorNavy -FontSize 12.5 -Center $true

    # 9. 20.26-second system
    Add-PageBreak
    Add-SectionTitle -Number 9 -Title "20.26초 시스템" -Kicker "COMMON TIME RULE"
    Add-Callout -Text "20.26초는 「2026」을 설명문이 아니라 실제 플레이 규칙으로 바꾼 수치다." -Fill $colorPanel -Accent $colorCyan -TextColor $colorNavy -FontSize 14 -Center $true
    Add-Body "각 미니게임에서 플레이어는 정확히 20.26초 안에 목표를 수행해야 한다. 이 시간은 짧은 콘텐츠를 빠르게 소비하고 바로 다음 콘텐츠로 넘어가는 인터넷 문화의 리듬과도 연결된다. 서로 다른 조작과 물리 규칙을 가진 10개 미니게임은 20.26초라는 동일한 박자로 하나의 게임이 된다."

    Add-Text -Text "한 스테이지의 기본 흐름" -Size 12 -Color $colorNavy -Bold $true -SpaceBefore 8 -SpaceAfter 8 -KeepWithNext $true
    Add-FlowStack -Items @(
        "게임 시작",
        "3 · 2 · 1 카운트다운",
        "20.26초 타이머 시작",
        "밈 기반 미니게임 플레이",
        "목표 성공 또는 시간 초과",
        "결과 처리 후 다음 진행"
    )

    $timerRules = Add-Table -Rows 2 -Columns 2
    Set-Cell -Cell $timerRules.Cell(1, 1) -Text "타이머가 흐르는 때" -Fill $colorNavy -FontColor $colorCyan -FontSize 9.3 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
    Set-Cell -Cell $timerRules.Cell(1, 2) -Text "타이머가 멈추는 때" -Fill $colorNavy -FontColor $colorYellow -FontSize 9.3 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy2
    Set-Cell -Cell $timerRules.Cell(2, 1) -Text "카운트다운이 끝나고`r실제 미니게임을 조작하는 동안" -Fill $colorPanel -FontColor $colorNavy -FontSize 9.3 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
    Set-Cell -Cell $timerRules.Cell(2, 2) -Text "오프닝 · 막 소개 · 결과 · 컷신`r설정 · 일시정지 · 화면 전환" -Fill $colorPanelYellow -FontColor $colorNavy -FontSize 9.3 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
    Add-AfterTableSpace -Points 8

    # 10. Overall play structure
    Add-PageBreak
    Add-SectionTitle -Number 10 -Title "전체 플레이 구조" -Kicker "FULL GAME FLOW"
    Add-Body "플레이어는 타이틀과 메인 화면에서 새 게임 또는 이어하기를 선택한다. 새 게임에서는 오프닝 이후 1막이 시작되며, 각 막은 10개 미니게임 중 중복 없이 무작위로 선택된 6개로 구성된다. 세 막을 모두 완료하면 총 18개의 기록을 경험하고 엔딩에 도달한다."

    $actOverview = Add-Table -Rows 2 -Columns 3
    $acts = @("1막 · 복구", "2막 · 조사", "3막 · 증언")
    $actDescriptions = @("안내를 따라 밈 기록을 복구", "삭제 경로와 실행 주체를 추적", "조작 증거를 모아 외부에 전송")
    for ($c = 1; $c -le 3; $c++) {
        Set-Cell -Cell $actOverview.Cell(1, $c) -Text $acts[$c - 1] -Fill $(if ($c -eq 2) { $colorBlue } elseif ($c -eq 3) { $colorPink } else { $colorNavy }) -FontColor $colorWhite -FontSize 10.2 -Bold $true -Align $wdAlignCenter -BorderColor $colorWhite
        Set-Cell -Cell $actOverview.Cell(2, $c) -Text $actDescriptions[$c - 1] -Fill $(if ($c -eq 2) { $colorPanelBlue } elseif ($c -eq 3) { $colorPanelPink } else { $colorPanel }) -FontColor $colorNavy -FontSize 8.6 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
    }
    Add-AfterTableSpace -Points 10

    Add-Text -Text "전체 진행" -Size 12 -Color $colorNavy -Bold $true -SpaceAfter 7 -KeepWithNext $true
    Add-FlowStack -Items @(
        "타이틀 · 메인 화면 — 새 게임 / 이어하기",
        "오프닝 — 새 게임에서 재생",
        "막 시작 — 10종 중 6종을 중복 없이 무작위 선정",
        "브리핑 · 카운트다운 · 20.26초 플레이",
        "6개 기록 완료 — 다음 막 컷신",
        "3막 · 총 18개 기록 완료 — 엔딩"
    )

    Add-Text -Text "성공과 실패의 분기" -Size 12 -Color $colorNavy -Bold $true -SpaceBefore 5 -SpaceAfter 7 -KeepWithNext $true
    $branch = Add-Table -Rows 3 -Columns 2
    Set-Cell -Cell $branch.Cell(1, 1) -Text "성공" -Fill $colorBlue -FontColor $colorWhite -FontSize 10 -Bold $true -Align $wdAlignCenter -BorderColor $colorBlue
    Set-Cell -Cell $branch.Cell(1, 2) -Text "실패 · 시간 초과" -Fill $colorPink -FontColor $colorWhite -FontSize 10 -Bold $true -Align $wdAlignCenter -BorderColor $colorPink
    Set-Cell -Cell $branch.Cell(2, 1) -Text "기록 1개 확보`r다음 미니게임으로 이동" -Fill $colorPanelBlue -FontColor $colorNavy -FontSize 9.2 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
    Set-Cell -Cell $branch.Cell(2, 2) -Text "기억 1개 소진`r기억이 남으면 같은 구성으로 재도전" -Fill $colorPanelPink -FontColor $colorNavy -FontSize 9.2 -Bold $true -Align $wdAlignCenter -BorderColor $colorLine
    Set-Cell -Cell $branch.Cell(3, 1) -Text "막의 6개 기록을 모두 확보하면`r완료 상태를 저장하고 다음 막 진행" -Fill $colorWhite -FontColor $colorBody -FontSize 8.8 -Align $wdAlignCenter -BorderColor $colorLine
    Set-Cell -Cell $branch.Cell(3, 2) -Text "기억 3개를 모두 잃으면`r현재 막만 초기화하고 6개 게임을 다시 선정`r이전 막의 완료 기록은 유지" -Fill $colorWhite -FontColor $colorBody -FontSize 8.8 -Align $wdAlignCenter -BorderColor $colorLine
    Add-AfterTableSpace -Points 8
    Add-Text -Text "이어하기는 현재 막, 선택된 게임, 진행 스테이지, 남은 기억과 도전 상태를 저장해 다음 접속에서 이어 준다." -Size 8.6 -Color $colorMuted -SpaceAfter 0

    # 11. Differentiators
    Add-PageBreak
    Add-SectionTitle -Number 11 -Title "게임의 차별점" -Kicker "KEY DIFFERENTIATORS"
    $differences = @(
        @("01", "2026년을 「인터넷 문화」로 해석", "특정 사건 하나가 아니라 여러 사람이 함께 소비하고 기억한 밈을 통해 한 해를 표현한다."),
        @("02", "밈을 보는 것이 아니라 플레이", "이미지나 영상을 감상하는 대신 밈의 대표 행동과 상황을 직접 조작하고 결과를 만든다."),
        @("03", "주제와 소재를 게임 규칙으로 연결", "2026은 20.26초가 되고, 물리법칙과 제한은 각 미니게임의 조작과 난이도가 된다."),
        @("04", "하나의 규칙이 아닌 10개의 미니게임", "중력, 가속, 충돌, 반동, 마찰, 회전 등 밈의 특징에 맞는 서로 다른 플레이를 제공한다."),
        @("05", "2026년을 되돌아보는 반복 구조", "서로 다른 밈과 규칙을 짧게 연속 경험하며 「2026년에 이런 것들이 있었지.」라는 회상을 만든다.")
    )
    foreach ($item in $differences) {
        $table = Add-Table -Rows 1 -Columns 2
        $table.AllowAutoFit = 0
        $table.Columns.Item(1).Width = Cm 1.35
        $table.Columns.Item(2).Width = Cm 16.0
        Set-Cell -Cell $table.Cell(1, 1) -Text $item[0] -Fill $colorNavy -FontColor $colorCyan -FontSize 11 -Bold $true -Align $wdAlignCenter -BorderColor $colorNavy
        Set-Cell -Cell $table.Cell(1, 2) -Text ($item[1] + "`r" + $item[2]) -Fill $colorRowAlt -FontColor $colorBody -FontSize 9.4 -BorderColor $colorLine
        $table.Cell(1, 2).Range.Paragraphs.Item(1).Range.Font.Bold = 1
        $table.Cell(1, 2).Range.Paragraphs.Item(1).Range.Font.Color = $colorNavy
        Add-AfterTableSpace -Points 5
    }

    Add-Callout -Text "2026 ARCHIVE: LAST WITNESS`r2026년의 밈을 20.26초씩 직접 플레이하며, 아직 끝나지 않은 한 해를 다시 떠올리는 게임." -Fill $colorNavy -Accent $colorCyan -TextColor $colorWhite -FontSize 14 -Center $true
    Add-Text -Text "문서 기준: 2026년 9월 현재 프로젝트 구현 · 실제 미니게임 카탈로그 및 진행 구조 반영" -Size 8.2 -Color $colorMuted -Align $wdAlignCenter -SpaceBefore 8 -SpaceAfter 0

    # Save in the modern Word .docx format.
    $doc.Repaginate()
    $doc.SaveAs2($outputPath, $wdFormatDocumentDefault)
    $doc.Close(0)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)
    $doc = $null

    # Reopen and validate the generated Word document.
    $checkDoc = $word.Documents.Open($outputPath, $false, $true)
    $text = $checkDoc.Content.Text
    $requiredTexts = @(
        "2026 ARCHIVE",
        "LAST WITNESS",
        "2. 한 줄 소개",
        "3. 기획 의도",
        "4. 주제 해석 — 왜 밈인가",
        "5. 우리가 유저에게 주고 싶은 경험",
        "6. 소재 해석 — 물리법칙 / 제한",
        "7. 세 요소의 결합 — 미니게임 설계 원칙",
        "8. 핵심 콘셉트",
        "9. 20.26초 시스템",
        "10. 전체 플레이 구조",
        "11. 게임의 차별점",
        "AI와 추천 시스템이 일상화된 콘텐츠 환경",
        "20.26초 밈 미니게임",
        "10종 중 6종을 중복 없이 무작위 선정",
        "기억 3개"
    )
    $missing = @($requiredTexts | Where-Object { $text.IndexOf($_, [StringComparison]::Ordinal) -lt 0 })
    if ($missing.Count -gt 0) {
        throw "문서 필수 문구 누락: $($missing -join ', ')"
    }

    $sectionOrder = @(
        "2. 한 줄 소개",
        "3. 기획 의도",
        "4. 주제 해석 — 왜 밈인가",
        "5. 우리가 유저에게 주고 싶은 경험",
        "6. 소재 해석 — 물리법칙 / 제한",
        "7. 세 요소의 결합 — 미니게임 설계 원칙",
        "8. 핵심 콘셉트",
        "9. 20.26초 시스템",
        "10. 전체 플레이 구조",
        "11. 게임의 차별점"
    )
    $lastIndex = -1
    foreach ($heading in $sectionOrder) {
        $index = $text.IndexOf($heading, [StringComparison]::Ordinal)
        if ($index -le $lastIndex) {
            throw "문서 목차 순서 오류: $heading"
        }
        $lastIndex = $index
    }

    if ($text.Contains("2분 23초") -or $text.Contains("LIVES")) {
        throw "현재 구현과 다른 예전 규칙 문구가 포함되었습니다."
    }

    $pageCount = $checkDoc.ComputeStatistics($wdStatisticPages)
    $tableCount = $checkDoc.Tables.Count
    $imageCount = $checkDoc.InlineShapes.Count
    $paragraphCount = $checkDoc.Paragraphs.Count
    $checkDoc.Close(0)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($checkDoc)
    $checkDoc = $null

    Write-Output "DOCX_CREATED=$outputPath"
    Write-Output "PAGES=$pageCount"
    Write-Output "TABLES=$tableCount"
    Write-Output "IMAGES=$imageCount"
    Write-Output "PARAGRAPHS=$paragraphCount"
    Write-Output "VALIDATION=PASS"
}
finally {
    if ($checkDoc -ne $null) {
        try { $checkDoc.Close(0) } catch {}
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($checkDoc)
    }
    if ($doc -ne $null) {
        try { $doc.Close(0) } catch {}
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)
    }
    if ($word -ne $null) {
        try { $word.Quit() } catch {}
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
