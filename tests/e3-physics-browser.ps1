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
$script:browserErrors = [Collections.Generic.List[string]]::new()
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
      if ($message.method -eq 'Runtime.exceptionThrown') { $script:browserErrors.Add(($message.params.exceptionDetails | ConvertTo-Json -Depth 8 -Compress)) }
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
  Send-Cdp "Runtime.enable" | Out-Null
  Send-Cdp "Page.navigate" @{ url = ([Uri](Join-Path $root "index.html")).AbsoluteUri } | Out-Null
  $ready = $false
  for ($i = 0; $i -lt 100; $i++) {
    $ready = Evaluate "Boolean(window.archiveGame && window.archiveAudio && archiveGameBridge.api)"
    if ($ready) { break }
    Start-Sleep -Milliseconds 100
  }
  if (!$ready) { throw "Game did not become ready" }
  $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e3-physics-check.js')))
  Write-Output ($checks | ConvertTo-Json -Depth 15)
  $artifactDir = Join-Path $root 'tests/.artifacts'
  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  Evaluate "mainMenuFlow.close(); protocolSelectFlow.open(); protocolSelectFlow.showScreen('play'); const e3view = archivePhaserGame.scene.getScene('archive-game'); UI.stageHud.hidden=false; UI.stageHudTimer.hidden=false; UI.stageHudTitle.textContent='E3 · 사람 쌓기'; UI.stageHudTimer.textContent=e3view.remaining.toFixed(2); UI.stageHudAnomaly.textContent='실제 접촉과 무게중심으로 지탱한 탑'; UI.stageHudAction.textContent='낙하 '+e3view.state.drops; archivePhaserGame.loop.wake();" | Out-Null
  Start-Sleep -Milliseconds 100
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e3-tower.png'), [Convert]::FromBase64String($shot.data))
  Evaluate "archivePhaserGame.loop.sleep(); e3view.loadStage('e3'); e3view.startStage(); e3view.state.x=558; e3view.primaryAction(); for(let i=0;i<360;i++) e3view.update(0,1000/120); e3view.state.x=570; e3view.primaryAction(); for(let i=0;i<360;i++) e3view.update(0,1000/120); archiveGame.pause(true); UI.stageHudTimer.textContent=e3view.remaining.toFixed(2); UI.stageHudAction.textContent='DROP 2'; archivePhaserGame.loop.wake();" | Out-Null
  Start-Sleep -Milliseconds 100
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e3-topple.png'), [Convert]::FromBase64String($shot.data))
  $skinLoaded = Evaluate "new Promise(resolve => { const finish=()=>resolve({exists:e3view.textures.exists('e3:file-skin'),failed:e3view.load.totalFailed}); e3view.load.once('complete',finish); e3view.load.image('e3:file-skin','tests/fixtures/e3-test-skin.svg'); e3view.load.start(); setTimeout(finish,5000); })"
  if (!$skinLoaded.exists) { throw ('Local file skin failed to load: ' + ($skinLoaded | ConvertTo-Json -Compress)) }
  Write-Output 'PASS: local SVG skin loading through file://'
  if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
}
