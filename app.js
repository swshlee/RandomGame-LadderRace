const CONFIG = {
  "repo": "RandomGame-LadderRace",
  "title": "랜덤 사다리 경주",
  "subtitle": "꼬불꼬불한 사다리 끝에서 한 명이 도착합니다",
  "icon": "▥",
  "mode": "ladder",
  "item": "사다리",
  "arenaLabel": "사다리 보드",
  "waiting": "사다리가 접혀 있습니다",
  "start": "사다리 출발",
  "action": "갈림길 통과",
  "final": "마지막 가로줄",
  "winnerLine": "도착 지점에 먼저 닿았습니다",
  "eliminatedLine": "다른 길로 빠졌습니다",
  "theme": [
    "#ffb83d",
    "#39d4ff",
    "#171b24"
  ],
  "sampleNames": [
    "김도윤",
    "이서연",
    "박지호",
    "최하준",
    "정민서",
    "강서준",
    "윤지우",
    "장하은",
    "임시우",
    "한유진",
    "오준서",
    "신아린",
    "권도현",
    "송지민",
    "홍예준",
    "유나"
  ]
};

const dom = {
  namesInput: document.getElementById("namesInput"),
  fileInput: document.getElementById("fileInput"),
  sampleButton: document.getElementById("sampleButton"),
  startButton: document.getElementById("startButton"),
  resetButton: document.getElementById("resetButton"),
  playerCount: document.getElementById("playerCount"),
  activeCount: document.getElementById("activeCount"),
  message: document.getElementById("message"),
  stageTitle: document.getElementById("stageTitle"),
  board: document.getElementById("board"),
  effectLayer: document.getElementById("effectLayer"),
  winnerPanel: document.getElementById("winnerPanel"),
  winnerName: document.getElementById("winnerName"),
};

const state = {
  players: [],
  running: false,
  token: 0,
  winnerIndex: -1,
};

init();

function init() {
  dom.namesInput.value = CONFIG.sampleNames.join("\n");
  bindEvents();
  loadPlayers();
  render();
}

function bindEvents() {
  dom.namesInput.addEventListener("input", () => {
    if (state.running) {
      return;
    }
    loadPlayers();
    render();
  });

  dom.sampleButton.addEventListener("click", () => {
    if (state.running) {
      return;
    }
    dom.namesInput.value = shuffle(CONFIG.sampleNames).join("\n");
    loadPlayers();
    render();
  });

  dom.fileInput.addEventListener("change", async () => {
    if (state.running) {
      return;
    }
    const [file] = dom.fileInput.files;
    if (!file) {
      return;
    }
    const text = await file.text();
    dom.namesInput.value = parseNames(text).join("\n");
    loadPlayers();
    render();
  });

  dom.startButton.addEventListener("click", startGame);
  dom.resetButton.addEventListener("click", resetGame);
}

function parseNames(text) {
  return text
    .split(/[\n,;\t]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function loadPlayers() {
  const uniqueNames = [];
  const seen = new Set();
  parseNames(dom.namesInput.value).forEach((name) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueNames.push(name);
    }
  });

  state.players = uniqueNames.map((name, index) => ({
    id: index,
    name,
    active: true,
    winner: false,
  }));
  state.winnerIndex = -1;
}

async function startGame() {
  if (state.running) {
    return;
  }

  loadPlayers();
  if (state.players.length < 2) {
    setMessage("참여자는 2명 이상 필요합니다");
    return;
  }

  state.running = true;
  state.token += 1;
  const token = state.token;
  state.winnerIndex = randomInt(0, state.players.length - 1);
  state.players.forEach((player) => {
    player.active = true;
    player.winner = false;
  });

  dom.winnerPanel.hidden = true;
  dom.startButton.disabled = true;
  dom.namesInput.disabled = true;
  dom.fileInput.disabled = true;
  setMessage(CONFIG.start);
  dom.stageTitle.textContent = CONFIG.start;
  render();
  await wait(760);

  let active = activePlayers();
  while (active.length > 3) {
    if (token !== state.token) {
      return;
    }
    setMessage(CONFIG.action);
    dom.stageTitle.textContent = CONFIG.action;
    shakeActive();
    await wait(780);

    const batchSize = randomInt(1, Math.max(1, Math.floor(active.length / 3)));
    eliminateBatch(batchSize);
    render();
    popBursts(batchSize + 4);
    await wait(720);
    active = activePlayers();
  }

  if (token !== state.token) {
    return;
  }

  setMessage(CONFIG.final);
  dom.stageTitle.textContent = CONFIG.final;
  shakeActive();
  await wait(1100);

  activePlayers().forEach((player) => {
    if (player.id !== state.winnerIndex) {
      player.active = false;
    }
  });
  const winner = state.players[state.winnerIndex];
  winner.active = true;
  winner.winner = true;
  render();
  popBursts(44);
  revealWinner(winner);
}

function eliminateBatch(batchSize) {
  const candidates = activePlayers().filter((player) => player.id !== state.winnerIndex);
  shuffle(candidates)
    .slice(0, batchSize)
    .forEach((player) => {
      player.active = false;
    });
}

function activePlayers() {
  return state.players.filter((player) => player.active);
}

function render() {
  const activeCount = activePlayers().length;
  dom.playerCount.textContent = formatNumber(state.players.length);
  dom.activeCount.textContent = formatNumber(activeCount);
  dom.board.innerHTML = state.players
    .map((player, index) => {
      const classes = ["player-card"];
      if (player.active) classes.push("active");
      if (!player.active) classes.push("out");
      if (player.winner) classes.push("winner");
      return '<article class="' + classes.join(" ") + '" style="--delay:' + (index % 8) * 45 + 'ms">' +
        '<span class="player-icon">' + CONFIG.icon + '</span>' +
        '<span class="player-name">' + escapeHtml(player.name) + '</span>' +
      '</article>';
    })
    .join("");

  if (!state.running) {
    dom.stageTitle.textContent = CONFIG.waiting;
    setMessage(CONFIG.waiting);
  }
}

function shakeActive() {
  dom.board.querySelectorAll(".player-card.active").forEach((card, index) => {
    card.animate(
      [
        { transform: "translateY(0) rotate(0deg)" },
        { transform: "translateY(-10px) rotate(" + (index % 2 === 0 ? 2 : -2) + "deg)" },
        { transform: "translateY(0) rotate(0deg)" },
      ],
      {
        duration: 520,
        delay: (index % 9) * 28,
        easing: "cubic-bezier(.2,.8,.2,1)",
      },
    );
  });
}

function popBursts(count) {
  const rect = dom.effectLayer.getBoundingClientRect();
  for (let index = 0; index < count; index += 1) {
    const burst = document.createElement("span");
    burst.className = "burst";
    burst.style.left = randomInt(8, Math.max(9, Math.floor(rect.width - 20))) + "px";
    burst.style.top = randomInt(8, Math.max(9, Math.floor(rect.height - 20))) + "px";
    burst.style.setProperty("--x", randomInt(-120, 120) + "px");
    burst.style.setProperty("--y", randomInt(-120, 120) + "px");
    burst.style.animationDelay = randomInt(0, 180) + "ms";
    dom.effectLayer.appendChild(burst);
    window.setTimeout(() => burst.remove(), 1200);
  }
}

function revealWinner(winner) {
  state.running = false;
  dom.startButton.disabled = false;
  dom.namesInput.disabled = false;
  dom.fileInput.disabled = false;
  dom.winnerName.textContent = winner.name;
  dom.winnerPanel.hidden = false;
  dom.stageTitle.textContent = "우승자 공개";
  setMessage(winner.name + " - " + CONFIG.winnerLine);
}

function resetGame() {
  state.token += 1;
  state.running = false;
  state.players.forEach((player) => {
    player.active = true;
    player.winner = false;
  });
  state.winnerIndex = -1;
  dom.startButton.disabled = false;
  dom.namesInput.disabled = false;
  dom.fileInput.disabled = false;
  dom.winnerPanel.hidden = true;
  render();
}

function setMessage(text) {
  dom.message.textContent = text;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
