/*
 * A(비주얼) 전용 — 화면 하단 명령어 카드(DOM).
 *
 * 카드 문구는 voice/command-dict.js 하나만 보고 만든다.
 * index.html에 문구를 중복해서 적지 않으므로 사전과 화면이 어긋날 일이 없다.
 */

class CommandDeckView {
  constructor(events, dom, theme, dictionary) {
    this.deck = dom.commandDeck;
    this.pulseMs = theme.motion.commandPulseMs;
    this.cards = new Map();
    this.timers = new Map();

    this.render(dictionary);
    events.on(GAME_EVENTS.COMMAND_RECOGNIZED, ({ command }) => this.pulse(command));
  }

  render(dictionary) {
    if (!this.deck) return;
    this.deck.textContent = "";

    dictionary.forEach((entry) => {
      const card = document.createElement("article");
      card.className = `command ${entry.className}`;

      const label = document.createElement("b");
      label.textContent = entry.label;

      const hint = document.createElement("span");
      hint.textContent = entry.hint;

      card.append(label, hint);
      this.deck.append(card);
      this.cards.set(entry.command, card);
    });
  }

  pulse(command) {
    const card = this.cards.get(command);
    if (!card) return;

    window.clearTimeout(this.timers.get(command));
    card.classList.add("active");
    this.timers.set(
      command,
      window.setTimeout(() => card.classList.remove("active"), this.pulseMs),
    );
  }
}

const commandDeckView = new CommandDeckView(gameEvents, UI, THEME, COMMAND_DICT);
