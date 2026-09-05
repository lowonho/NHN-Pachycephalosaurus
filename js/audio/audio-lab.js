/*
 * 개발 전용 실시간 사운드 조정 패널.
 * URL에 ?audioLab=1 이 있을 때만 DOM을 만들며 일반 플레이에는 나타나지 않는다.
 */
(function installAudioLab() {
  if (new URLSearchParams(location.search).get("audioLab") !== "1") return;

  const root = document.createElement("aside");
  root.id = "audio-lab";
  root.innerHTML = `
    <style>
      #audio-lab{position:fixed;z-index:10000;right:12px;top:12px;width:340px;max-height:calc(100vh - 24px);overflow:auto;padding:14px;color:#eafaff;background:#07131ef2;border:1px solid #42d9ff;border-radius:12px;box-shadow:0 12px 40px #000a;font:13px/1.35 system-ui,sans-serif}
      #audio-lab *{box-sizing:border-box}#audio-lab h2{margin:0 0 10px;font-size:16px;color:#7be7ff}#audio-lab fieldset{margin:10px 0;padding:10px;border:1px solid #315267;border-radius:8px}#audio-lab legend{padding:0 6px;color:#ff89be;font-weight:700}#audio-lab label{display:grid;grid-template-columns:105px 1fr 42px;gap:7px;align-items:center;margin:7px 0}#audio-lab label.wide{grid-template-columns:105px 1fr}#audio-lab select,#audio-lab input[type=number]{width:100%;min-width:0;background:#102635;color:#fff;border:1px solid #436779;border-radius:5px;padding:5px}#audio-lab input[type=range]{width:100%}#audio-lab output{text-align:right;color:#92edff;font-variant-numeric:tabular-nums}#audio-lab .buttons{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#audio-lab button{padding:6px 9px;color:#fff;background:#18374a;border:1px solid #4e839d;border-radius:6px;cursor:pointer}#audio-lab button:hover{background:#24516b}#audio-lab audio{width:100%;height:34px;margin-top:6px}#audio-lab small{display:block;color:#9eb6c2;margin-top:7px}#audio-lab-status{color:#75e5a5!important}
    </style>
    <h2>SOUND LAB · 실시간 조정</h2>
    <fieldset>
      <legend>BGM</legend>
      <label class="wide">트랙 <select id="audio-lab-bgm"></select></label>
      <label>트랙 게인 <input id="audio-lab-gain" type="range" min="0" max="150" step="1"><output id="audio-lab-gain-value"></output></label>
      <label>크로스페이드 <input id="audio-lab-fade" type="range" min="0" max="2000" step="25"><output id="audio-lab-fade-value"></output></label>
      <label>루프 시작 <input id="audio-lab-loop-start" type="number" min="0" step="0.01"><output>초</output></label>
      <label>루프 끝 <input id="audio-lab-loop-end" type="number" min="0" step="0.01" placeholder="곡 끝"><output>초</output></label>
      <div class="buttons"><button id="audio-lab-play">처음부터 재생</button><button id="audio-lab-pause">일시정지</button></div>
    </fieldset>
    <fieldset>
      <legend>합성 SFX 프리셋</legend>
      <label class="wide">프리셋 <select id="audio-lab-sfx"></select></label>
      <label>주파수 <input id="audio-lab-frequency" type="range" min="30" max="1200" step="1"><output id="audio-lab-frequency-value"></output></label>
      <label>길이 <input id="audio-lab-duration" type="range" min="20" max="800" step="5"><output id="audio-lab-duration-value"></output></label>
      <label>게인 <input id="audio-lab-sfx-gain" type="range" min="1" max="20" step="0.5"><output id="audio-lab-sfx-gain-value"></output></label>
      <label>피치 이동 <input id="audio-lab-slide" type="range" min="-600" max="600" step="5"><output id="audio-lab-slide-value"></output></label>
      <label class="wide">파형 <select id="audio-lab-wave"><option>sine</option><option>triangle</option><option>square</option><option>sawtooth</option></select></label>
      <div class="buttons"><button id="audio-lab-sfx-play">SFX 듣기</button></div>
      <small>성공음처럼 여러 음인 프리셋은 첫 음을 조정합니다.</small>
    </fieldset>
    <fieldset>
      <legend>파일 SFX</legend>
      <label class="wide">효과음 <select id="audio-lab-file-sfx"></select></label>
      <label>파일 게인 <input id="audio-lab-file-gain" type="range" min="0" max="150" step="1"><output id="audio-lab-file-gain-value"></output></label>
      <label>재생 속도 <input id="audio-lab-file-rate" type="range" min="50" max="150" step="1"><output id="audio-lab-file-rate-value"></output></label>
      <div class="buttons"><button id="audio-lab-file-play">파일 SFX 듣기</button></div>
      <small>게임에 연결된 최종 게인과 기본 재생 속도를 바로 조정합니다.</small>
    </fieldset>
    <fieldset>
      <legend>후보 파일 A/B</legend>
      <input id="audio-lab-file" type="file" accept="audio/*">
      <audio id="audio-lab-preview" controls></audio>
      <small>파일을 프로젝트에 넣지 않고 로컬 후보를 바로 비교합니다.</small>
    </fieldset>
    <div class="buttons"><button id="audio-lab-export">설정 JSON 저장</button><button id="audio-lab-reset">기본값 복원</button><button id="audio-lab-close">패널 닫기</button></div>
    <small id="audio-lab-status">조정값은 이 브라우저에 자동 저장됩니다.</small>
  `;
  document.body.append(root);

  const $ = (selector) => root.querySelector(selector);
  const bgmSelect = $("#audio-lab-bgm");
  const sfxSelect = $("#audio-lab-sfx");
  const fileSfxSelect = $("#audio-lab-file-sfx");
  const preview = $("#audio-lab-preview");
  let previewUrl = "";

  function tuning() { return globalThis.ARCHIVE_AUDIO_TUNING; }
  function save(message = "조정값 저장됨") {
    globalThis.archiveAudioTuning.save();
    window.archiveAudio?.refreshTuning();
    $("#audio-lab-status").textContent = message;
  }
  function fillOptions() {
    bgmSelect.replaceChildren(...Object.entries(tuning().bgm.tracks).map(([key, track]) => new Option(`${key.toUpperCase()} · ${track.label}`, key)));
    sfxSelect.replaceChildren(...Object.entries(tuning().sfx.presets).map(([key, preset]) => new Option(`${key} · ${preset.label}`, key)));
    fileSfxSelect.replaceChildren(...Object.entries(tuning().sfx.files).map(([key, file]) => new Option(`${key} · ${file.label}`, key)));
    bgmSelect.value = window.archiveAudio?.bgmKey ?? "main";
  }
  function syncBgm() {
    const track = tuning().bgm.tracks[bgmSelect.value];
    if (!track) return;
    $("#audio-lab-gain").value = String(Math.round(track.gain * 100));
    $("#audio-lab-gain-value").textContent = `${Math.round(track.gain * 100)}%`;
    $("#audio-lab-fade").value = String(tuning().bgm.fadeMs);
    $("#audio-lab-fade-value").textContent = `${tuning().bgm.fadeMs}ms`;
    $("#audio-lab-loop-start").value = String(track.loopStart || 0);
    $("#audio-lab-loop-end").value = track.loopEnd ?? "";
  }
  function syncSfx() {
    const voice = tuning().sfx.presets[sfxSelect.value]?.voices?.[0];
    if (!voice) return;
    $("#audio-lab-frequency").value = String(voice.frequency);
    $("#audio-lab-frequency-value").textContent = `${voice.frequency}Hz`;
    $("#audio-lab-duration").value = String(Math.round(voice.duration * 1000));
    $("#audio-lab-duration-value").textContent = `${Math.round(voice.duration * 1000)}ms`;
    $("#audio-lab-sfx-gain").value = String(voice.gain * 100);
    $("#audio-lab-sfx-gain-value").textContent = `${Math.round(voice.gain * 100)}%`;
    $("#audio-lab-slide").value = String(voice.slide || 0);
    $("#audio-lab-slide-value").textContent = `${voice.slide > 0 ? "+" : ""}${voice.slide || 0}Hz`;
    $("#audio-lab-wave").value = voice.type;
  }
  function syncFileSfx() {
    const file = tuning().sfx.files[fileSfxSelect.value];
    if (!file) return;
    $("#audio-lab-file-gain").value = String(Math.round(file.gain * 100));
    $("#audio-lab-file-gain-value").textContent = `${Math.round(file.gain * 100)}%`;
    $("#audio-lab-file-rate").value = String(Math.round(file.rate * 100));
    $("#audio-lab-file-rate-value").textContent = `${Math.round(file.rate * 100)}%`;
  }

  fillOptions(); syncBgm(); syncSfx(); syncFileSfx();
  bgmSelect.addEventListener("change", syncBgm);
  sfxSelect.addEventListener("change", syncSfx);
  fileSfxSelect.addEventListener("change", syncFileSfx);

  $("#audio-lab-gain").addEventListener("input", (event) => {
    tuning().bgm.tracks[bgmSelect.value].gain = Number(event.target.value) / 100;
    $("#audio-lab-gain-value").textContent = `${event.target.value}%`; save();
  });
  $("#audio-lab-fade").addEventListener("input", (event) => {
    tuning().bgm.fadeMs = Number(event.target.value);
    $("#audio-lab-fade-value").textContent = `${event.target.value}ms`; save();
  });
  $("#audio-lab-loop-start").addEventListener("input", (event) => {
    tuning().bgm.tracks[bgmSelect.value].loopStart = Math.max(0, Number(event.target.value) || 0); save();
  });
  $("#audio-lab-loop-end").addEventListener("input", (event) => {
    tuning().bgm.tracks[bgmSelect.value].loopEnd = event.target.value === "" ? null : Math.max(0, Number(event.target.value)); save();
  });
  $("#audio-lab-play").addEventListener("click", () => {
    window.archiveAudio?.selectBgm(bgmSelect.value, { restart: true, immediate: false });
    window.archiveAudio?.startBgm(); save(`${bgmSelect.value.toUpperCase()} 재생 중`);
  });
  $("#audio-lab-pause").addEventListener("click", () => { window.archiveAudio?.pauseBgm(); save("BGM 일시정지"); });

  const bindVoiceRange = (selector, output, property, convert, format) => {
    $(selector).addEventListener("input", (event) => {
      const voice = tuning().sfx.presets[sfxSelect.value].voices[0];
      voice[property] = convert(Number(event.target.value));
      $(output).textContent = format(voice[property]); save();
    });
  };
  bindVoiceRange("#audio-lab-frequency", "#audio-lab-frequency-value", "frequency", (value) => value, (value) => `${value}Hz`);
  bindVoiceRange("#audio-lab-duration", "#audio-lab-duration-value", "duration", (value) => value / 1000, (value) => `${Math.round(value * 1000)}ms`);
  bindVoiceRange("#audio-lab-sfx-gain", "#audio-lab-sfx-gain-value", "gain", (value) => value / 100, (value) => `${Math.round(value * 100)}%`);
  bindVoiceRange("#audio-lab-slide", "#audio-lab-slide-value", "slide", (value) => value, (value) => `${value > 0 ? "+" : ""}${value}Hz`);
  $("#audio-lab-wave").addEventListener("change", (event) => { tuning().sfx.presets[sfxSelect.value].voices[0].type = event.target.value; save(); });
  $("#audio-lab-sfx-play").addEventListener("click", () => window.archiveAudio?.play(sfxSelect.value));
  $("#audio-lab-file-gain").addEventListener("input", (event) => {
    tuning().sfx.files[fileSfxSelect.value].gain = Number(event.target.value) / 100;
    $("#audio-lab-file-gain-value").textContent = `${event.target.value}%`; save();
  });
  $("#audio-lab-file-rate").addEventListener("input", (event) => {
    tuning().sfx.files[fileSfxSelect.value].rate = Number(event.target.value) / 100;
    $("#audio-lab-file-rate-value").textContent = `${event.target.value}%`; save();
  });
  $("#audio-lab-file-play").addEventListener("click", () => window.archiveAudio?.play(fileSfxSelect.value));

  $("#audio-lab-file").addEventListener("change", (event) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = event.target.files?.[0];
    if (!file) return;
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    const candidateVolume = typeof audioBus !== "undefined" ? audioBus.channelVolume("sfx") : 0.7;
    preview.volume = Math.max(0, Math.min(1, candidateVolume));
    preview.play().catch(() => {});
  });
  $("#audio-lab-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(tuning(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "archive-audio-tuning.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); save("설정 JSON 저장 완료");
  });
  $("#audio-lab-reset").addEventListener("click", () => {
    globalThis.archiveAudioTuning.reset(); fillOptions(); syncBgm(); syncSfx(); syncFileSfx();
    window.archiveAudio?.refreshTuning(); $("#audio-lab-status").textContent = "기본값 복원 완료";
  });
  $("#audio-lab-close").addEventListener("click", () => root.remove());
  window.addEventListener("beforeunload", () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, { once: true });
})();
