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
  if (!(Evaluate "document.querySelectorAll('#audio-lab-bgm option').length===10 && document.querySelectorAll('#audio-lab-sfx option').length===6 && document.querySelectorAll('#audio-lab-file-sfx option').length===31")) { throw "Sound Lab controls did not initialize" }
  if (!(Evaluate "(()=>{const gain=document.querySelector('#audio-lab-gain');gain.value='73';gain.dispatchEvent(new Event('input'));const fileGain=document.querySelector('#audio-lab-file-gain');fileGain.value='63';fileGain.dispatchEvent(new Event('input'));const frequency=document.querySelector('#audio-lab-frequency');frequency.value='333';frequency.dispatchEvent(new Event('input'));const changed=ARCHIVE_AUDIO_TUNING.bgm.tracks.main.gain===.73&&ARCHIVE_AUDIO_TUNING.sfx.files.sfxCharacterRevival.gain===.63&&ARCHIVE_AUDIO_TUNING.sfx.presets.click.voices[0].frequency===333;document.querySelector('#audio-lab-reset').click();return changed&&ARCHIVE_AUDIO_TUNING.bgm.tracks.main.gain===.47&&ARCHIVE_AUDIO_TUNING.sfx.files.sfxCharacterRevival.gain===.72&&ARCHIVE_AUDIO_TUNING.sfx.presets.click.voices[0].frequency===420;})()")) { throw "Sound Lab live tuning or reset failed" }
  if (!(Evaluate "archiveAudio.bgm.paused")) { throw "Strict autoplay should block initial playback" }
  Evaluate "audioBus.setMuted(true); audioBus.setVolume('master', 0); audioBus.setVolume('bgm', 0); audioBus.setVolume('sfx', 0); audioBus.setChannelMuted('bgm', true); audioBus.setChannelMuted('sfx', true); true" | Out-Null
  $position = Evaluate "(() => { const r = document.querySelector('#main-play-button').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()"
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $position.x; y = $position.y; button = "left"; clickCount = 1 } | Out-Null
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $position.x; y = $position.y; button = "left"; clickCount = 1 } | Out-Null
  # 실제 사용자 클릭 뒤 게임을 직접 시작해 저장된 무음 설정 복구와 E1 라우팅을 결정적으로 검사한다.
  Evaluate "archiveRun.setSelection(MINIGAME_CATALOG.map(stage=>stage.id)); archiveGameBridge.start('e1'); true" | Out-Null
  Start-Sleep -Milliseconds 1100
  $playing = Evaluate "({key:archiveAudio.bgmKey,src:decodeURIComponent(new URL(archiveAudio.bgm.src).pathname),paused:archiveAudio.bgm.paused,time:archiveAudio.bgm.currentTime,volume:archiveAudio.bgm.volume,muted:audioBus.muted,loop:archiveAudio.bgm.loop,error:archiveAudio.bgm.error?.code ?? null})"
  if ($playing.key -ne 'e1' -or !$playing.src.EndsWith('/sounds/bgm/e1 bgm_yaho.mp3') -or $playing.paused -or $playing.time -le 0 -or $playing.volume -le 0 -or $playing.muted -or !$playing.loop -or $playing.error -or (Evaluate "audioBus.volumes.sfx<=0||audioBus.channelMuted.sfx||audioBus.channelMuted.bgm")) {
    throw ("Playback failed: " + ($playing | ConvertTo-Json -Compress))
  }
  Evaluate "archiveGameBridge.cancelCountdown(); archiveGameBridge.api.start(); archiveGameBridge.api.action(); archiveGameBridge.api.release('action'); true" | Out-Null
  if (!(Evaluate "archiveAudio.lastSfx.has('sfxE1GravityFlip') && archiveAudio.sfxPools.get('sfxE1GravityFlip')?.length===1")) { throw "E1 gravity flip did not route to its file SFX" }
  Evaluate "gameEvents.emit(GAME_EVENTS.TIMER_WARNING, {}); true" | Out-Null
  $timerSfx = Evaluate "({played:archiveAudio.lastSfx.has('sfxTimerWarning'),pool:archiveAudio.sfxPools.get('sfxTimerWarning')?.length??0})"
  if (!$timerSfx.played -or $timerSfx.pool -ne 1) { throw ("Timer warning file SFX did not fire: " + ($timerSfx | ConvertTo-Json -Compress)) }
  # Active-stage transitions must not leave the previous BGM audible beside E3.
  Evaluate "archiveGameBridge.start('e3'); true" | Out-Null
  Start-Sleep -Milliseconds 100
  $e3BgmSlots = @(Evaluate "archiveAudio.bgmSlots.map((track,index)=>({index,key:track.dataset.trackKey,paused:track.paused,volume:track.volume,time:track.currentTime}))")
  $e3AudibleBgm = @($e3BgmSlots | Where-Object { !$_.paused -and $_.volume -gt 0 })
  if ($e3AudibleBgm.Count -ne 1 -or $e3AudibleBgm[0].key -ne 'e3') { throw ("E3 started with overlapping BGM: " + ($e3BgmSlots | ConvertTo-Json -Compress)) }
  Evaluate "archiveAudio.selectBgm('e2'); archiveGameBridge.start('e3'); true" | Out-Null
  Start-Sleep -Milliseconds 550
  $rapidE3BgmSlots = @(Evaluate "archiveAudio.bgmSlots.map((track,index)=>({index,key:track.dataset.trackKey,paused:track.paused,volume:track.volume,time:track.currentTime}))")
  $rapidE3AudibleBgm = @($rapidE3BgmSlots | Where-Object { !$_.paused -and $_.volume -gt 0 })
  if ($rapidE3AudibleBgm.Count -ne 1 -or $rapidE3AudibleBgm[0].key -ne 'e3') { throw ("Rapid E3 transition left stale BGM: " + ($rapidE3BgmSlots | ConvertTo-Json -Compress)) }
  $e3Sfx = Evaluate "(()=>{archiveGameBridge.stop({bgm:'silence'});archiveGameBridge.start('e3');archiveGameBridge.cancelCountdown();archiveGameBridge.api.start();const scene=archivePhaserGame.scene.getScene('archive-game'),M=Phaser.Physics.Matter.Matter;archiveAudio.lastSfx.clear();scene.primaryAction();const originalDrop=archiveAudio.lastSfx.has('action')&&!archiveAudio.lastSfx.has('sfxE3PersonFall');const body=scene.people[0];M.Body.translate(body,{x:0,y:2000});scene.stageGame.cullFallen.call(scene);const bottomWhistle=archiveAudio.lastSfx.has('sfxE3PersonFall');archiveAudio.lastSfx.delete('sfxE3SuccessCount');scene.state.height=scene.stageGame.tuning.targetHeight;scene.stageGame.updateCountdown.call(scene,.25);const firstCrossing=scene.stageGame.tuning.hold===2&&scene.state.countdownActive&&scene.state.countdownTicks===1&&scene.state.held===.25&&archiveAudio.lastSfx.has('sfxE3SuccessCount');scene.stageGame.updateCountdown.call(scene,.8);const secondTick=scene.state.countdownTicks===2&&scene.state.held===1.05;scene.state.height=0;scene.stageGame.updateCountdown.call(scene,.1);const reset=!scene.state.countdownActive&&scene.state.countdownTicks===0&&scene.state.held===0&&!archiveAudio.lastSfx.has('sfxE3SuccessCount')&&archiveAudio.sfxPools.get('sfxE3SuccessCount')?.every(sound=>sound.paused&&sound.currentTime===0);scene.state.height=scene.stageGame.tuning.targetHeight;scene.stageGame.updateCountdown.call(scene,.1);const replay=scene.state.countdownActive&&scene.state.countdownTicks===1&&scene.state.held===.1&&archiveAudio.lastSfx.has('sfxE3SuccessCount');return{originalDrop,bottomWhistle,firstCrossing,secondTick,reset,replay}})()"
  if (!$e3Sfx.originalDrop -or !$e3Sfx.bottomWhistle -or !$e3Sfx.firstCrossing -or !$e3Sfx.secondTick -or !$e3Sfx.reset -or !$e3Sfx.replay) { throw ("E3 SFX routing failed: " + ($e3Sfx | ConvertTo-Json -Compress)) }
  $e5Sfx = Evaluate "(()=>{archiveGameBridge.stop({bgm:'silence'});archiveGameBridge.start('e5');archiveGameBridge.cancelCountdown();archiveGameBridge.api.start();const scene=archivePhaserGame.scene.getScene('archive-game'),random=Math.random;scene.settings.effects=false;archiveAudio.lastSfx.clear();Math.random=()=>.1;scene.stageGame.damage.call(scene,scene.state.timbers[0],20);const timberHit=scene.state.timbers[0].hp>0&&archiveAudio.lastSfx.has('sfxE5Broken1');archiveAudio.stopSfx();Math.random=()=>.9;scene.stageGame.damage.call(scene,scene.state.targets[0],20);const cookieHit=scene.state.targets[0].hp>0&&archiveAudio.lastSfx.has('sfxE5Broken2');archiveAudio.stopSfx();Math.random=()=>.1;scene.stageGame.damage.call(scene,scene.state.targets[1],100);const destroyingHit=archiveAudio.lastSfx.has('sfxE5Broken1');Math.random=random;return{timberHit,cookieHit,destroyingHit,noWrongStretch:!archiveAudio.lastSfx.has('sfxDubaiStretch')}})()"
  if (!$e5Sfx.timberHit -or !$e5Sfx.cookieHit -or !$e5Sfx.destroyingHit -or !$e5Sfx.noWrongStretch) { throw ("E5 target hit SFX routing failed: " + ($e5Sfx | ConvertTo-Json -Compress)) }
  $e10Jump = Evaluate "(async()=>{archiveGameBridge.stop({bgm:'silence'});archiveGameBridge.start('e10');archiveGameBridge.cancelCountdown();archiveGameBridge.api.start();const scene=archivePhaserGame.scene.getScene('archive-game');archiveAudio.stopSfx();scene.primaryAction();const keys=['sfxE10Jump'];for(let i=0;i<20&&!keys.some(key=>(archiveAudio.sfxPools.get(key)??[]).some(sound=>sound.currentTime>0||sound.error));i++)await new Promise(resolve=>setTimeout(resolve,50));return{grounded:scene.state.grounded,actions:scene.actions,played:keys.filter(key=>archiveAudio.lastSfx.has(key)),sounds:keys.flatMap(key=>(archiveAudio.sfxPools.get(key)??[]).map(sound=>({key,paused:sound.paused,time:sound.currentTime,volume:sound.volume,error:sound.error?.code??null})))}})()"
  if ($e10Jump.actions -ne 1 -or $e10Jump.played.Count -ne 1 -or !$e10Jump.sounds -or !($e10Jump.sounds | Where-Object { !$_.paused -and $_.time -gt 0 -and $_.volume -gt 0 -and !$_.error })) { throw ("E10 physical jump SFX did not play: " + ($e10Jump | ConvertTo-Json -Compress)) }
  $bgmRoutes = Evaluate "(async()=>{const rows=[];for(const id of ['e1','e2','e3','e4','e5','e6','e7','e8','e10']){archiveGameBridge.start(id);await new Promise(resolve=>setTimeout(resolve,100));const slots=archiveAudio.bgmSlots.map(track=>({key:track.dataset.trackKey,paused:track.paused,volume:track.volume,time:track.currentTime,error:track.error?.code??null})),audible=slots.filter(track=>!track.paused&&track.volume>0);rows.push({id,current:archiveAudio.bgmKey,audible,slots})}return rows})()"
  $badBgmRoutes = @($bgmRoutes | Where-Object { $_.current -ne $_.id -or $_.audible.Count -ne 1 -or $_.audible[0].key -ne $_.id -or $_.audible[0].error })
  if ($badBgmRoutes.Count) { throw ("Stage BGM routing or overlap failed: " + ($badBgmRoutes | ConvertTo-Json -Depth 8 -Compress)) }
  $stageSfxRoutes = Evaluate ([IO.File]::ReadAllText((Join-Path $root 'tests/audio-stage-routing-check.js')))
  if ($stageSfxRoutes.Count -ne 40) { throw ("Stage SFX route audit was incomplete: " + ($stageSfxRoutes | ConvertTo-Json -Compress)) }
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
  $e4Route = Evaluate "({walk1:archiveAudio.lastSfx.has('sfxE4Walk1'),brake:archiveAudio.lastSfx.has('sfxE4Brake'),rates:(archiveAudio.sfxPools.get('sfxE4Walk1')??[]).map(sound=>sound.playbackRate),state:{moving:archivePhaserGame.scene.getScene('archive-game').state.moving,x:archivePhaserGame.scene.getScene('archive-game').state.x}})"
  if (!$e4Route.walk1 -or $e4Route.brake -or !($e4Route.rates | Where-Object { $_ -ge .92 })) { throw ("E4 footsteps or silent braking routing failed: " + ($e4Route | ConvertTo-Json -Compress)) }
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
  if (!(Evaluate "archiveAudio.bgmKey==='main' && archiveAudio.bgmStarted && !archiveAudio.bgm.paused && archiveAudio.bgmSlots.filter(track=>!track.paused&&track.volume>0).length===1")) { throw "Main menu did not restore one exclusive main theme" }
  $inventory = Evaluate "(async()=>Promise.all(Object.entries(ARCHIVE_AUDIO_TUNING.bgm.tracks).map(([key,track])=>new Promise(resolve=>{const a=new Audio(track.path);a.preload='metadata';a.onloadedmetadata=()=>resolve({key,duration:a.duration,error:null});a.onerror=()=>resolve({key,duration:0,error:a.error?.code??-1});a.load();}))))()"
  if ($inventory.Count -ne 10 -or ($inventory | Where-Object { $_.error -or $_.duration -le 0 })) { throw ("BGM inventory load failed: " + ($inventory | ConvertTo-Json -Compress)) }
  $levels = Evaluate "(async()=>{const entries=[...Object.entries(ARCHIVE_AUDIO_TUNING.bgm.tracks).filter(([key])=>key!=='e9').map(([key,value])=>({type:'bgm',key,path:value.path,gain:value.gain})),...AUDIO_MANIFEST.map(value=>({type:'sfx',key:value.key,path:value.paths[0]}))],context=new AudioContext(),db=value=>value>0?20*Math.log10(value):-120,rows=[];for(const entry of entries){const buffer=await context.decodeAudioData(await(await fetch(entry.path)).arrayBuffer()),channels=Array.from({length:buffer.numberOfChannels},(_,index)=>buffer.getChannelData(index)),stride=entry.type==='bgm'?8:1,block=2048;let peak=0,totalSquare=0,totalCount=0,activeSquare=0,activeCount=0,firstSound=-1;for(let from=0;from<buffer.length;from+=block*stride){let square=0,count=0;for(let i=from;i<Math.min(buffer.length,from+block*stride);i+=stride)for(const channel of channels){const sample=channel[i];if(firstSound<0&&Math.abs(sample)>.01)firstSound=i/buffer.sampleRate;peak=Math.max(peak,Math.abs(sample));square+=sample*sample;count++}totalSquare+=square;totalCount+=count;if(db(Math.sqrt(square/Math.max(1,count)))>-45){activeSquare+=square;activeCount+=count}}rows.push({...entry,duration:+buffer.duration.toFixed(3),onset:+Math.max(0,firstSound).toFixed(3),peakDb:+db(peak).toFixed(2),rmsDb:+db(Math.sqrt(totalSquare/totalCount)).toFixed(2),activeRmsDb:+db(Math.sqrt(activeSquare/Math.max(1,activeCount))).toFixed(2)})}await context.close();return rows})()"
  $adjustedBgm = @($levels | Where-Object type -eq "bgm" | ForEach-Object { $_.activeRmsDb + 20 * [Math]::Log10($_.gain) })
  $bgmSpread = ($adjustedBgm | Measure-Object -Maximum).Maximum - ($adjustedBgm | Measure-Object -Minimum).Minimum
  if ($bgmSpread -gt 1.2) { throw "Balanced BGM spread exceeded 1.2 dB: $bgmSpread" }
  $e5HitLevels = @($levels | Where-Object { $_.key -in @('sfxE5Broken1', 'sfxE5Broken2') } | ForEach-Object { $gain = (Evaluate "ARCHIVE_AUDIO_TUNING.sfx.files.$($_.key).gain"); @{ key = $_.key; duration = $_.duration; activeRmsDb = $_.activeRmsDb; gain = $gain; outputRmsDb = [Math]::Round($_.activeRmsDb + 20 * [Math]::Log10($gain), 2) } })
  $e2WaxLevels = @($levels | Where-Object { $_.key -in @('sfxE2WaxJump', 'sfxE2WaxCrack1', 'sfxE2WaxCrack2') } | ForEach-Object { $gain = (Evaluate "ARCHIVE_AUDIO_TUNING.sfx.files.$($_.key).gain"); @{ key = $_.key; duration = $_.duration; activeRmsDb = $_.activeRmsDb; gain = $gain; outputRmsDb = [Math]::Round($_.activeRmsDb + 20 * [Math]::Log10($gain), 2) } })
  $e3CountLevel = @($levels | Where-Object key -eq 'sfxE3SuccessCount' | ForEach-Object { $gain = (Evaluate "ARCHIVE_AUDIO_TUNING.sfx.files.$($_.key).gain"); @{ key = $_.key; duration = $_.duration; activeRmsDb = $_.activeRmsDb; gain = $gain; outputRmsDb = [Math]::Round($_.activeRmsDb + 20 * [Math]::Log10($gain), 2) } })
  $e10JumpLevels = @($levels | Where-Object { $_.key -in @('sfxE10Jump', 'sfxE10TouchNumber') } | ForEach-Object { $gain = (Evaluate "ARCHIVE_AUDIO_TUNING.sfx.files.$($_.key).gain"); @{ key = $_.key; duration = $_.duration; onset = $_.onset; activeRmsDb = $_.activeRmsDb; gain = $gain; outputRmsDb = [Math]::Round($_.activeRmsDb + 20 * [Math]::Log10($gain), 2) } })
  $sfxLevels = @($levels | Where-Object type -eq "sfx")
  if ($sfxLevels.Count -ne 31) { throw "SFX decode inventory should contain 31 files" }
  Write-Output ("E5_HIT_LEVELS=" + ($e5HitLevels | ConvertTo-Json -Compress))
  Write-Output ("E2_WAX_LEVELS=" + ($e2WaxLevels | ConvertTo-Json -Compress))
  Write-Output ("E3_COUNT_LEVEL=" + ($e3CountLevel | ConvertTo-Json -Compress))
  Write-Output ("E10_JUMP_LEVELS=" + ($e10JumpLevels | ConvertTo-Json -Compress))
  Write-Output ("BGM_ROUTE_AUDIT=" + ($bgmRoutes | ForEach-Object { @{ id = $_.id; audible = $_.audible[0].key } } | ConvertTo-Json -Compress))
  Write-Output ("SFX_ROUTE_AUDIT=" + ($stageSfxRoutes | ConvertTo-Json -Compress))
  Write-Output ("AUDIO_LEVEL_SUMMARY=" + (@{ bgmCount = $adjustedBgm.Count; sfxCount = $sfxLevels.Count; balancedBgmSpreadDb = [Math]::Round($bgmSpread, 2) } | ConvertTo-Json -Compress))
  Write-Output ("PASS: 10 active BGM files, 31 SFX files, E9 excluded, all active-stage BGM exclusive, 40 gameplay SFX routes, silent game briefing, main-menu restore, Sound Lab, blocked autoplay, real click recovery, track gain, mute, restart, pause and resume. " + ($playing | ConvertTo-Json -Compress))
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
}
