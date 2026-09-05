param([switch]$E4Only)
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
  if ($E4Only) {
    $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e4-maze-check.js')))
    Write-Output ($checks | ConvertTo-Json -Depth 10)
    Evaluate "archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); for(let i=0;i<100 && !archiveRun.snapshot().selectedStageIds.includes('e4');i++) protocolSelectFlow.reset(); protocolSelectFlow.open(); protocolSelectFlow.launchStage('e4'); archivePhaserGame.loop.wake(); archiveGame.pause(true);" | Out-Null
    Start-Sleep -Milliseconds 100
    $artifactDir = Join-Path $root 'tests/.artifacts'
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e4-maze.png'), [Convert]::FromBase64String($shot.data))
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    Write-Output 'PASS: E4 maze collision, timer, retry, and 25 generated mazes'
    return
  }
  Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e2-course-driver.js'))) | Out-Null
  Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e8-course-driver.js'))) | Out-Null
  $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/minigame-browser-check.js')))
  Write-Output ($checks | ConvertTo-Json -Depth 20)
  $playability = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/minigame-clearability.js')))
  Write-Output ($playability | ConvertTo-Json -Depth 20)
  # Browser keyboard/mouse events, including the existing CSS-scaled monitor.
  Evaluate "window.testLaunch = id => { archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); for(let i=0;i<100 && !archiveRun.snapshot().selectedStageIds.includes(id);i++) protocolSelectFlow.reset(); protocolSelectFlow.open(); protocolSelectFlow.launchStage(id); archivePhaserGame.loop.wake(); }; testLaunch('e2');" | Out-Null
  Start-Sleep -Milliseconds 100
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 100
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32; autoRepeat = $true } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  $keyState = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return {actions:s.actions,mode:s.mode,paused:s.pausedByMenu,elapsed:s.elapsed,key:s.keys.action.isDown,focused:document.activeElement?.id}; })()"
  if ($keyState.actions -ne 1) { throw ('Keyboard space/repeat routing failed: ' + ($keyState | ConvertTo-Json -Compress)) }
  Evaluate "testLaunch('e5')" | Out-Null
  $rect = Evaluate "(() => { const r=archivePhaserGame.canvas.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()"
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mousePressed'; button = 'left'; buttons = 1; clickCount = 1; x = $rect.x + 164 * $rect.w / 960; y = $rect.y + 382 * $rect.h / 540 } | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseMoved'; button = 'left'; buttons = 1; x = $rect.x + 70 * $rect.w / 960; y = $rect.y + 430 * $rect.h / 540 } | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseReleased'; button = 'left'; buttons = 0; clickCount = 1; x = $rect.x + 70 * $rect.w / 960; y = $rect.y + 430 * $rect.h / 540 } | Out-Null
  if (!(Evaluate "archivePhaserGame.scene.getScene('archive-game').state.shots === 1")) { throw 'Scaled pointer drag/release routing failed' }
  Write-Output 'PASS: native keyboard repeat suppression and mouse drag in scaled viewport'
  $artifactDir = Join-Path $root 'tests/.artifacts'
  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  foreach ($stageNumber in 1..9) {
    Evaluate "testLaunch('e$stageNumber'); archiveGame.pause(true);" | Out-Null
    Start-Sleep -Milliseconds 70
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir "e$stageNumber.png"), [Convert]::FromBase64String($shot.data))
  }
  Evaluate "archiveGame.pause(false); archivePhaserGame.scene.getScene('archive-game').finish(true);" | Out-Null
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'result.png'), [Convert]::FromBase64String($shot.data))
  Evaluate "document.querySelector('#primary-button').click()" | Out-Null
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'selection.png'), [Convert]::FromBase64String($shot.data))
  # Visual progression from real jumps: intact, cracked, and heavily chipped wax shell.
  Evaluate "testLaunch('e2'); archivePhaserGame.loop.sleep();" | Out-Null
  foreach ($damage in @(0, 3, 6)) {
    Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); archivePhaserGame.loop.sleep(); archiveGame.pause(false); while(s.state.jumps < $damage) { s.primaryAction(); for(let i=0;i<120;i++) s.update(0,1000/120); } archiveGame.pause(true); archivePhaserGame.loop.wake(); })()" | Out-Null
    Start-Sleep -Milliseconds 70
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir "e2-damage-$damage.png"), [Convert]::FromBase64String($shot.data))
  }
  foreach ($jumpNumber in @(1, 5)) {
    Evaluate "testLaunch('e2'); archivePhaserGame.loop.sleep(); (() => { const s=archivePhaserGame.scene.getScene('archive-game'); for(let j=1;j<$jumpNumber;j++) { s.primaryAction(); for(let i=0;i<156;i++) s.update(0,1000/120); } const apexFrames=Math.round(s.stageGame.jumpPower.call(s)/s.stageGame.tuning.gravity*120); s.primaryAction(); for(let i=0;i<apexFrames;i++) s.update(0,1000/120); archiveGame.pause(true); archivePhaserGame.loop.wake(); })()" | Out-Null
    Start-Sleep -Milliseconds 70
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir "e2-jump-$jumpNumber.png"), [Convert]::FromBase64String($shot.data))
  }
  Evaluate "testLaunch('e2'); archivePhaserGame.loop.sleep(); driveE2(5.5); archiveGame.pause(true); archivePhaserGame.loop.wake();" | Out-Null
  Start-Sleep -Milliseconds 70
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e2-terrain.png'), [Convert]::FromBase64String($shot.data))
  Evaluate "testLaunch('e2'); archivePhaserGame.loop.sleep(); driveE2(12); archiveGame.pause(true); archivePhaserGame.loop.wake();" | Out-Null
  Start-Sleep -Milliseconds 70
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e2-stairs.png'), [Convert]::FromBase64String($shot.data))
  # Native D + Space only at minimum power: W must not be required for the last stairs.
  Evaluate "testLaunch('e2'); (() => { const s=archivePhaserGame.scene.getScene('archive-game'), p=s.platforms[12]; Object.assign(s.state,{x:p.x+p.w-6,y:p.y-20,vy:0,grounded:true,platformIndex:12,checkpoint:p.x+50,jumps:100}); })()" | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = 'd'; code = 'KeyD'; windowsVirtualKeyCode = 68 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 580
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = 'd'; code = 'KeyD'; windowsVirtualKeyCode = 68 } | Out-Null
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return s.state.platformIndex===13 && s.state.grounded && s.state.deaths===0 && !s.keys.up.isDown; })()")) { throw 'Native D + Space failed to land on final stair without W' }
  Write-Output 'PASS: native D + Space reaches final staircase at minimum jump without W'
  # Native e8 press / release / second press / hold on both input routes.
  Evaluate "testLaunch('e8'); archivePhaserGame.scene.getScene('archive-game').state.x=500;" | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 220
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 80
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game').state; return s.jumps===1 && s.hooks===1 && !!s.rope; })()")) { throw 'Native e8 Space jump / airborne hold failed' }
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 40
  if (!(Evaluate "!archivePhaserGame.scene.getScene('archive-game').state.rope")) { throw 'Native e8 Space release failed' }
  Evaluate "testLaunch('e8'); archivePhaserGame.scene.getScene('archive-game').state.x=500;" | Out-Null
  $rect = Evaluate "(() => { const r=archivePhaserGame.canvas.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()"
  $webMouse = @{ button = 'left'; clickCount = 1; x = $rect.x + 600 * $rect.w / 960; y = $rect.y + 300 * $rect.h / 540 }
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mousePressed';buttons=1}) | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mouseReleased';buttons=0}) | Out-Null
  Start-Sleep -Milliseconds 220
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mousePressed';buttons=1}) | Out-Null
  Start-Sleep -Milliseconds 80
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game').state; return s.jumps===1 && s.hooks===1 && s.pointerHeld && !!s.rope; })()")) { throw 'Native e8 mouse jump / airborne hold failed' }
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mouseReleased';buttons=0}) | Out-Null
  Start-Sleep -Milliseconds 40
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game').state; return !s.pointerHeld && !s.rope; })()")) { throw 'Native e8 mouse release failed' }
  Write-Output 'PASS: native e8 keyboard and scaled mouse jump / web hold / release'
  foreach ($webTime in @(2.05, 12.95)) {
    Evaluate "testLaunch('e8'); archivePhaserGame.loop.sleep(); driveE8($webTime); archivePhaserGame.scene.getScene('archive-game').pausedByMenu=true; archivePhaserGame.loop.wake();" | Out-Null
    Start-Sleep -Milliseconds 70
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir "e8-swing-$webTime.png"), [Convert]::FromBase64String($shot.data))
  }
  if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
  Write-Output 'PASS: no uncaught browser exceptions'
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
}
