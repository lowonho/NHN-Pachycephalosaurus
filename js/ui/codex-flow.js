/* 엔딩 뒤 해금되는 18개 증언 기록 열람 화면. */
class CodexFlow {
  constructor(events, dom, soundBus) {
    this.events = events;
    this.ui = dom;
    this.soundBus = soundBus;
    this.catalog = PROTOCOLS;
    this.ui.codexCloseButton?.addEventListener('click', () => this.close());
    this.ui.codexBackdrop?.addEventListener('mousedown', (event) => {
      if (event.target === this.ui.codexBackdrop) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  isOpen() {
    return Boolean(this.ui.codexBackdrop) && !this.ui.codexBackdrop.classList.contains('hidden');
  }

  toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  open() {
    if (!window.archiveRun?.snapshot().archiveViewerUnlocked) return;
    this.soundBus.resume();
    this.render();
    this.ui.codexBackdrop?.classList.remove('hidden');
    this.ui.mainMenu?.setAttribute('inert', '');
    this.ui.codexDialog?.focus();
  }

  close({ restoreFocus = true } = {}) {
    this.ui.codexBackdrop?.classList.add('hidden');
    this.ui.mainMenu?.removeAttribute('inert');
    if (restoreFocus) this.ui.mainCodexButton?.focus();
  }

  setStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return;
    this.catalog = stages;
    if (this.isOpen()) this.render();
  }

  render() {
    const grid = this.ui.codexGrid;
    if (!grid) return;
    const run = window.archiveRun?.snapshot();
    const entries = run?.archiveEntries ?? [];
    const byRecord = new Map(entries.map((entry) => [entry.recordId, entry]));
    grid.replaceChildren(...SCENARIO_DATA.records.map((record) => this.buildCard(record, byRecord.get(record.id))));
    if (this.ui.codexCount) this.ui.codexCount.textContent = `RECORDS ${entries.length} / 18`;
  }

  buildCard(record, entry) {
    const stage = this.catalog.find((item) => item.id === entry?.gameId);
    const card = document.createElement('li');
    card.className = 'codex-card';
    card.dataset.recordId = record.id;
    card.dataset.discovered = String(Boolean(entry));

    const head = document.createElement('div');
    head.className = 'codex-card-head';
    const number = document.createElement('span');
    number.className = 'codex-card-number';
    number.textContent = record.id;
    const icon = document.createElement('span');
    icon.className = 'codex-card-icon';
    icon.textContent = entry ? '◆' : '◇';
    head.append(number, icon);

    const title = document.createElement('strong');
    title.className = 'codex-card-title';
    title.textContent = record.title;
    card.append(head, title);

    if (entry) {
      const game = document.createElement('p');
      game.className = 'codex-card-record';
      game.textContent = `${entry.gameId.toUpperCase()} · ${stage?.title ?? '기록 미상'}`;
      game.dataset.full = 'true';
      const detail = document.createElement('p');
      detail.className = 'codex-card-text codex-card-testimony';
      detail.textContent = record.text;
      card.append(game, detail);
    } else {
      const locked = document.createElement('p');
      locked.className = 'codex-card-locked';
      locked.textContent = '등록되지 않은 증언';
      card.append(locked);
    }
    return card;
  }
}

const codexFlow = new CodexFlow(gameEvents, UI, audioBus);
