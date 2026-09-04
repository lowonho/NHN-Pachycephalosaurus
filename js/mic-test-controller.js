class MicTestController {
  constructor(uiElements, voiceController, statusSetter) {
    this.ui = uiElements;
    this.voice = voiceController;
    this.setStatus = statusSetter;
  }

  async runCalibration() {
    const { ui, voice } = this;
    ui.primaryButton.disabled = true;
    ui.secondaryButton.hidden = true;
    ui.modalStep.textContent = "VOICE SETUP";
    ui.modalTitle.textContent = "편하게 ‘아—’ 해보세요";
    ui.modalCopy.textContent = "2.4초 동안 평소 말할 때의 편안한 높이로 길게 소리 내주세요.";
    ui.calibrationResult.textContent = "중간음을 듣고 있어요…";
    ui.calibrationVisual.classList.add("listening");

    try {
      if (!voice.stream) await voice.connect();
      this.setStatus(true, "마이크 연결됨 · 중간음 측정 중");
      const result = await voice.calibrate();
      ui.calibrationVisual.classList.remove("listening");

      if (!result.ok) {
        ui.modalTitle.textContent = "목소리가 잘 안 들렸어요";
        ui.modalCopy.textContent = "마이크 가까이에서 편안하게 ‘아—’ 하고 다시 말해주세요.";
        ui.calibrationResult.textContent = "충분한 음높이를 측정하지 못했습니다.";
        ui.primaryButton.textContent = "다시 측정";
        ui.primaryButton.disabled = false;
        ui.secondaryButton.hidden = false;
        ui.secondaryButton.textContent = "마이크 없이 키보드로 테스트";
        ui.secondaryButton.dataset.action = "keyboard";
        return;
      }

      ui.modalTitle.textContent = "중간음 설정 완료!";
      ui.modalCopy.innerHTML = "<b>파라파라</b>로 오른쪽 이동 → <b>야호</b>로 장애물을 넘고<br><b>마떼루요</b>로 포토존에 멈추세요.";
      ui.calibrationResult.textContent = `내 기준음 ${Math.round(result.pitch)} Hz · 야호를 높게 말하면 더 높이 점프!`;
      ui.primaryButton.textContent = "20.26초 도전 시작";
      ui.primaryButton.disabled = false;
      ui.primaryButton.dataset.action = "start";
      ui.secondaryButton.dataset.action = "recalibrate";
      this.setStatus(true, `중간음 ${Math.round(result.pitch)} Hz 설정 완료`);
    } catch (error) {
      ui.calibrationVisual.classList.remove("listening");
      ui.modalTitle.textContent = "마이크를 연결할 수 없어요";
      ui.modalCopy.textContent = "브라우저 주소창의 마이크 권한을 허용한 뒤 다시 시도해주세요.";
      ui.calibrationResult.textContent = error.message || "마이크 권한을 확인해주세요.";
      ui.primaryButton.textContent = "다시 연결";
      ui.primaryButton.disabled = false;
      ui.secondaryButton.hidden = false;
      ui.secondaryButton.textContent = "마이크 없이 키보드로 테스트";
      ui.secondaryButton.dataset.action = "keyboard";
      this.setStatus(false, "마이크 권한 확인 필요");
    }
  }
}
