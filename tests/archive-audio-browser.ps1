$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null
$root = Split-Path -Parent $PSScriptRoot
$profile = Join-Path ([IO.Path]::GetTempPath()) ("archive-audio-" + [guid]::NewGuid())
$chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"
$browser = Start-Process -FilePath $chrome -WindowStyle Hidden -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=document-user-activation-required", "--remote-debugging-port=0",
  "--user-data-dir=`"$profile`"", "--window-size=1440,1000", "about:blank"
)
$socket = [Net.WebSockets.ClientWebSocket]::new()
$socket.Options.Proxy = [Net.WebProxy]::new()
$script:requestId = 0
function Send-Cdp($method, $parameters = @{}) {
  $script:requestId++
  $id = $script:requestId
  $json = @{ id = $id; method = $method; params = $parameters } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $timeout = [Threading.CancellationTokenSource]::new(15000)
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
  $portFile = Join-Path $profile "DevToolsActivePort"
  for ($i = 0; $i -lt 100 -and !(Test-Path $portFile); $i++) { Start-Sleep -Milliseconds 100 }
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
  Write-Output "Connecting to $($page.webSocketDebuggerUrl)"
  $socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  Send-Cdp "Page.enable" | Out-Null
  Send-Cdp "Page.navigate" @{ url = ([Uri](Join-Path $root "index.html")).AbsoluteUri } | Out-Null
  $ready = $false
  for ($i = 0; $i -lt 100; $i++) {
    $ready = Evaluate "Boolean(window.archiveGame && window.archiveAudio && archiveGameBridge.api)"
    if ($ready) { break }
    Start-Sleep -Milliseconds 100
  }
  if (!$ready) { throw "Game did not become ready" }
  if (!(Evaluate "archiveAudio.bgm.paused")) { throw "Strict autoplay should block initial playback" }
  Evaluate "audioBus.setMuted(true); audioBus.setVolume('master', 0); audioBus.setVolume('bgm', 0); true" | Out-Null
  $position = Evaluate "(() => { const r = document.querySelector('#main-play-button').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()"
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $position.x; y = $position.y; button = "left"; clickCount = 1 } | Out-Null
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $position.x; y = $position.y; button = "left"; clickCount = 1 } | Out-Null
  # 오프닝과 첫 기록 소개를 건너뛴 뒤 실제 스테이지가 시작되는 시점에 저장된 무음 설정을 복구한다.
  Evaluate "cutsceneFlow.finish(); cutsceneFlow.finish(); true" | Out-Null
  Start-Sleep -Milliseconds 1500
  $playing = Evaluate "({paused:archiveAudio.bgm.paused,time:archiveAudio.bgm.currentTime,volume:archiveAudio.bgm.volume,muted:audioBus.muted,loop:archiveAudio.bgm.loop,error:archiveAudio.bgm.error?.code ?? null})"
  if ($playing.paused -or $playing.time -le 0 -or $playing.volume -le 0 -or $playing.muted -or !$playing.loop -or $playing.error) {
    throw ("Playback failed: " + ($playing | ConvertTo-Json -Compress))
  }
  Evaluate "audioBus.setVolume('bgm', 0.2); true" | Out-Null
  if ([Math]::Abs((Evaluate "archiveAudio.bgm.volume") - 0.16) -gt 0.001) { throw "BGM volume not applied" }
  Evaluate "audioBus.setMuted(true); true" | Out-Null
  if ((Evaluate "archiveAudio.bgm.volume") -ne 0) { throw "Mute not applied" }
  Evaluate "archiveGameBridge.start(archiveGameBridge.stages[0].id); true" | Out-Null
  if (!(Evaluate "!archiveAudio.bgm.paused && archiveAudio.bgm.volume > 0 && !audioBus.muted")) { throw "Stage start did not restore audio" }
  Evaluate "archiveGameBridge.restart(); true" | Out-Null
  if (!(Evaluate "!archiveAudio.bgm.paused && archiveAudio.bgm.volume > 0")) { throw "Restart lost audio" }
  Write-Output ("PASS: blocked autoplay, real start click, silent settings recovery, MP3 playback, volume, mute, stage start and restart. " + ($playing | ConvertTo-Json -Compress))
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
}
