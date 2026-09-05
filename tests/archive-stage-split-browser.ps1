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
  $snapshots = Evaluate @'
(() => {
 const scene = archivePhaserGame.scene.getScene('archive-game');
 archivePhaserGame.loop.sleep();
 const results = [];
 for (const id of ['maze','gravity','bounce','friction','stack']) {
  scene.loadStage(id); scene.startStage();
  scene.settings = {shake:false,effects:false};
  const initial = JSON.stringify(scene.state);
  for(let i=0;i<90 && scene.mode==='playing';i++){
   if(i===0) scene.directionPress('right');
   if(i===15) scene.primaryAction();
   if(i===30){ scene.directionRelease('right'); scene.directionPress('left'); }
   if(i===45) scene.pointerAction(480,80);
   if(i===60) scene.directionRelease('left');
   scene.update(i*16,16);
  }
  const snapshot = {id,state:scene.state,remaining:scene.remaining,actions:scene.actions,risk:scene.risk,mode:scene.mode,body:scene.fragmentBody()};
  results.push(JSON.parse(JSON.stringify(snapshot)));
  scene.startStage();
  if(JSON.stringify(scene.state)!==initial) throw Error(id+' restart changed initial state');
  scene.pausedByMenu=true;
  const before=scene.remaining; scene.update(0,16);
  if(scene.remaining!==before) throw Error(id+' pause advanced timer');
  scene.stopGame();
 }
 return results;
})()
'@
  $expected = Get-Content -Raw (Join-Path $root "tests/fixtures/stage-split-baseline.json") | ConvertFrom-Json
  $actualJson = $snapshots | ConvertTo-Json -Depth 30 -Compress
  $expectedJson = $expected | ConvertTo-Json -Depth 30 -Compress
  if ($actualJson -ne $expectedJson) { throw "Stage behavior differs from the pre-split baseline: $actualJson" }
  Write-Output "PASS: all five stages match pre-split movement, input, timer, result and fragment-body snapshots; restart and pause pass."
} finally {
  $socket.Dispose()
  if (!$browser.HasExited) { Stop-Process -Id $browser.Id -ErrorAction SilentlyContinue }
}
