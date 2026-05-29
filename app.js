const REQUIRED_HEADERS = {
  name: ["이름", "참여자명", "성명", "name", "participant"],
};

const NUMBER_HEADER_GROUPS = [
  ["숫자", "숫자1", "번호", "번호1", "사다리번호", "사다리번호1", "경매번호", "경매번호1", "number", "number1", "value", "value1"],
  ["숫자2", "번호2", "사다리번호2", "경매번호2", "number2", "value2"],
  ["숫자3", "번호3", "사다리번호3", "경매번호3", "number3", "value3"],
];

const MAX_NUMBERS_PER_PARTICIPANT = 3;

const SAMPLE_NAMES = [
  "김도윤",
  "이서연",
  "박지호",
  "최하준",
  "정민서",
  "강서준",
  "윤지우",
  "장하은",
  "오준서",
  "신아린",
  "한유준",
  "임서아",
  "조민재",
  "서하율",
  "백지안",
  "문시우",
  "유하린",
  "권도현",
  "남예준",
  "송지민",
  "홍라온",
  "양서윤",
  "안태오",
  "배하은",
  "전우진",
  "노수아",
  "심준영",
  "차예린",
  "구민준",
  "하연우",
];

const SAMPLE_ROWS = Array.from({ length: 150 }, (_, index) => {
  const numberCount = (index % MAX_NUMBERS_PER_PARTICIPANT) + 1;
  const numbers = Array.from({ length: MAX_NUMBERS_PER_PARTICIPANT }, (_, numberIndex) =>
    numberIndex < numberCount ? sampleLadderNumber(index, numberIndex) : "",
  );

  return [`${SAMPLE_NAMES[index % SAMPLE_NAMES.length]}${Math.floor(index / SAMPLE_NAMES.length) + 1}`, ...numbers];
});

const LADDER = {
  minValue: 1,
  maxValue: 999,
  axisMin: 0,
  axisMax: 1000,
  topY: 140,
  bottomY: 900,
  minBoardWidth: 980,
  boardHeight: 760,
  columnGap: 94,
  marginX: 76,
  fitPadding: 18,
  buildMaxMs: 5000,
  runZoom: 2.6,
  zoomSettleMs: 1120,
  heartMsPerUnit: 8.8,
  minHeartSegmentMs: 180,
  cameraFocusX: 0.5,
  cameraFocusY: 0.42,
};

const dom = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  fileName: document.getElementById("fileName"),
  errorBox: document.getElementById("errorBox"),
  sampleButton: document.getElementById("sampleButton"),
  resetButton: document.getElementById("resetButton"),
  buildButton: document.getElementById("buildButton"),
  goButton: document.getElementById("goButton"),
  playerCount: document.getElementById("playerCount"),
  rungCount: document.getElementById("rungCount"),
  startColumn: document.getElementById("startColumn"),
  finishColumn: document.getElementById("finishColumn"),
  message: document.getElementById("message"),
  stageTitle: document.getElementById("stageTitle"),
  ladderViewport: document.getElementById("ladderViewport"),
  ladderBoard: document.getElementById("ladderBoard"),
  ladderContent: document.getElementById("ladderContent"),
  ladderSvg: document.getElementById("ladderSvg"),
  heart: document.getElementById("heart"),
  topLabels: document.getElementById("topLabels"),
  bottomLabels: document.getElementById("bottomLabels"),
  winnerPanel: document.getElementById("winnerPanel"),
  winnerName: document.getElementById("winnerName"),
  winnerDetail: document.getElementById("winnerDetail"),
};

const state = {
  participants: [],
  rungs: [],
  boardWidth: LADDER.minBoardWidth,
  boardHeight: LADDER.boardHeight,
  ladderBuilt: false,
  building: false,
  running: false,
  gameActive: false,
  token: 0,
  route: null,
  heartPoint: null,
  boardZoom: 1,
  cameraFrame: 0,
  cameraResolve: null,
  routeFrame: 0,
  routeResolve: null,
};

init();

function init() {
  bindEvents();
  renderEmpty();
  loadDemoIfRequested();
}

function bindEvents() {
  dom.fileInput.addEventListener("change", async () => {
    const [file] = dom.fileInput.files;
    if (file) {
      await loadFile(file);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dom.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dom.dropZone.classList.remove("dragging");
    });
  });

  dom.dropZone.addEventListener("drop", async (event) => {
    const [file] = event.dataTransfer.files;
    if (file) {
      dom.fileInput.files = event.dataTransfer.files;
      await loadFile(file);
    }
  });

  dom.sampleButton.addEventListener("click", loadSample);
  dom.resetButton.addEventListener("click", resetGame);
  dom.buildButton.addEventListener("click", buildLadderWithAnimation);
  dom.goButton.addEventListener("click", startRun);
  window.addEventListener("resize", handleResize);
}

async function loadFile(file) {
  if (state.running) {
    return;
  }

  clearError();
  dom.fileName.textContent = file.name;
  dom.stageTitle.textContent = "엑셀 분석 중";
  setMessage("이름과 최대 3개의 숫자 컬럼을 읽고 있습니다.");

  try {
    const rows = await parseInputFile(file);
    applyRows(rows);
    setMessage(`${state.participants.length}명이 준비됐습니다. 게임시작을 누르면 사다리가 만들어집니다.`);
  } catch (error) {
    state.participants = [];
    state.rungs = [];
    setError(error.message || "파일을 읽지 못했습니다.");
    renderEmpty();
  }
}

function loadSample() {
  if (state.running) {
    return;
  }
  clearError();
  dom.fileInput.value = "";
  dom.fileName.textContent = "샘플 데이터";
  applyRows([["이름", "숫자1", "숫자2", "숫자3"], ...SAMPLE_ROWS]);
  setMessage(`샘플 데이터 ${SAMPLE_ROWS.length}명이 준비됐습니다. 게임시작을 눌러 사다리를 만드세요.`);
}

function loadDemoIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "1") {
    loadSample();
  }
}

function applyRows(rows) {
  const parsed = normalizeLadderRows(rows);
  state.participants = parsed.participants;
  state.rungs = buildRungs(state.participants);
  state.route = null;
  state.heartPoint = null;
  state.ladderBuilt = false;
  state.building = false;
  state.gameActive = false;
  cancelCameraFollow();
  cancelRouteTrace();
  dom.startColumn.textContent = "--";
  dom.finishColumn.textContent = "--";
  dom.winnerPanel.hidden = true;
  dom.heart.hidden = true;
  dom.heart.classList.remove("running");
  setBoardZoom(1);

  if (parsed.invalidRows.length > 0) {
    setError(`${parsed.invalidRows.length}개 행은 이름 또는 1~999 정수 숫자 최대 3개가 맞지 않아 제외했습니다.`);
  } else {
    clearError();
  }

  renderPreparedLadder();
}

function normalizeLadderRows(rows) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (headerIndex < 0) {
    throw new Error("헤더 행을 찾지 못했습니다.");
  }

  const headers = rows[headerIndex].map((cell) => normalizeHeader(cell));
  const nameColumnIndex = findHeaderIndex(headers, REQUIRED_HEADERS.name);
  const numberColumnIndexes = findNumberHeaderIndexes(headers);
  const missing = [
    nameColumnIndex < 0 ? REQUIRED_HEADERS.name[0] : "",
    numberColumnIndexes.length === 0 ? NUMBER_HEADER_GROUPS[0][0] : "",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`필수 컬럼을 찾지 못했습니다: ${missing.join(", ")}`);
  }

  const participants = [];
  const invalidRows = [];

  rows.slice(headerIndex + 1).forEach((row, rowOffset) => {
    const sourceRow = headerIndex + rowOffset + 2;
    const name = String(row[nameColumnIndex] ?? "").trim();
    const numbers = parseLadderNumbersForRow(row, numberColumnIndexes);

    if (!name || numbers === null || numbers.length === 0) {
      if (row.some((cell) => String(cell ?? "").trim() !== "")) {
        invalidRows.push(sourceRow);
      }
      return;
    }

    participants.push({
      id: participants.length,
      row: sourceRow,
      name,
      numbers,
    });
  });

  if (participants.length < 2) {
    throw new Error("사다리를 만들려면 유효한 참여자가 2명 이상 필요합니다.");
  }

  return { participants, invalidRows };
}

function buildRungs(participants) {
  let id = 0;
  return participants.slice(0, -1).flatMap((participant, index) =>
    participant.numbers.map((value, valueIndex) => ({
      id: id++,
      left: index,
      right: index + 1,
      value,
      valueIndex,
      owner: participant.name,
    })),
  );
}

function renderEmpty() {
  state.participants = [];
  state.rungs = [];
  state.route = null;
  state.heartPoint = null;
  state.ladderBuilt = false;
  state.building = false;
  state.gameActive = false;
  state.boardWidth = LADDER.minBoardWidth;
  state.boardHeight = LADDER.boardHeight;
  cancelCameraFollow();
  cancelRouteTrace();
  syncStageState();
  setBoardZoom(1);
  updateBoardSize();
  dom.ladderSvg.setAttribute("viewBox", `0 0 ${state.boardWidth} 1000`);
  dom.ladderSvg.setAttribute("preserveAspectRatio", "none");
  dom.ladderSvg.innerHTML = renderAxis(state.boardWidth);
  dom.topLabels.innerHTML = "";
  dom.bottomLabels.innerHTML = "";
  dom.playerCount.textContent = "0";
  dom.rungCount.textContent = "0";
  dom.startColumn.textContent = "--";
  dom.finishColumn.textContent = "--";
  dom.buildButton.disabled = true;
  dom.goButton.hidden = true;
  dom.goButton.disabled = true;
  dom.fileInput.disabled = false;
  dom.sampleButton.disabled = false;
  dom.heart.hidden = true;
  dom.heart.classList.remove("running");
  dom.winnerPanel.hidden = true;
  dom.stageTitle.textContent = "사다리 대기 중";
}

function renderPreparedLadder() {
  updateBoardSize();
  dom.ladderSvg.innerHTML = renderAxis(state.boardWidth);
  renderLabels(-1, 0);
  updateStatsAndControls();
  dom.stageTitle.textContent = "참가자 준비 완료";
}

function renderLadder(route = null, options = {}) {
  const count = state.participants.length;
  updateBoardSize();
  dom.ladderSvg.innerHTML = [
    renderAxis(state.boardWidth),
    renderColumns(options),
    renderRungs(options),
    route ? renderRoutePath(route) : "",
  ].join("");

  renderLabels(route?.winnerIndex ?? -1, options);
  updateStatsAndControls();
  if (!state.running && state.ladderBuilt) {
    dom.stageTitle.textContent = "사다리 생성 완료";
  }

  if (route) {
    prepareRoutePath();
  }
}

function updateBoardSize() {
  const count = Math.max(1, state.participants.length);
  const viewportRect = dom.ladderViewport.getBoundingClientRect();
  const viewportWidth = viewportRect.width || dom.ladderViewport.clientWidth || Math.max(320, window.innerWidth - 24);
  const viewportHeight = viewportRect.height || dom.ladderViewport.clientHeight || Math.max(320, window.innerHeight - 140);
  const availableWidth = Math.max(1, viewportWidth - LADDER.fitPadding * 2);
  const availableHeight = Math.max(1, viewportHeight - LADDER.fitPadding * 2);
  const naturalWidth = Math.max(LADDER.minBoardWidth, LADDER.marginX * 2 + (count - 1) * LADDER.columnGap);

  state.boardWidth = Math.min(naturalWidth, availableWidth);
  state.boardHeight = Math.min(LADDER.boardHeight, availableHeight);
  dom.ladderBoard.style.setProperty("--board-width", `${state.boardWidth}px`);
  dom.ladderBoard.style.setProperty("--board-height", `${state.boardHeight}px`);
  updateBoardScale();
  dom.ladderSvg.setAttribute("viewBox", `0 0 ${state.boardWidth} 1000`);
  dom.ladderSvg.setAttribute("preserveAspectRatio", "none");
}

function updateStatsAndControls() {
  syncStageState();
  const count = state.participants.length;
  dom.playerCount.textContent = formatNumber(count);
  dom.rungCount.textContent = formatNumber(state.rungs.length);
  dom.buildButton.disabled = state.running || state.building || state.ladderBuilt || count < 2;
  dom.goButton.hidden = !state.gameActive || !state.ladderBuilt || state.running || state.building;
  dom.goButton.disabled = !state.gameActive || !state.ladderBuilt || state.running || state.building;
}

function renderAxis(width) {
  const lines = [0, 500, 1000]
    .map((value) => {
      const y = yForValue(value);
      return `
        <line class="axis-line" x1="34" y1="${y}" x2="${width - 34}" y2="${y}" />
        <text class="tick-label" x="18" y="${y + 5}">${value}</text>
      `;
    })
    .join("");
  return `<g aria-hidden="true">${lines}</g>`;
}

function renderColumns(options = {}) {
  const visibleIndexes = visibleIndexesFor(state.participants.length, options.visibleColumns, options.visibleColumnIndexes);
  const animatedIndexes = animatedIndexesFor(options.animatedColumnIndex, options.animatedColumnIndexes);
  return state.participants
    .map((participant, index) => {
      if (!visibleIndexes.has(index)) {
        return "";
      }
      const x = xForColumn(index);
      const animated = animatedIndexes.has(index);
      return `
        <line class="column-line ${animated ? "draw-in" : ""}" x1="${round(x)}" y1="${LADDER.topY}" x2="${round(x)}" y2="${LADDER.bottomY}" />
        <circle class="node-dot ${animated ? "pop-in" : ""}" cx="${round(x)}" cy="${LADDER.topY}" r="8" fill="#39d4ff" />
        <circle class="node-dot ${animated ? "pop-in" : ""}" cx="${round(x)}" cy="${LADDER.bottomY}" r="8" fill="#55d68b" />
      `;
    })
    .join("");
}

function renderRungs(options = {}) {
  const visibleIndexes = visibleIndexesFor(state.rungs.length, options.visibleRungs, options.visibleRungIndexes);
  const animatedIndexes = animatedIndexesFor(options.animatedRungIndex, options.animatedRungIndexes);
  return state.rungs
    .map((rung, index) => {
      if (!visibleIndexes.has(index)) {
        return "";
      }
      const x1 = xForColumn(rung.left);
      const x2 = xForColumn(rung.right);
      const y = yForValue(rung.value);
      const labelX = (x1 + x2) / 2;
      const animated = animatedIndexes.has(index);
      const label = shortLabel(rung.owner, 8);
      const labelWidth = labelWidthForText(label);
      return `
        <line class="rung-line ${animated ? "draw-in" : ""}" x1="${round(x1)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y)}" />
        <rect class="rung-pill ${animated ? "pop-in" : ""}" x="${round(labelX - labelWidth / 2)}" y="${round(y - 15)}" width="${labelWidth}" height="24" rx="12" />
        <text class="rung-label ${animated ? "pop-in" : ""}" x="${round(labelX)}" y="${round(y + 5)}" text-anchor="middle">${escapeHtml(label)}</text>
      `;
    })
    .join("");
}

function renderRoutePath(route) {
  return `<path id="routePath" class="route-line" d="${route.path}" />`;
}

function renderLabels(winnerIndex, options = {}) {
  const visibleLabels = options.visibleLabels ?? state.participants.length;
  const visibleIndexes = visibleIndexesFor(state.participants.length, visibleLabels, options.visibleLabelIndexes);
  const animatedIndexes = animatedIndexesFor(options.animatedLabelIndex, options.animatedLabelIndexes);
  dom.topLabels.innerHTML = state.participants
    .map((_, index) => {
      if (!visibleIndexes.has(index)) {
        return "";
      }
      const x = xForColumn(index);
      const animated = animatedIndexes.has(index);
      const y = yPxForValue(LADDER.topY);
      return `
        <div class="person-label top ${animated ? "label-in" : ""} ${winnerIndex === index ? "winner" : ""}" style="left:${round(x)}px; top:${round(y)}px">
          <span>${index + 1}</span>
        </div>
      `;
    })
    .join("");

  dom.bottomLabels.innerHTML = state.participants
    .slice(0, state.ladderBuilt || winnerIndex >= 0 ? state.participants.length : 0)
    .map((participant, index) => {
      const x = xForColumn(index);
      return `
        <div class="person-label bottom ${winnerIndex === index ? "winner" : ""}" style="left:${round(x)}px">
          <span>${escapeHtml(participant.name)}</span>
          <small>${index + 1}번 도착</small>
        </div>
      `;
    })
    .join("");
}

function visibleIndexesFor(total, visibleCount = total, visibleIndexes = null) {
  if (Array.isArray(visibleIndexes)) {
    return new Set(visibleIndexes);
  }
  const count = clampNumber(visibleCount, 0, total);
  return new Set(Array.from({ length: count }, (_, index) => index));
}

function animatedIndexesFor(animatedIndex = -1, animatedIndexes = null) {
  if (Array.isArray(animatedIndexes)) {
    return new Set(animatedIndexes);
  }
  return animatedIndex >= 0 ? new Set([animatedIndex]) : new Set();
}

function createBuildBatches(columnCount, rungCount) {
  const columnBatches = createRandomBatches(columnCount, Math.min(4, Math.max(1, Math.ceil(columnCount / 3))));
  const rungStepBudget = Math.max(1, 10 - columnBatches.length);
  const rungBatches = createRandomBatches(rungCount, Math.min(6, rungStepBudget));
  const steps = [
    ...columnBatches.map((columns) => ({ columns, rungs: [] })),
    ...rungBatches.map((rungs) => ({ columns: [], rungs })),
  ];
  const duration = Math.min(560, Math.floor((LADDER.buildMaxMs - 600) / Math.max(1, steps.length)));
  return steps.map((step) => ({ ...step, duration }));
}

function createRandomBatches(count, maxSteps) {
  const remaining = shuffledIndexes(count);
  const batches = [];
  const stepLimit = Math.max(1, maxSteps);

  while (remaining.length > 0 && batches.length < stepLimit) {
    const stepsLeft = stepLimit - batches.length;
    const minBatch = Math.ceil(remaining.length / stepsLeft);
    const maxBatch = Math.min(remaining.length, Math.max(minBatch, minBatch + 3));
    const batchSize = randomInt(minBatch, maxBatch);
    batches.push(remaining.splice(0, batchSize));
  }

  if (remaining.length > 0) {
    batches[batches.length - 1].push(...remaining);
  }

  return batches;
}

function shuffledIndexes(count) {
  const indexes = Array.from({ length: count }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes;
}

function buildBatchMessage(batch) {
  const parts = [];
  if (batch.columns.length > 0) {
    parts.push(`Column ${batch.columns.length}개`);
  }
  if (batch.rungs.length > 0) {
    parts.push(`연결 Row ${batch.rungs.length}개`);
  }
  return `${parts.join(", ")}를 동시에 생성 중입니다.`;
}

async function buildLadderWithAnimation() {
  if (state.running || state.building || state.participants.length < 2) {
    return;
  }

  state.token += 1;
  const token = state.token;
  state.building = true;
  state.ladderBuilt = false;
  state.gameActive = true;
  state.route = null;
  state.heartPoint = null;
  setBoardZoom(1);
  dom.winnerPanel.hidden = true;
  dom.heart.hidden = true;
  dom.heart.classList.remove("running");
  dom.startColumn.textContent = "--";
  dom.finishColumn.textContent = "--";
  dom.fileInput.disabled = true;
  dom.sampleButton.disabled = true;
  updateStatsAndControls();

  const visibleColumnIndexes = new Set();
  const visibleLabelIndexes = new Set();
  const visibleRungIndexes = new Set();
  const batches = createBuildBatches(state.participants.length, state.rungs.length);

  dom.stageTitle.textContent = "사다리 빠른 생성 중";
  for (const batch of batches) {
    if (token !== state.token) {
      return;
    }

    batch.columns.forEach((index) => {
      visibleColumnIndexes.add(index);
      visibleLabelIndexes.add(index);
    });
    batch.rungs.forEach((index) => visibleRungIndexes.add(index));

    renderLadder(null, {
      visibleColumnIndexes: [...visibleColumnIndexes],
      visibleLabelIndexes: [...visibleLabelIndexes],
      visibleRungIndexes: [...visibleRungIndexes],
      animatedColumnIndexes: batch.columns,
      animatedLabelIndexes: batch.columns,
      animatedRungIndexes: batch.rungs,
    });
    setMessage(buildBatchMessage(batch));
    await wait(batch.duration);
  }

  state.ladderBuilt = true;
  state.building = false;
  dom.fileInput.disabled = false;
  dom.sampleButton.disabled = false;
  renderLadder();
  dom.stageTitle.textContent = "사다리 생성 완료";
  setMessage("사다리가 완성됐습니다. GO를 누르면 하트가 출발합니다.");
}

async function startRun() {
  if (state.running || state.building || !state.ladderBuilt || state.participants.length < 2) {
    return;
  }

  state.running = true;
  state.gameActive = true;
  state.token += 1;
  cancelCameraFollow();
  cancelRouteTrace();
  const token = state.token;
  dom.goButton.disabled = true;
  updateStatsAndControls();
  dom.winnerPanel.hidden = true;
  clearError();

  const startIndex = randomInt(0, state.participants.length - 1);
  const route = calculateRoute(startIndex);
  state.route = route;
  state.heartPoint = route.points[0];
  dom.startColumn.textContent = `${startIndex + 1}`;
  dom.finishColumn.textContent = "--";
  dom.stageTitle.textContent = `${startIndex + 1}번 Column에서 하트 출발`;
  setMessage(`${startIndex + 1}번 Column이 뽑혔습니다. 하트가 사다리를 내려갑니다.`);

  renderLadder(route);
  setBoardZoom(1);
  dom.heart.hidden = false;
  await moveHeart(route.points[0], 0, { follow: true });
  await zoomToHeart(route.points[0], token);
  if (token !== state.token) {
    return;
  }
  await animateRoute(route, token);

  if (token !== state.token) {
    return;
  }

  revealWinner(route);
}

function calculateRoute(startIndex) {
  let current = startIndex;
  const points = [{ x: xForColumn(current), y: LADDER.topY }];
  const orderedRungs = [...state.rungs].sort((a, b) => a.value - b.value || a.left - b.left);

  orderedRungs.forEach((rung) => {
    if (rung.left !== current && rung.right !== current) {
      return;
    }

    const y = yForValue(rung.value);
    const currentX = xForColumn(current);
    if (last(points).y !== y || last(points).x !== currentX) {
      points.push({ x: currentX, y });
    }

    current = rung.left === current ? rung.right : rung.left;
    points.push({ x: xForColumn(current), y });
  });

  points.push({ x: xForColumn(current), y: LADDER.bottomY });

  return {
    startIndex,
    winnerIndex: current,
    winner: state.participants[current],
    points,
    path: pointsToPath(points),
  };
}

async function animateRoute(route, token) {
  const path = dom.ladderSvg.querySelector("#routePath");
  const timings = routeSegmentTimings(route);
  const totalDuration = timings.reduce((sum, timing) => sum + timing.duration, 0);
  const length = path?.getTotalLength ? Math.ceil(path.getTotalLength()) : 1;
  if (path) {
    path.style.setProperty("--route-length", `${length}`);
    path.style.setProperty("--route-duration", `${totalDuration}ms`);
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.classList.remove("running");
  }

  dom.heart.hidden = false;
  dom.heart.classList.add("running");
  await moveHeart(route.points[0], 0, { follow: true });
  animateRouteTrace(path, timings);

  for (const timing of timings) {
    if (token !== state.token) {
      return;
    }
    await moveHeart(timing.to, timing.duration, { follow: true });
  }
}

function routeSegmentTimings(route) {
  return route.points.slice(1).map((to, index) => {
    const from = route.points[index];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    return {
      from,
      to,
      distance,
      duration: Math.max(LADDER.minHeartSegmentMs, Math.round(distance * LADDER.heartMsPerUnit)),
    };
  });
}

async function moveHeart(point, duration, options = {}) {
  const fromPoint = state.heartPoint || point;
  state.heartPoint = point;
  const yPx = point.y * (dom.ladderContent.clientHeight / 1000);
  dom.heart.style.transitionDuration = `${duration}ms`;
  dom.heart.style.left = `${point.x}px`;
  dom.heart.style.top = `${yPx}px`;

  if (!options.follow) {
    await wait(Math.max(20, duration));
    return;
  }

  if (duration <= 0) {
    followHeart(point);
    await wait(20);
    return;
  }

  await animateCameraBetween(fromPoint, point, duration);
}

function prepareRoutePath() {
  const path = dom.ladderSvg.querySelector("#routePath");
  if (!path || !path.getTotalLength) {
    return;
  }
  const length = Math.ceil(path.getTotalLength());
  path.style.setProperty("--route-length", `${length}`);
}

function positionHeartAtStart(options = {}) {
  if (!state.route || dom.heart.hidden) {
    return;
  }
  const point = state.heartPoint || last(state.route.points);
  dom.heart.style.transitionDuration = "0ms";
  dom.heart.style.left = `${point.x}px`;
  dom.heart.style.top = `${point.y * (dom.ladderContent.clientHeight / 1000)}px`;
  if (options.follow) {
    followHeart(point, "smooth");
  }
}

async function zoomToHeart(point, token) {
  await wait(80);
  if (token !== state.token) {
    return;
  }
  setBoardZoom(LADDER.runZoom);
  await holdCameraOnPoint(point, LADDER.zoomSettleMs);
  if (token !== state.token) {
    return;
  }
}

function followHeart(point, behavior = "auto") {
  centerCameraAtPoint(point, behavior);
}

function centerCameraAtPoint(point, behavior = "auto") {
  const scale = currentBoardScale();
  const contentHeight = dom.ladderContent.clientHeight || LADDER.boardHeight;
  const x = point.x * scale;
  const y = point.y * (contentHeight / 1000) * scale;
  const maxLeft = Math.max(0, dom.ladderViewport.scrollWidth - dom.ladderViewport.clientWidth);
  const maxTop = Math.max(0, dom.ladderViewport.scrollHeight - dom.ladderViewport.clientHeight);
  const left = clampNumber(Math.round(x - dom.ladderViewport.clientWidth * LADDER.cameraFocusX), 0, maxLeft);
  const top = clampNumber(Math.round(y - dom.ladderViewport.clientHeight * LADDER.cameraFocusY), 0, maxTop);
  dom.ladderViewport.scrollTo({ left, top, behavior });
}

function animateCameraBetween(fromPoint, toPoint, duration) {
  cancelCameraFollow();
  return new Promise((resolve) => {
    state.cameraResolve = resolve;
    const start = performance.now();

    const step = (now) => {
      const progress = clampNumber((now - start) / duration, 0, 1);
      centerCameraAtPoint(interpolatePoint(fromPoint, toPoint, progress));

      if (progress < 1) {
        state.cameraFrame = window.requestAnimationFrame(step);
        return;
      }

      state.cameraFrame = 0;
      state.cameraResolve = null;
      resolve();
    };

    state.cameraFrame = window.requestAnimationFrame(step);
  });
}

function holdCameraOnPoint(point, duration) {
  cancelCameraFollow();
  return new Promise((resolve) => {
    state.cameraResolve = resolve;
    const start = performance.now();

    const step = (now) => {
      centerCameraAtPoint(point);

      if (now - start < duration) {
        state.cameraFrame = window.requestAnimationFrame(step);
        return;
      }

      state.cameraFrame = 0;
      state.cameraResolve = null;
      resolve();
    };

    centerCameraAtPoint(point);
    state.cameraFrame = window.requestAnimationFrame(step);
  });
}

function animateRouteTrace(path, timings) {
  cancelRouteTrace();
  if (!path || !path.getTotalLength || timings.length === 0) {
    return Promise.resolve();
  }

  const pathLength = Math.ceil(path.getTotalLength());
  const routeDistance = timings.reduce((sum, timing) => sum + timing.distance, 0);
  const totalDuration = timings.reduce((sum, timing) => sum + timing.duration, 0);

  path.style.strokeDasharray = `${pathLength}`;
  path.style.strokeDashoffset = `${pathLength}`;

  return new Promise((resolve) => {
    state.routeResolve = resolve;
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const visibleDistance = routeVisibleDistance(timings, elapsed);
      const visibleRatio = routeDistance > 0 ? visibleDistance / routeDistance : 1;
      path.style.strokeDashoffset = `${Math.max(0, pathLength * (1 - visibleRatio))}`;

      if (elapsed < totalDuration) {
        state.routeFrame = window.requestAnimationFrame(step);
        return;
      }

      path.style.strokeDashoffset = "0";
      state.routeFrame = 0;
      state.routeResolve = null;
      resolve();
    };

    state.routeFrame = window.requestAnimationFrame(step);
  });
}

function routeVisibleDistance(timings, elapsed) {
  let remaining = elapsed;
  let visibleDistance = 0;

  for (const timing of timings) {
    if (remaining >= timing.duration) {
      visibleDistance += timing.distance;
      remaining -= timing.duration;
      continue;
    }

    const progress = clampNumber(remaining / timing.duration, 0, 1);
    return visibleDistance + timing.distance * progress;
  }

  return timings.reduce((sum, timing) => sum + timing.distance, 0);
}

function cancelCameraFollow() {
  if (state.cameraFrame) {
    window.cancelAnimationFrame(state.cameraFrame);
    state.cameraFrame = 0;
  }
  if (state.cameraResolve) {
    state.cameraResolve();
    state.cameraResolve = null;
  }
}

function cancelRouteTrace() {
  if (state.routeFrame) {
    window.cancelAnimationFrame(state.routeFrame);
    state.routeFrame = 0;
  }
  if (state.routeResolve) {
    state.routeResolve();
    state.routeResolve = null;
  }
}

function setBoardZoom(value) {
  state.boardZoom = value;
  dom.ladderBoard.style.setProperty("--board-zoom", `${value}`);
  updateBoardScale();
}

function currentBoardZoom() {
  return state.boardZoom || 1;
}

function currentBoardScale() {
  return currentBoardZoom();
}

function updateBoardScale() {
  const scale = currentBoardScale();
  dom.ladderBoard.style.setProperty("--board-scale", `${scale}`);
  dom.ladderBoard.style.setProperty("--board-display-width", `${Math.ceil(state.boardWidth * scale)}px`);
  dom.ladderBoard.style.setProperty("--board-display-height", `${Math.ceil(state.boardHeight * scale)}px`);
}

function handleResize() {
  if (state.participants.length === 0) {
    updateBoardSize();
    dom.ladderSvg.innerHTML = renderAxis(state.boardWidth);
  } else if (state.ladderBuilt || state.route) {
    renderLadder(state.route);
  } else {
    renderPreparedLadder();
  }
  positionHeartAtStart();
}

function syncStageState() {
  document.body.classList.toggle("panel-collapsed", state.gameActive);
}

function revealWinner(route) {
  state.running = false;
  state.gameActive = false;
  cancelCameraFollow();
  cancelRouteTrace();
  setBoardZoom(1);
  renderLadder(route);
  positionHeartAtStart({ follow: true });
  dom.finishColumn.textContent = `${route.winnerIndex + 1}`;
  dom.winnerName.textContent = route.winner.name;
  dom.winnerDetail.textContent = `${route.startIndex + 1}번 Column에서 출발해 ${route.winnerIndex + 1}번 Column에 도착했습니다.`;
  dom.winnerPanel.hidden = false;
  dom.stageTitle.textContent = "우승자 공개";
  setMessage(`${route.winner.name}님이 최종 Column의 우승자입니다.`);
}

function resetGame() {
  state.running = false;
  state.token += 1;
  cancelCameraFollow();
  cancelRouteTrace();
  state.route = null;
  state.heartPoint = null;
  state.ladderBuilt = false;
  state.building = false;
  state.gameActive = false;
  setBoardZoom(1);
  dom.fileInput.value = "";
  dom.fileInput.disabled = false;
  dom.sampleButton.disabled = false;
  dom.fileName.textContent = "엑셀 파일 업로드";
  clearError();
  renderEmpty();
  setMessage("엑셀을 올리면 제출 순서대로 사다리가 생성됩니다.");
}

async function parseInputFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    return parseCsv(await file.text());
  }
  if (lowerName.endsWith(".xls")) {
    throw new Error("구형 .xls 파일은 지원하지 않습니다. .xlsx 형식으로 저장한 뒤 업로드해주세요.");
  }
  if (!lowerName.endsWith(".xlsx")) {
    throw new Error(".xlsx 또는 .csv 파일을 업로드해주세요.");
  }
  return parseXlsx(await file.arrayBuffer());
}

async function parseXlsx(arrayBuffer) {
  const entries = await unzipXlsx(arrayBuffer);
  const workbookXml = getZipText(entries, "xl/workbook.xml");
  const workbookRelsXml = getZipText(entries, "xl/_rels/workbook.xml.rels");
  const workbook = parseXml(workbookXml);
  const workbookRels = parseXml(workbookRelsXml);
  const relationshipMap = buildRelationshipMap(workbookRels);
  const sheetElements = elementsByLocalName(workbook, "sheet");

  if (sheetElements.length === 0) {
    throw new Error("엑셀 파일에서 시트를 찾지 못했습니다.");
  }

  const firstSheet = sheetElements[0];
  const relationId =
    firstSheet.getAttribute("r:id") ||
    firstSheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const sheetTarget = relationshipMap.get(relationId);

  if (!sheetTarget) {
    throw new Error("첫 번째 시트의 경로를 찾지 못했습니다.");
  }

  const sheetPath = resolveXmlTarget("xl/workbook.xml", sheetTarget);
  const sheetXml = getZipText(entries, sheetPath);
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(parseXml(getZipText(entries, "xl/sharedStrings.xml")))
    : [];

  return sheetToRows(parseXml(sheetXml), sharedStrings);
}

async function unzipXlsx(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);

  if (eocdOffset < 0) {
    throw new Error("정상적인 .xlsx ZIP 구조가 아닙니다.");
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const fileMap = new Map();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("엑셀 ZIP 중앙 디렉터리를 읽지 못했습니다.");
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decodeUtf8(bytes.slice(offset + 46, offset + 46 + fileNameLength)).replace(/\\/g, "/");

    if (compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new Error("Zip64 형식의 큰 엑셀 파일은 지원하지 않습니다.");
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedBytes = bytes.slice(dataStart, dataStart + compressedSize);
    const content = await decompressZipEntry(compressedBytes, compressionMethod);
    fileMap.set(normalizeZipPath(fileName), content);

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return fileMap;
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 22 - 65535);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

async function decompressZipEntry(bytes, method) {
  if (method === 0) {
    return bytes;
  }
  if (method !== 8) {
    throw new Error(`지원하지 않는 압축 방식입니다. method=${method}`);
  }
  if (!("DecompressionStream" in window)) {
    throw new Error("현재 브라우저가 .xlsx 압축 해제를 지원하지 않습니다. 최신 Chrome 또는 Edge에서 열어주세요.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function getZipText(entries, filePath) {
  const content = entries.get(normalizeZipPath(filePath));
  if (!content) {
    throw new Error(`엑셀 내부 파일을 찾지 못했습니다: ${filePath}`);
  }
  return decodeUtf8(content);
}

function parseXml(text) {
  const documentNode = new DOMParser().parseFromString(text, "application/xml");
  const parserError = documentNode.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("엑셀 XML을 해석하지 못했습니다.");
  }
  return documentNode;
}

function buildRelationshipMap(relsDocument) {
  const map = new Map();
  elementsByLocalName(relsDocument, "Relationship").forEach((relationship) => {
    map.set(relationship.getAttribute("Id"), relationship.getAttribute("Target"));
  });
  return map;
}

function resolveXmlTarget(baseFile, target) {
  if (target.startsWith("/")) {
    return normalizeZipPath(target.slice(1));
  }
  const baseParts = baseFile.split("/");
  baseParts.pop();
  return normalizeZipPath(`${baseParts.join("/")}/${target}`);
}

function normalizeZipPath(filePath) {
  const parts = [];
  filePath.replace(/\\/g, "/").split("/").forEach((part) => {
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join("/");
}

function parseSharedStrings(documentNode) {
  return elementsByLocalName(documentNode, "si").map((item) =>
    elementsByLocalName(item, "t")
      .map((textNode) => textNode.textContent || "")
      .join("")
  );
}

function sheetToRows(documentNode, sharedStrings) {
  const rows = [];
  elementsByLocalName(documentNode, "row").forEach((rowNode) => {
    const cells = [];
    directChildrenByLocalName(rowNode, "c").forEach((cellNode) => {
      const reference = cellNode.getAttribute("r") || "";
      const columnIndex = columnIndexFromCellReference(reference);
      if (columnIndex >= 0) {
        cells[columnIndex] = cellValue(cellNode, sharedStrings);
      }
    });
    rows.push(cells);
  });
  return rows;
}

function cellValue(cellNode, sharedStrings) {
  const type = cellNode.getAttribute("t");
  const valueNode = firstElementByLocalName(cellNode, "v");
  const rawValue = valueNode ? valueNode.textContent || "" : "";

  if (type === "s") {
    return sharedStrings[Number(rawValue)] ?? "";
  }
  if (type === "inlineStr") {
    return elementsByLocalName(cellNode, "t")
      .map((textNode) => textNode.textContent || "")
      .join("");
  }
  if (type === "str") {
    return rawValue;
  }
  if (rawValue === "") {
    return "";
  }

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : rawValue;
}

function columnIndexFromCellReference(reference) {
  const match = reference.match(/[A-Z]+/i);
  if (!match) {
    return -1;
  }
  return match[0]
    .toUpperCase()
    .split("")
    .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function elementsByLocalName(root, localName) {
  return Array.from(root.getElementsByTagName("*")).filter((node) => node.localName === localName);
}

function firstElementByLocalName(root, localName) {
  return elementsByLocalName(root, localName)[0] || null;
}

function directChildrenByLocalName(root, localName) {
  return Array.from(root.children || []).filter((node) => node.localName === localName);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }
    value += char;
  }

  row.push(value);
  if (row.some((cell) => String(cell).trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

function parseLadderNumbersForRow(row, columnIndexes) {
  const numbers = [];

  for (const columnIndex of columnIndexes) {
    const parsed = parseLadderNumbers(row[columnIndex]);
    if (parsed === null) {
      return null;
    }
    numbers.push(...parsed);
  }

  const uniqueNumbers = uniqueValues(numbers);
  return uniqueNumbers.length <= MAX_NUMBERS_PER_PARTICIPANT ? uniqueNumbers : null;
}

function parseLadderNumbers(value) {
  if (typeof value === "number") {
    const number = parseLadderNumber(value);
    return number === null ? null : [number];
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return [];
  }

  const parts = text.split(/[,\s;/|]+/).filter(Boolean);
  const numbers = [];

  for (const part of parts) {
    const number = parseLadderNumber(part);
    if (number === null) {
      return null;
    }
    numbers.push(number);
  }

  return numbers;
}

function parseLadderNumber(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= LADDER.minValue && value <= LADDER.maxValue ? value : null;
  }

  const text = String(value ?? "").trim().replace(/,/g, "");
  if (!/^\d+$/.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isSafeInteger(number) && number >= LADDER.minValue && number <= LADDER.maxValue ? number : null;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function findHeaderIndex(normalizedHeaders, candidates) {
  const normalizedCandidates = candidates.map((candidate) => normalizeHeader(candidate));
  return normalizedHeaders.findIndex((header) => normalizedCandidates.includes(header));
}

function findNumberHeaderIndexes(normalizedHeaders) {
  return NUMBER_HEADER_GROUPS.map((candidates) => findHeaderIndex(normalizedHeaders, candidates))
    .filter((index, currentIndex, indexes) => index >= 0 && indexes.indexOf(index) === currentIndex)
    .slice(0, MAX_NUMBERS_PER_PARTICIPANT);
}

function xForColumn(index) {
  if (state.participants.length <= 1) {
    return state.boardWidth / 2;
  }
  const usableWidth = state.boardWidth - LADDER.marginX * 2;
  return LADDER.marginX + (usableWidth * index) / (state.participants.length - 1);
}

function yForValue(value) {
  const ratio = clampNumber((value - LADDER.axisMin) / (LADDER.axisMax - LADDER.axisMin), 0, 1);
  return LADDER.topY + (LADDER.bottomY - LADDER.topY) * ratio;
}

function yPxForValue(value) {
  return (value / (LADDER.axisMax - LADDER.axisMin)) * state.boardHeight;
}

function pointsToPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`)
    .join(" ");
}

function interpolatePoint(fromPoint, toPoint, progress) {
  return {
    x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
    y: fromPoint.y + (toPoint.y - fromPoint.y) * progress,
  };
}

function last(values) {
  return values[values.length - 1];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleLadderNumber(rowIndex, numberIndex) {
  return ((rowIndex * 73 + numberIndex * 211 + 111) % 999) + 1;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function shortLabel(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function labelWidthForText(value) {
  const textLength = String(value ?? "").length;
  return clampNumber(44 + textLength * 11, 64, 128);
}

function setMessage(text) {
  dom.message.textContent = text;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setError(message) {
  dom.errorBox.hidden = false;
  dom.errorBox.textContent = message;
}

function clearError() {
  dom.errorBox.hidden = true;
  dom.errorBox.textContent = "";
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
