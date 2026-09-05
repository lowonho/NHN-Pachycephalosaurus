param([switch]$E1Only, [switch]$E2Only, [switch]$E4Only, [switch]$E8Only, [switch]$E10Only)
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
  # 자동화 스크립트는 화면 전환을 실제 사람처럼 기다리지 않고 곧바로 다음 상태를
  # 확인하므로, 암전 전환(js/ui/scene-fade.js)의 지연을 꺼서 그대로 동기적으로 맞춘다.
  Evaluate "globalThis.ARCHIVE_DISABLE_TRANSITIONS = true;" | Out-Null
  # 이 스위트는 판을 update()로 한 걸음씩 몬다 — 실시간으로 흐르는 3 · 2 · 1을 기다리지 않는다.
  # (카운트다운 자체는 minigame-browser-check.js가 직접 세워 검사한다.)
  Evaluate "ARCHIVE_STORY_SETTINGS.skipCountdown = true" | Out-Null
  if ($E1Only) {
    # 달리기 여섯 장이 실제 화면에서 어떻게 도는지 남긴다. 세트마다 한 걸음(RUN_STEP)씩
    # 밀어 여섯 장을 차례로 찍는다. QA 로 세트를 고정해야 두 벌을 각각 볼 수 있다.
    $artifactDir = Join-Path $root 'tests/.artifacts'
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    Evaluate "ARCHIVE_QA.active = true;" | Out-Null
    foreach ($set in @(@{ Id = ''; Name = 'base' }, @{ Id = 'woni-'; Name = 'woni' })) {
      Evaluate "ARCHIVE_QA.artSet.e1 = '$($set.Id)';" | Out-Null
      Evaluate "archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); archiveRun.setSelection(MINIGAME_CATALOG.map(stage=>stage.id)); protocolSelectFlow.open(); protocolSelectFlow.launchStage('e1'); archivePhaserGame.loop.wake(); archiveGame.pause(true);" | Out-Null
      # 첫 판은 모니터 켜지는 연출이 끝난 뒤에 찍어야 한다 — 너무 이르면 까만 화면이 남는다.
      Start-Sleep -Milliseconds 900
      $art = Evaluate "archivePhaserGame.scene.getScene('archive-game').state.art"
      if ($art -ne $set.Id) { throw "QA 가 고른 세트가 실리지 않았다: '$art' != '$($set.Id)'" }
      foreach ($frame in 1..6) {
        $texture = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return s.assetSprites.get('player').texture.key; })()"
        $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
        [IO.File]::WriteAllBytes((Join-Path $artifactDir "e1-$($set.Name)-run$frame.png"), [Convert]::FromBase64String($shot.data))
        Write-Output ("{0} {1}번째 걸음 -> {2}" -f $set.Name, $frame, $texture)
        # 한 장 분량(340/14 px)을 조금 넘겨 걸음이 확실히 다음 장으로 넘어가게 한다.
        Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); archivePhaserGame.loop.sleep(); archiveGame.pause(false); for(let i=0;i<9;i++) s.update(0,1000/120); archiveGame.pause(true); archivePhaserGame.loop.wake(); })()" | Out-Null
        Start-Sleep -Milliseconds 120
      }
    }
    Evaluate "ARCHIVE_QA.artSet = {}; ARCHIVE_QA.active = false;" | Out-Null
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    Write-Output 'PASS: E1 run cycle rendered for both meme sets'
    return
  }
  if ($E10Only) {
    $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e10-skater-check.js')))
    Write-Output ($checks | ConvertTo-Json -Depth 10)
    Evaluate "archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); archiveRun.setSelection(MINIGAME_CATALOG.map(stage=>stage.id)); protocolSelectFlow.open(); protocolSelectFlow.launchStage('e10'); archivePhaserGame.loop.sleep();" | Out-Null
    $artifactDir = Join-Path $root 'tests/.artifacts'
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    foreach ($pose in @('glide', 'spin', 'land')) {
      $step = switch ($pose) {
        'glide' { "s.directionPress('right'); for(let i=0;i<30;i++) s.update(0,1000/120); s.directionRelease('right');" }
        'spin' { "s.primaryAction(); for(let i=0;i<23;i++) s.update(0,1000/120);" }
        'land' { "for(let i=0;i<120&&!s.state.grounded;i++) s.update(0,1000/120);" }
      }
      Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); s.pausedByMenu=false; $step s.pausedByMenu=true; archivePhaserGame.loop.wake(); })()" | Out-Null
      Start-Sleep -Milliseconds 100
      $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
      [IO.File]::WriteAllBytes((Join-Path $artifactDir "e10-$pose.png"), [Convert]::FromBase64String($shot.data))
      Evaluate "archivePhaserGame.loop.sleep();" | Out-Null
    }
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    Write-Output 'PASS: E10 skater rendering without browser exceptions'
    return
  }
  if ($E8Only) {
    Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e8-course-driver.js'))) | Out-Null
    $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e8-start-check.js')))
    Write-Output ($checks | ConvertTo-Json -Depth 10)
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    return
  }
  if ($E2Only) {
    Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e2-course-driver.js'))) | Out-Null
    $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e2-bounce-check.js')))
    Write-Output ($checks | ConvertTo-Json -Depth 10)
    Evaluate "window.testLaunch = id => { archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); if(!archiveRun.snapshot().qaMode) archiveRun.setSelection(MINIGAME_CATALOG.map(stage => stage.id)); protocolSelectFlow.open(); protocolSelectFlow.launchStage(id); archivePhaserGame.loop.wake(); }; testLaunch('e2'); (() => { const s=archivePhaserGame.scene.getScene('archive-game'), p=s.platforms[12]; Object.assign(s.state,{x:p.x+p.w-6,y:p.y-20,vy:0,grounded:true,platformIndex:12,checkpoint:p.x+50,jumps:100}); })()" | Out-Null
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = 'd'; code = 'KeyD'; windowsVirtualKeyCode = 68 } | Out-Null
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
    Start-Sleep -Milliseconds 580
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = 'd'; code = 'KeyD'; windowsVirtualKeyCode = 68 } | Out-Null
    if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return s.state.platformIndex===13 && s.state.grounded && s.state.deaths===0; })()")) { throw 'E2 native D + Space failed to land on the next stair at minimum jump' }
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    Write-Output 'PASS: E2 minimum jump, native D + Space, no-air-control course, and A/D + Space UI'
    return
  }
  if ($E4Only) {
    $villageChecks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e4-village-check.js')))
    Write-Output ($villageChecks | ConvertTo-Json -Depth 10)
    $chaseChecks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e4-tiger-check.js')))
    Write-Output ($chaseChecks | ConvertTo-Json -Depth 10)
    $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e4-maze-check.js')))
    Write-Output ($checks | ConvertTo-Json -Depth 10)
    Evaluate "archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); archiveRun.setSelection(MINIGAME_CATALOG.map(stage=>stage.id)); protocolSelectFlow.open(); protocolSelectFlow.launchStage('e4'); archivePhaserGame.loop.wake(); archiveGame.pause(true);" | Out-Null
    Start-Sleep -Milliseconds 100
    $artifactDir = Join-Path $root 'tests/.artifacts'
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e4-maze.png'), [Convert]::FromBase64String($shot.data))
    $dashKey = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); archivePhaserGame.loop.sleep(); archiveGame.pause(false); return s.state.tiles[1][2]===0 ? 'd' : 's'; })()"
    $dashCode = if ($dashKey -eq 'd') { 'KeyD' } else { 'KeyS' }
    $dashVirtualKey = if ($dashKey -eq 'd') { 68 } else { 83 }
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = $dashKey; code = $dashCode; windowsVirtualKeyCode = $dashVirtualKey } | Out-Null
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = $dashKey; code = $dashCode; windowsVirtualKeyCode = $dashVirtualKey; autoRepeat = $true } | Out-Null
    $dash = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); for(let i=0;i<30;i++) s.update(0,1000/120); return {speed:s.state.speed,moving:s.state.moving,trail:s.state.trail.length}; })()"
    if (!$dash.moving -or $dash.speed -lt 340 -or $dash.trail -lt 20) { throw 'E4 native keyboard acceleration failed' }
    if ($dash.speed -ne 340) { throw 'E4 hold or key auto-repeat incorrectly added speed' }
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = $dashKey; code = $dashCode; windowsVirtualKeyCode = $dashVirtualKey } | Out-Null
    Evaluate "archiveGame.pause(true); archivePhaserGame.loop.wake();" | Out-Null
    Start-Sleep -Milliseconds 100
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e4-dash.png'), [Convert]::FromBase64String($shot.data))
    $brake = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); archivePhaserGame.loop.sleep(); archiveGame.pause(false); const x=s.state.x,y=s.state.y,v=Math.hypot(s.state.vx,s.state.vy); for(let i=0;i<3;i++) s.update(0,1000/120); return {distance:Math.hypot(s.state.x-x,s.state.y-y),speed:Math.hypot(s.state.vx,s.state.vy),before:v,braking:s.state.braking}; })()"
    if (!$brake.braking -or $brake.distance -le 0 -or $brake.speed -ge $brake.before) { throw 'E4 native key release did not brake with drift' }
    Evaluate "archiveGame.pause(true); archivePhaserGame.loop.wake();" | Out-Null
    Start-Sleep -Milliseconds 100
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e4-brake.png'), [Convert]::FromBase64String($shot.data))
    Evaluate "archivePhaserGame.loop.sleep(); archiveGame.pause(false);" | Out-Null
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = $dashKey; code = $dashCode; windowsVirtualKeyCode = $dashVirtualKey } | Out-Null
    if (!(Evaluate "archivePhaserGame.scene.getScene('archive-game').state.speed === 440")) { throw 'E4 same-direction native repress did not add a speed step' }
    Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = $dashKey; code = $dashCode; windowsVirtualKeyCode = $dashVirtualKey } | Out-Null
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    Write-Output 'PASS: E4 maze collision, timer, retry, and 25 generated mazes'
    Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); archivePhaserGame.loop.sleep(); s.loadStage('e4'); s.startStage(); s.directionPress('right'); for(let i=0;i<24;i++) s.update(0,1000/120); s.directionRelease('right'); for(let i=0;i<384;i++) s.update(0,1000/120); s.pausedByMenu=true; archivePhaserGame.loop.wake(); })()" | Out-Null
    Start-Sleep -Milliseconds 100
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e4-tiger-chase.png'), [Convert]::FromBase64String($shot.data))
    Evaluate "(() => { archivePhaserGame.loop.sleep(); archiveGame.pause(false); const s=archivePhaserGame.scene.getScene('archive-game'); for(let i=0;i<120&&s.playable();i++) s.update(0,1000/120); archivePhaserGame.loop.wake(); })()" | Out-Null
    if (!(Evaluate "modalFlow.isOpen() && UI.modalStep.textContent.includes('RETRY') && UI.modalCopy.textContent.includes('\uD638\uB791\uC774')")) { throw 'E4 tiger catch did not open the existing failure UI' }
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir 'e4-tiger-failure.png'), [Convert]::FromBase64String($shot.data))
    Evaluate "(() => { modalFlow.close(); protocolSelectFlow.launchStage('e4'); archivePhaserGame.loop.sleep(); const s=archivePhaserGame.scene.getScene('archive-game'); s.state.x=s.state.goal.x-20; s.state.y=s.state.goal.y; s.directionPress('right'); for(let i=0;i<12&&s.playable();i++) s.update(0,1000/120); archivePhaserGame.loop.wake(); })()" | Out-Null
    if (!(Evaluate "modalFlow.isOpen() && UI.modalStep.textContent.includes('CLEAR')")) { throw 'E4 reaching the king did not open the existing success UI' }
    Write-Output 'PASS: tiger failure and king arrival open the existing result UI'
    if ($script:browserErrors.Count) { throw ($script:browserErrors -join "`n") }
    return
  }
  Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e2-course-driver.js'))) | Out-Null
  Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e8-course-driver.js'))) | Out-Null
  $checks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/minigame-browser-check.js')))
  Write-Output ($checks | ConvertTo-Json -Depth 20)
  $skaterChecks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e10-skater-check.js')))
  $chaseChecks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e4-tiger-check.js')))
  Write-Output ($chaseChecks | ConvertTo-Json -Depth 10)
  Write-Output ($skaterChecks | ConvertTo-Json -Depth 20)
  $slingshotChecks = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/e5-slingshot-check.js')))
  Write-Output ($slingshotChecks | ConvertTo-Json -Depth 20)
  $playability = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/minigame-clearability.js')))
  Write-Output ($playability | ConvertTo-Json -Depth 20)
  # Browser keyboard/mouse events, including the existing CSS-scaled monitor.
  Evaluate "window.testLaunch = id => { archiveGameBridge.stop(); modalFlow.close(); mainMenuFlow.close(); if(!archiveRun.snapshot().qaMode) archiveRun.setSelection(MINIGAME_CATALOG.map(stage => stage.id)); protocolSelectFlow.open(); protocolSelectFlow.launchStage(id); archivePhaserGame.loop.wake(); }; testLaunch('e2');" | Out-Null
  Start-Sleep -Milliseconds 100
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 100
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32; autoRepeat = $true } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  $keyState = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return {actions:s.actions,mode:s.mode,paused:s.pausedByMenu,elapsed:s.elapsed,key:s.keys.action.isDown,focused:document.activeElement?.id}; })()"
  if ($keyState.actions -ne 1) { throw ('Keyboard space/repeat routing failed: ' + ($keyState | ConvertTo-Json -Compress)) }
  Evaluate "testLaunch('e10')" | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = 'a'; code = 'KeyA'; windowsVirtualKeyCode = 65 } | Out-Null
  Start-Sleep -Milliseconds 70
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = 'a'; code = 'KeyA'; windowsVirtualKeyCode = 65 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = 'ArrowRight'; code = 'ArrowRight'; windowsVirtualKeyCode = 39 } | Out-Null
  Start-Sleep -Milliseconds 70
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = 'ArrowRight'; code = 'ArrowRight'; windowsVirtualKeyCode = 39 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  $decodeKeys = Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return {presses:s.state.directionPresses,friction:s.state.friction,actions:s.actions,grounded:s.state.grounded}; })()"
  if ($decodeKeys.presses -ne 2 -or $decodeKeys.friction -ge 820 -or $decodeKeys.actions -ne 3 -or $decodeKeys.grounded) { throw ('Number decode keyboard routing failed: ' + ($decodeKeys | ConvertTo-Json -Compress)) }
  Evaluate "testLaunch('e5')" | Out-Null
  $slingPoints = Evaluate "(() => { const c=archivePhaserGame.scene.getScene('archive-game').cameras.main,r=archivePhaserGame.canvas.getBoundingClientRect(),p=c.getWorldPoint(0,0),u=c.getWorldPoint(960,0),v=c.getWorldPoint(0,540),ax=u.x-p.x,ay=u.y-p.y,bx=v.x-p.x,by=v.y-p.y,det=ax*by-ay*bx; return [[164,382],[70,430]].map(([x,y])=>({x:r.x+((x-p.x)*by-(y-p.y)*bx)/det*r.width,y:r.y+(ax*(y-p.y)-ay*(x-p.x))/det*r.height})); })()"
  $rect = Evaluate "(() => { const r=archivePhaserGame.canvas.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()"
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mousePressed'; button = 'left'; buttons = 1; clickCount = 1; x = $slingPoints[0].x; y = $slingPoints[0].y } | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseMoved'; button = 'left'; buttons = 1; x = $slingPoints[1].x; y = $slingPoints[1].y } | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' @{ type = 'mouseReleased'; button = 'left'; buttons = 0; clickCount = 1; x = $slingPoints[1].x; y = $slingPoints[1].y } | Out-Null
  if (!(Evaluate "archivePhaserGame.scene.getScene('archive-game').state.shots === 1")) { throw 'Scaled pointer drag/release routing failed' }
  Write-Output 'PASS: native keyboard repeat suppression, number decode A/D/arrow/Space and mouse drag in scaled viewport'
  $artifactDir = Join-Path $root 'tests/.artifacts'
  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  Evaluate "mainMenuFlow.open(); qaModeFlow.activate();" | Out-Null
  Start-Sleep -Milliseconds 80
  $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
  [IO.File]::WriteAllBytes((Join-Path $artifactDir 'qa-story-panel.png'), [Convert]::FromBase64String($shot.data))
  Evaluate "qaModeFlow.deactivate();" | Out-Null
  foreach ($phase in @('op-01', 'op-02', 'op-03', 'op-05', 'op-09', 'assist', 'betrayal', 'source', 'experiment', 'ending-a', 'ending-a-break', 'ending-b', 'ending-c', 'ending-d')) {
    Evaluate "mainMenuFlow.close(); protocolSelectFlow.close(); UI.cutscene.classList.remove('hidden'); cutsceneFlow.showBackground('$phase'); UI.cutscene.dataset.phase='$phase'; UI.cutscene.dataset.cueKind='system'; UI.cutsceneChapter.textContent='컷신 미리보기 // $phase'; UI.cutsceneSpeaker.textContent=''; UI.cutsceneLine.textContent='배경 확인'; UI.cutscenePanel.dataset.state='done';" | Out-Null
    Start-Sleep -Milliseconds 80
    $shot = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $artifactDir "cutscene-$phase.png"), [Convert]::FromBase64String($shot.data))
  }
  Evaluate "cutsceneFlow.close(); mainMenuFlow.open();" | Out-Null
  foreach ($stageNumber in 1..10) {
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
  # Native D + Space only at minimum power reaches the next stair.
  Evaluate "testLaunch('e2'); (() => { const s=archivePhaserGame.scene.getScene('archive-game'), p=s.platforms[12]; Object.assign(s.state,{x:p.x+p.w-6,y:p.y-20,vy:0,grounded:true,platformIndex:12,checkpoint:p.x+50,jumps:100}); })()" | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = 'd'; code = 'KeyD'; windowsVirtualKeyCode = 68 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 580
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = 'd'; code = 'KeyD'; windowsVirtualKeyCode = 68 } | Out-Null
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game'); return s.state.platformIndex===13 && s.state.grounded && s.state.deaths===0 && !s.keys.up.isDown && !s.keys.down.isDown; })()")) { throw 'Native D + Space failed to land on final stair at minimum jump' }
  Write-Output 'PASS: native D + Space reaches final staircase at minimum jump'
  # Native e8 adopts the starting web, releases, then catches it again on both input routes.
  Evaluate "testLaunch('e8');" | Out-Null
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 220
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 40
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyDown'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 80
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game').state; return s.hooks===1 && s.multiplier===1 && !!s.rope; })()")) { throw 'Native e8 Space catch / hold failed' }
  Send-Cdp 'Input.dispatchKeyEvent' @{ type = 'keyUp'; key = ' '; code = 'Space'; windowsVirtualKeyCode = 32 } | Out-Null
  Start-Sleep -Milliseconds 40
  if (!(Evaluate "!archivePhaserGame.scene.getScene('archive-game').state.rope")) { throw 'Native e8 Space release failed' }
  Evaluate "testLaunch('e8');" | Out-Null
  $rect = Evaluate "(() => { const r=archivePhaserGame.canvas.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()"
  $webMouse = @{ button = 'left'; clickCount = 1; x = $rect.x + 600 * $rect.w / 960; y = $rect.y + 300 * $rect.h / 540 }
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mousePressed';buttons=1}) | Out-Null
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mouseReleased';buttons=0}) | Out-Null
  Start-Sleep -Milliseconds 220
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mousePressed';buttons=1}) | Out-Null
  Start-Sleep -Milliseconds 80
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game').state; return s.hooks===1 && s.multiplier===1 && s.pointerHeld && !!s.rope; })()")) { throw 'Native e8 mouse catch / hold failed' }
  Send-Cdp 'Input.dispatchMouseEvent' ($webMouse + @{type='mouseReleased';buttons=0}) | Out-Null
  Start-Sleep -Milliseconds 40
  if (!(Evaluate "(() => { const s=archivePhaserGame.scene.getScene('archive-game').state; return !s.pointerHeld && !s.rope; })()")) { throw 'Native e8 mouse release failed' }
  Write-Output 'PASS: native e8 keyboard and scaled mouse web catch / hold / release'
  foreach ($webTime in @(1.7, 8.4, 15.6)) {
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
