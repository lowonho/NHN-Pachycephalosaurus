$ErrorActionPreference = "Stop"
[Net.WebRequest]::DefaultWebProxy = $null
$root = Split-Path -Parent $PSScriptRoot
$profile = Join-Path ([IO.Path]::GetTempPath()) ("archive-audio-" + [guid]::NewGuid())
$chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe"
$browser = Start-Process -FilePath $chrome -WindowStyle Hidden -PassThru -ArgumentList @(
  "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files",
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
  Send-Cdp "Page.navigate" @{ url = (([Uri](Join-Path $root "index.html")).AbsoluteUri + "?audioLab=1") } | Out-Null
  $ready = $false
  for ($i = 0; $i -lt 100; $i++) {
    $ready = Evaluate "Boolean(window.archiveGame && window.archiveAudio && archiveGameBridge.api)"
    if ($ready) { break }
    Start-Sleep -Milliseconds 100
  }
  if (!$ready) { throw "Game did not become ready" }
  if (!(Evaluate "document.querySelectorAll('#audio-lab-bgm option').length===10 && document.querySelectorAll('#audio-lab-sfx option').length===6 && document.querySelectorAll('#audio-lab-file-sfx option').length===29")) { throw "Sound Lab controls did not initialize" }
  if (!(Evaluate "(()=>{const gain=document.querySelector('#audio-lab-gain');gain.value='73';gain.dispatchEvent(new Event('input'));const fileGain=document.querySelector('#audio-lab-file-gain');fileGain.value='63';fileGain.dispatchEvent(new Event('input'));const frequency=document.querySelector('#audio-lab-frequency');frequency.value='333';frequency.dispatchEvent(new Event('input'));const changed=ARCHIVE_AUDIO_TUNING.bgm.tracks.main.gain===.73&&ARCHIVE_AUDIO_TUNING.sfx.files.sfxCharacterRevival.gain===.63&&ARCHIVE_AUDIO_TUNING.sfx.presets.click.voices[0].frequency===333;document.querySelector('#audio-lab-reset').click();return changed&&ARCHIVE_AUDIO_TUNING.bgm.tracks.main.gain===.47&&ARCHIVE_AUDIO_TUNING.sfx.files.sfxCharacterRevival.gain===.72&&ARCHIVE_AUDIO_TUNING.sfx.presets.click.voices[0].frequency===420;})()")) { throw "Sound Lab live tuning or reset failed" }
  if (!(Evaluate "archiveAudio.bgm.paused")) { throw "Strict autoplay should block initial playback" }
  Evaluate "audioBus.setMuted(true); audioBus.setVolume('master', 0); audioBus.setVolume('bgm', 0); true" | Out-Null
  $position = Evaluate "(() => { const r = document.querySelector('#main-play-button').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()"
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $position.x; y = $position.y; button = "left"; clickCount = 1 } | Out-Null
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $position.x; y = $position.y; button = "left"; clickCount = 1 } | Out-Null
  # 실제 사용자 클릭 뒤 게임을 직접 시작해 저장된 무음 설정 복구와 E1 라우팅을 결정적으로 검사한다.
  Evaluate "archiveRun.setSelection(MINIGAME_CATALOG.map(stage=>stage.id)); archiveGameBridge.start('e1'); true" | Out-Null
  Start-Sleep -Milliseconds 1100
  $playing = Evaluate "({key:archiveAudio.bgmKey,src:decodeURIComponent(new URL(archiveAudio.bgm.src).pathname),paused:archiveAudio.bgm.paused,time:archiveAudio.bgm.currentTime,volume:archiveAudio.bgm.volume,muted:audioBus.muted,loop:archiveAudio.bgm.loop,error:archiveAudio.bgm.error?.code ?? null})"
  if ($playing.key -ne 'e1' -or !$playing.src.EndsWith('/sounds/bgm/e1 bgm_yaho.mp3') -or $playing.paused -or $playing.time -le 0 -or $playing.volume -le 0 -or $playing.muted -or !$playing.loop -or $playing.error) {
    throw ("Playback failed: " + ($playing | ConvertTo-Json -Compress))
  }
  Evaluate "archiveGameBridge.cancelCountdown(); archiveGameBridge.api.start(); archiveGameBridge.api.action(); archiveGameBridge.api.release('action'); true" | Out-Null
  if (!(Evaluate "archiveAudio.lastSfx.has('sfxE1GravityFlip') && archiveAudio.sfxPools.get('sfxE1GravityFlip')?.length===1")) { throw "E1 gravity flip did not route to its file SFX" }
  Evaluate "gameEvents.emit(GAME_EVENTS.TIMER_WARNING, {}); true" | Out-Null
  $timerSfx = Evaluate "({played:archiveAudio.lastSfx.has('sfxTimerWarning'),pool:archiveAudio.sfxPools.get('sfxTimerWarning')?.length??0})"
  if (!$timerSfx.played -or $timerSfx.pool -ne 1) { throw ("Timer warning file SFX did not fire: " + ($timerSfx | ConvertTo-Json -Compress)) }
  Evaluate "audioBus.setVolume('bgm', 0.2); true" | Out-Null
  Start-Sleep -Milliseconds 100
  if ([Math]::Abs((Evaluate "archiveAudio.bgm.volume") - (Evaluate "archiveAudio.effectiveBgmVolume()")) -gt 0.001) { throw "Track gain or BGM volume not applied" }
  Evaluate "audioBus.setMuted(true); true" | Out-Null
  if ((Evaluate "archiveAudio.bgm.volume") -ne 0) { throw "Mute not applied" }
  Evaluate "archiveGameBridge.stop({bgm:'silence'}); protocolSelectFlow.open(); true" | Out-Null
  if (!(Evaluate "protocolSelectFlow.isBriefOpen() && !archiveAudio.bgmStarted && archiveAudio.bgmSlots.every(track=>track.paused && track.volume===0)")) { throw "Game briefing did not fully silence BGM" }
  Evaluate "archiveGameBridge.start('e4'); true" | Out-Null
  Start-Sleep -Milliseconds 800
  if (!(Evaluate "archiveAudio.bgmKey==='e4' && decodeURIComponent(new URL(archiveAudio.bgm.src).pathname).endsWith('/sounds/bgm/e4 bgm_tiger.mp3') && !archiveAudio.bgm.paused && archiveAudio.bgm.volume > 0 && !audioBus.muted")) { throw "E4 start did not restore and route audio" }
  Evaluate "archiveGameBridge.cancelCountdown(); archiveGameBridge.api.start(); archiveGameBridge.api.press('right'); true" | Out-Null
  Start-Sleep -Milliseconds 160
  Evaluate "archiveGameBridge.api.release('right'); true" | Out-Null
  Start-Sleep -Milliseconds 120
  if (!(Evaluate "archiveAudio.lastSfx.has('sfxE4Walk1') && archiveAudio.lastSfx.has('sfxE4Brake') && archiveAudio.sfxPools.get('sfxE4Walk1')?.[0]?.playbackRate>=.92")) { throw "E4 footsteps or speed-linked playback did not fire" }
  Evaluate "archiveGameBridge.restart(); true" | Out-Null
  if (!(Evaluate "archiveAudio.bgmKey==='e4' && !archiveAudio.bgm.paused && archiveAudio.bgm.volume > 0")) { throw "Restart lost E4 audio" }
  Evaluate "archiveAudio.play('sfxE4TigerSlow',{loop:true}); true" | Out-Null
  Evaluate "archiveGameBridge.pause(); true" | Out-Null
  if (!(Evaluate "archiveAudio.bgm.paused && archiveAudio.bgmPaused && archiveAudio.sfxPools.get('sfxE4TigerSlow')?.every(sound=>sound.paused)")) { throw "Pause did not stop BGM and SFX" }
  Evaluate "archiveGameBridge.resume(); true" | Out-Null
  Start-Sleep -Milliseconds 100
  if (!(Evaluate "!archiveAudio.bgm.paused && !archiveAudio.bgmPaused && archiveAudio.sfxPools.get('sfxE4TigerSlow')?.some(sound=>!sound.paused)")) { throw "Resume did not restart BGM and SFX" }
  Evaluate "archiveGameBridge.stop({bgm:'main'}); true" | Out-Null
  Start-Sleep -Milliseconds 100
  if (!(Evaluate "archiveAudio.bgmKey==='main' && archiveAudio.bgmStarted && !archiveAudio.bgm.paused")) { throw "Main menu did not restore the main theme" }
  $inventory = Evaluate "(async()=>Promise.all(Object.entries(ARCHIVE_AUDIO_TUNING.bgm.tracks).map(([key,track])=>new Promise(resolve=>{const a=new Audio(track.path);a.preload='metadata';a.onloadedmetadata=()=>resolve({key,duration:a.duration,error:null});a.onerror=()=>resolve({key,duration:0,error:a.error?.code??-1});a.load();}))))()"
  if ($inventory.Count -ne 10 -or ($inventory | Where-Object { $_.error -or $_.duration -le 0 })) { throw ("BGM inventory load failed: " + ($inventory | ConvertTo-Json -Compress)) }
  $levels = Evaluate "(async()=>{const entries=[...Object.entries(ARCHIVE_AUDIO_TUNING.bgm.tracks).filter(([key])=>key!=='e9').map(([key,value])=>({type:'bgm',key,path:value.path,gain:value.gain})),...AUDIO_MANIFEST.map(value=>({type:'sfx',key:value.key,path:value.paths[0]}))],context=new AudioContext(),db=value=>value>0?20*Math.log10(value):-120,rows=[];for(const entry of entries){const buffer=await context.decodeAudioData(await(await fetch(entry.path)).arrayBuffer()),channels=Array.from({length:buffer.numberOfChannels},(_,index)=>buffer.getChannelData(index)),stride=entry.type==='bgm'?8:1,block=2048;let peak=0,totalSquare=0,totalCount=0,activeSquare=0,activeCount=0;for(let from=0;from<buffer.length;from+=block*stride){let square=0,count=0;for(let i=from;i<Math.min(buffer.length,from+block*stride);i+=stride)for(const channel of channels){const sample=channel[i];peak=Math.max(peak,Math.abs(sample));square+=sample*sample;count++}totalSquare+=square;totalCount+=count;if(db(Math.sqrt(square/Math.max(1,count)))>-45){activeSquare+=square;activeCount+=count}}rows.push({...entry,duration:+buffer.duration.toFixed(3),peakDb:+db(peak).toFixed(2),rmsDb:+db(Math.sqrt(totalSquare/totalCount)).toFixed(2),activeRmsDb:+db(Math.sqrt(activeSquare/Math.max(1,activeCount))).toFixed(2)})}await context.close();return rows})()"
  $adjustedBgm = @($levels | Where-Object type -eq "bgm" | ForEach-Object { $_.activeRmsDb + 20 * [Math]::Log10($_.gain) })
  $bgmSpread = ($adjustedBgm | Measure-Object -Maximum).Maximum - ($adjustedBgm | Measure-Object -Minimum).Minimum
  if ($bgmSpread -gt 1.2) { throw "Balanced BGM spread exceeded 1.2 dB: $bgmSpread" }
  $sfxLevels = @($levels | Where-Object type -eq "sfx")
  if ($sfxLevels.Count -ne 29) { throw "SFX decode inventory should contain 29 files" }
  Write-Output ("AUDIO_LEVEL_SUMMARY=" + (@{ bgmCount = $adjustedBgm.Count; sfxCount = $sfxLevels.Count; balancedBgmSpreadDb = [Math]::Round($bgmSpread, 2) } | ConvertTo-Json -Compress))
  Write-Output ("PASS: 10 active BGM files, 29 SFX files, E9 excluded, silent game briefing, main-menu restore, Sound Lab, file timer SFX, E1/E4 routing, crossfade, blocked autoplay, real click recovery, track gain, mute, restart, pause and resume. " + ($playing | ConvertTo-Json -Compress))
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
}
