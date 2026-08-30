// game-logic.js
let gridSize = 8;
let grid = [];
let planes = [];
let moves = 0;
let hits = 0;
let startTime;
let timer;
let soundOn = true;
let isDarkMode = false;
let lang = 'en';
let secondsElapsed = 0;
let timerRunning = false;

let gameMode = 'radar';
let battlePhase = 'placement';
let battlePlayerGrid = [];
let battleEnemyGrid = [];
let playerPlanes = [];
let enemyPlanes = [];
let battleShotsLeft = battleVolleySize();
let playerBattleHits = 0;
let enemyBattleHits = 0;
let battleFinishedWinner = null; // 'player' or 'enemy'
let botBusy = false;
let botRadarObservations = [];
let botSmartChance = 0.78;
let playerVolleyHits = 0;
let botVolleyHits = 0;
let battleVolleyNotice = '';
let battleVolleyTimer = null;

const radarLaserSound = document.getElementById('sound-radar-laser');
const radarRevealedSound = document.getElementById('sound-radar-revealed');
const battleHitSound = document.getElementById('sound-battle-hit');
const battleExplodeSound = document.getElementById('sound-battle-explode');
const battlePlaceSound = document.getElementById('sound-battle-place');
const hintEl = document.getElementById('hint');

const PREFS_KEY = 'planeRadarPrefs_v1';
const DEFAULT_DIFFICULTY = '8';

function detectInitialLanguage() {
  const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'en'];

  return browserLanguages.some(code => String(code).toLowerCase().startsWith('mn'))
    ? 'mn'
    : 'en';
}

function savePreferences() {
  try {
    const difficultyEl = document.getElementById('difficulty');
    const modeEl = document.getElementById('modeSelect');

    const prefs = {
      soundOn,
      isDarkMode,
      lang,
      difficulty: difficultyEl ? difficultyEl.value : String(gridSize),
      gameMode: modeEl ? modeEl.value : gameMode
    };

    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {
    // If storage is unavailable, the game still works normally.
  }
}

function loadPreferences() {
  try {
    const storedPreferences = localStorage.getItem(PREFS_KEY);
    const saved = JSON.parse(storedPreferences || '{}');

    if (typeof saved.soundOn === 'boolean') soundOn = saved.soundOn;
    if (typeof saved.isDarkMode === 'boolean') isDarkMode = saved.isDarkMode;
    lang = saved.lang === 'en' || saved.lang === 'mn'
      ? saved.lang
      : detectInitialLanguage();

    const difficultyEl = document.getElementById('difficulty');
    if (difficultyEl) {
      difficultyEl.value = ['5', '8', '10'].includes(String(saved.difficulty))
        ? String(saved.difficulty)
        : DEFAULT_DIFFICULTY;
    }

    const modeEl = document.getElementById('modeSelect');
    if (modeEl && (saved.gameMode === 'radar' || saved.gameMode === 'battle')) {
      modeEl.value = saved.gameMode;
    }
  } catch (_) {
    // Ignore malformed/blocked storage and use normal defaults.
  }

  document.body.classList.toggle('dark-theme', isDarkMode);
  document.body.classList.toggle('light-theme', !isDarkMode);
}

const texts = {
  en: {
    title: 'Plane Radar Game',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    restart: 'Restart',
    mute: 'Mute',
    unmute: 'Unmute',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    moves: 'Moves',
    hits: 'Hits',
    time: 'Time',
    hintPrefix: 'You are',
    hintMiddle: 'km from Plane',
    victory: "🎉 You win! Enter your name:",
    hofTitle: "🏆 Hall of Fame",
    name: "Name",
    date: "Date",
    noRecords: "No records yet",
    radarMode: "Radar",
    battleMode: "Battle",
    yourGrid: "Your Grid",
    enemyGrid: "Enemy Grid",
    placePlanes: "Place your planes",
    planesPlaced: "Planes placed",
    startBattle: "Start Battle",
    yourTurn: "Your turn",
    enemyTurn: "Enemy turn",
    shotsLeft: "Shots left",
    battleWin: "🎉 You destroyed all enemy planes!",
    battleLose: "💥 The enemy found all your planes!",
    battleHintPrefix: "Enemy plane",
    battleHintMiddle: "km away",
    readyBattle: "Ready to start battle",
    botTracking: "Enemy radar is tracking...",
    battleScoreYou: "You",
    battleScoreEnemy: "Enemy",
    playAgain: "Play Again",
    yourVolley: "Your volley",
    enemyVolley: "Enemy volley",
    volleyHit: "hit",
    volleyHits: "hits",
    volleyMisses: "misses",
    distanceGuide: "Distance Guide",
    distanceGuideCaption: "Straight adjacent cells = 1 km · Diagonal adjacent cells = 1.4 km",
    installApp: "Install App",
    updateReady: "A new version is ready.",
    updateNow: "Update",
    close: "Close"
  },
  mn: {
    title: 'Онгоцны Радар',
    easy: 'Хялбар',
    medium: 'Дунд',
    hard: 'Хэцүү',
    restart: 'Дахин эхлэх',
    mute: 'Дуу хаах',
    unmute: 'Дуу нээх',
    darkMode: 'Харанхуй',
    lightMode: 'Гэрэлтэй',
    moves: 'Нүүдэл',
    hits: 'Оносон',
    time: 'Цаг',
    hintPrefix: 'Та',
    hintMiddle: 'км зайтай байна — Онгоц',
    victory: "🎉 Та яллаа! Нэрээ оруулна уу:",
    hofTitle: "🏆 Алдрын самбар",
    name: "Нэр",
    date: "Огноо",
    noRecords: "Одоогоор амжилт алга",
    radarMode: "Радар",
    battleMode: "Тулаан",
    yourGrid: "Таны талбай",
    enemyGrid: "Дайсны талбай",
    placePlanes: "Онгоцуудаа байрлуулна уу",
    planesPlaced: "Байрлуулсан",
    startBattle: "Тулаан эхлүүлэх",
    yourTurn: "Таны ээлж",
    enemyTurn: "Дайсны ээлж",
    shotsLeft: "Үлдсэн буудалт",
    battleWin: "🎉 Та дайсны бүх онгоцыг устгалаа!",
    battleLose: "💥 Дайсан таны бүх онгоцыг оллоо!",
    battleHintPrefix: "Дайсны онгоц",
    battleHintMiddle: "км зайтай",
    readyBattle: "Тулаан эхлүүлэхэд бэлэн",
    botTracking: "Дайсны радар мөрдөж байна...",
    battleScoreYou: "Та",
    battleScoreEnemy: "Дайсан",
    playAgain: "Дахин тоглох",
    yourVolley: "Таны буудалт",
    enemyVolley: "Дайсны буудалт",
    volleyHit: "онолт",
    volleyHits: "онолт",
    volleyMisses: "алдаа",
    distanceGuide: "Зай хэмжих",
    distanceGuideCaption: "Шулуун зэргэлдээ нүд = 1 км · Диагональ зэргэлдээ нүд = 1.4 км",
    installApp: "Апп суулгах",
    updateReady: "Шинэ хувилбар бэлэн боллоо.",
    updateNow: "Шинэчлэх",
    close: "Хаах"
  }
};

function initializeGame() {
  loadPreferences();
  secondsElapsed = 0;
  document.getElementById("status").textContent = getStatus();
  gridSize = parseInt(document.getElementById("difficulty").value);
  gameMode = document.getElementById("modeSelect").value;
  updateLanguageUI();
  restartGame();
}

function createGrid() {
  const gridDiv = document.getElementById("grid");
  gridDiv.innerHTML = "";
  const table = document.createElement("table");
  table.classList.add("game-table");
  grid = [];

  const headerRow = document.createElement("tr");
  const emptyCell = document.createElement("td");
  emptyCell.classList.add("label", "header-cell");
  headerRow.appendChild(emptyCell);
  for (let x = 0; x < gridSize; x++) {
    const label = document.createElement("td");
    label.textContent = x + 1;
    label.classList.add("label", "header-cell", "grid-number");
    headerRow.appendChild(label);
  }
  table.appendChild(headerRow);

  for (let y = 0; y < gridSize; y++) {
    const row = [];
    const tr = document.createElement("tr");

    const rowLabel = document.createElement("td");
    rowLabel.textContent = y + 1;
    rowLabel.classList.add("label", "header-cell", "grid-number");
    tr.appendChild(rowLabel);

    for (let x = 0; x < gridSize; x++) {
      const td = document.createElement("td");
      td.dataset.row = y;
      td.dataset.col = x;
      td.classList.add("game-cell");
      td.style.aspectRatio = "1 / 1";
      td.style.width = "32px";
      td.style.height = "32px";
      td.style.padding = "0";
      td.addEventListener("click", handleCellClick);
      td.addEventListener("mouseenter", () => showTargetLock(y, x));
      td.addEventListener("mouseleave", clearTargetLock);
      tr.appendChild(td);
      row.push(td);
    }
    table.appendChild(tr);
    grid.push(row);
  }
  gridDiv.appendChild(table);

  document.body.classList.toggle("dark-theme", isDarkMode);
  document.body.classList.toggle("light-theme", !isDarkMode);
}


function clearTargetLock() {
  grid.forEach(row => {
    row.forEach(cell => {
      cell.classList.remove('radar-line', 'radar-target');
    });
  });
}

function showTargetLock(row, col) {
  clearTargetLock();

  for (let c = 0; c < gridSize; c++) {
    grid[row][c].classList.add('radar-line');
  }

  for (let r = 0; r < gridSize; r++) {
    grid[r][col].classList.add('radar-line');
  }

  grid[row][col].classList.remove('radar-line');
  grid[row][col].classList.add('radar-target');
}

function placePlanes() {
  planes = [];
  let planeCount = 5;
  if (gridSize <= 5) planeCount = 2;
  else if (gridSize <= 8) planeCount = 3;
  while (planes.length < planeCount) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    if (!planes.some(p => p.x === x && p.y === y)) {
      planes.push({ x, y, hit: false });
    }
  }
}

function handleCellClick(e) {
  const r = parseInt(e.target.dataset.row);
  const c = parseInt(e.target.dataset.col);
  if (e.target.textContent !== '') return;
  startGameTimer();
  moves++;
  let isHit = false;
  planes.forEach((p, i) => {
    if (!p.hit && p.x === c && p.y === r) {
      e.target.textContent = '✈️';
      e.target.classList.add('highlight', 'plane-discovered');
      hits++;
      p.hit = true;
      isHit = true;
      playSound(radarRevealedSound);

      setTimeout(() => {
        e.target.classList.remove('plane-discovered');
      }, 560);
    }
  });
  if (!isHit) {
    e.target.textContent = '·';
    playSound(radarLaserSound);
  }
  updateStatus();
  updateHints(r, c);
  if (hits >= planes.length) {
    stopGameTimer();

    grid.flat().forEach(cell => {
      if (cell.textContent === '✈️') {
        cell.classList.add('victory-plane');
      }
    });

    setTimeout(() => {
      grid.flat().forEach(cell => cell.classList.remove('victory-plane'));
      const name = prompt(texts[lang].victory, "Player");
      if (name) saveToHallOfFame(name);
    }, 1350);
  }
}

function updateHints(row, col) {
  hintEl.innerHTML = '';
  planes.forEach((p, i) => {
    if (p.hit) return;
    const dx = Math.abs(p.x - col);
    const dy = Math.abs(p.y - row);
    const diag = Math.min(dx, dy);
    const straight = Math.abs(dx - dy);
    const dist = (diag * 1.4 + straight * 1).toFixed(1);
    const div = document.createElement('div');
    const t = texts[lang];
    div.textContent = lang === 'en'
      ? `🛰️  ${t.hintPrefix} ${dist} ${t.hintMiddle} #${i + 1}`
      : `🛰️  ${t.hintPrefix} ${dist} ${t.hintMiddle} #${i + 1}`;
    hintEl.appendChild(div);
  });
}

function playSound(audio) {
  if (soundOn && audio) {
    audio.currentTime = 0;
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        // Playback may be blocked until the browser receives a user gesture.
      });
    }
  }
}

// V4.5 lightweight Battle cues generated in-browser, so no new sound files are required.
let battleAudioCtx = null;
function battleTone(frequency = 520, duration = 0.08, volume = 0.035, type = 'sine', delay = 0) {
  if (!soundOn) return;
  try {
    battleAudioCtx = battleAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = battleAudioCtx;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  } catch (_) {}
}

function playBattleStartCue() {
  battleTone(440, .09, .028, 'sine', 0);
  battleTone(660, .11, .032, 'sine', .11);
}
function playPlayerTurnCue() {
  battleTone(620, .08, .025, 'sine', 0);
  battleTone(820, .10, .028, 'sine', .09);
}
function playEnemyTurnCue() {
  battleTone(360, .10, .026, 'triangle', 0);
  battleTone(300, .12, .028, 'triangle', .11);
}
function playBattleLoseCue() {
  battleTone(250, .16, .035, 'triangle', 0);
  battleTone(190, .20, .032, 'triangle', .16);
}

function updateStatus() {
  const elapsed = getElapsedSeconds();
  const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const sec = String(elapsed % 60).padStart(2, '0');
  const tEn = texts[lang];

  if (gameMode === 'battle') {
    document.getElementById('status').textContent = `${tEn.time}: ${min}:${sec}`;
  } else {
    document.getElementById('status').textContent =
      `${tEn.moves}: ${moves} | ${tEn.hits}: ${hits} | ${tEn.time}: ${min}:${sec}`;
  }
}

function updateTime() {
  updateStatus();
}

function getElapsedSeconds() {
  return timerRunning
    ? Math.floor((Date.now() - startTime) / 1000)
    : secondsElapsed;
}

function startGameTimer() {
  if (timerRunning) return;
  startTime = Date.now() - (secondsElapsed * 1000);
  timerRunning = true;
  clearInterval(timer);
  timer = setInterval(updateTime, 1000);
  updateStatus();
}

function stopGameTimer() {
  if (timerRunning) secondsElapsed = getElapsedSeconds();
  timerRunning = false;
  clearInterval(timer);
  updateStatus();
}

function getStatus() {
  const tEn = texts[lang];
  const time = new Date(secondsElapsed * 1000).toISOString().substr(14, 5);
  return `${tEn.moves}: ${moves} | ${tEn.hits}: ${hits} | ${tEn.time}: ${time}`;
}

function restartGame() {
  document.querySelector('.battle-modal-backdrop')?.remove();

  // Full Battle reset: remove every trace of the previous match.
  playerShotHistory = new Set();
  enemyShotHistory = new Set();
  botRadarObservations = [];
  playerPlanes = [];
  enemyPlanes = [];
  playerBattleHits = 0;
  enemyBattleHits = 0;
  playerShotsThisTurn = 0;
  botBusy = false;
  battlePhase = 'placement';
  gridSize = parseInt(document.getElementById('difficulty').value);
  gameMode = document.getElementById('modeSelect').value;
  savePreferences();

  clearInterval(timer);
  timerRunning = false;
  startTime = null;
  secondsElapsed = 0;
  moves = 0;
  hits = 0;

  document.getElementById('hint').innerHTML = "";

  if (gameMode === 'battle') {
    document.getElementById('hall-of-fame').style.display = 'none';
    startBattleSetup();
  } else {
    document.getElementById('hall-of-fame').style.display = '';
    grid = [];
    planes = [];
    createGrid();
    placePlanes();
    renderHallOfFame();
    updateStatus();
  }

}

function toggleSound() {
  soundOn = !soundOn;
  savePreferences();
  updateLanguageUI();
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("dark-theme", isDarkMode);
  document.body.classList.toggle("light-theme", !isDarkMode);
  savePreferences();
  updateLanguageUI();

  if (gameMode === 'battle') {
    renderBattleBoards();
  } else {
    createGrid();
  }
}

function updateLanguageUI() {
  const t = texts[lang];

  document.documentElement.lang = lang;
  document.title = `✈️ ${t.title}`;
  document.getElementById("gameTitle").textContent = `✈️ ${t.title}`;
  document.getElementById("restartBtn").textContent = `🔄 ${t.restart}`;
  document.getElementById("soundBtn").textContent =
    soundOn ? `🔊 ${t.mute}` : `🔈 ${t.unmute}`;
  document.getElementById("themeBtn").textContent =
    isDarkMode ? `☀️ ${t.lightMode}` : `🌗 ${t.darkMode}`;
  document.getElementById("langBtn").textContent =
    lang === 'en' ? "🌐 MN" : "🌐 EN";

  const distanceHelpBtn = document.getElementById("distanceHelpBtn");
  const distanceHelpTitle = document.getElementById("distanceHelpTitle");
  const distanceHelpCaption = document.getElementById("distanceHelpCaption");
  if (distanceHelpBtn) distanceHelpBtn.textContent = `❓ ${t.distanceGuide}`;
  if (distanceHelpTitle) distanceHelpTitle.textContent = `📡 ${t.distanceGuide}`;
  if (distanceHelpCaption) distanceHelpCaption.textContent = t.distanceGuideCaption;

  const installBtn = document.getElementById("installBtn");
  const updateMessage = document.getElementById("updateMessage");
  const updateNowBtn = document.getElementById("updateNowBtn");
  if (installBtn) installBtn.textContent = `📲 ${t.installApp}`;
  if (updateMessage) updateMessage.textContent = t.updateReady;
  if (updateNowBtn) updateNowBtn.textContent = t.updateNow;

  const difficulty = document.getElementById("difficulty");
  difficulty.options[0].textContent = t.easy;
  difficulty.options[1].textContent = t.medium;
  difficulty.options[2].textContent = t.hard;

  const modeSelect = document.getElementById("modeSelect");
  modeSelect.options[0].textContent = `🎯 ${t.radarMode}`;
  modeSelect.options[1].textContent = `⚔️ ${t.battleMode}`;

  const radarModeBtn = document.getElementById("radarModeBtn");
  const battleModeBtn = document.getElementById("battleModeBtn");
  if (radarModeBtn && battleModeBtn) {
    radarModeBtn.textContent = `🎯 ${t.radarMode}`;
    battleModeBtn.textContent = `⚔️ ${t.battleMode}`;
    radarModeBtn.classList.toggle("active", gameMode === "radar");
    battleModeBtn.classList.toggle("active", gameMode === "battle");
  }

  updateStatus();

  if (gameMode === 'battle') {
    renderBattleBoards();
  }
}

function toggleLang() {
  lang = lang === 'en' ? 'mn' : 'en';
  savePreferences();
  updateLanguageUI();
  renderHallOfFame();
}



function showBattleResult(playerWon) {
  const t = texts[lang];

  // Remove an older result popup if one somehow exists.
  document.querySelector('.battle-modal-backdrop')?.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'battle-modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'battle-result-modal';

  const closeButton = document.createElement('button');
  closeButton.className = 'battle-result-close';
  closeButton.type = 'button';
  closeButton.textContent = '✕';
  closeButton.setAttribute('aria-label', t.close);
  closeButton.title = t.close;
  closeButton.addEventListener('click', () => backdrop.remove());

  const title = document.createElement('div');
  title.className = 'battle-result-title';
  title.textContent = playerWon ? t.battleWin : t.battleLose;

  const score = document.createElement('div');
  score.className = 'battle-result-score';
  score.textContent =
    `${t.battleScoreYou}: ${playerBattleHits}/${enemyPlanes.length} · ` +
    `${t.battleScoreEnemy}: ${enemyBattleHits}/${playerPlanes.length}`;

  const button = document.createElement('button');
  button.textContent = `🔄 ${t.playAgain}`;
  button.addEventListener('click', () => {
    backdrop.remove();
    restartGame();
  });

  modal.appendChild(closeButton);
  modal.appendChild(title);
  modal.appendChild(score);
  modal.appendChild(button);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function battlePlaneCount() {
  if (gridSize <= 5) return 2;
  if (gridSize <= 8) return 3;
  return 5;
}

function battleVolleySize() {
  if (gridSize <= 5) return 3;
  if (gridSize <= 8) return 4;
  return 6;
}

function makeBattlePlanes(count) {
  const arr = [];
  while (arr.length < count) {
    const x = Math.floor(Math.random() * gridSize);
    const y = Math.floor(Math.random() * gridSize);
    if (!arr.some(p => p.x === x && p.y === y)) {
      arr.push({ x, y, hit: false });
    }
  }
  return arr;
}

function startBattleSetup() {
  battlePhase = 'placement';
  botBusy = false;
  battleShotsLeft = battleVolleySize();
  playerBattleHits = 0;
  enemyBattleHits = 0;
  battleFinishedWinner = null;
  botRadarObservations = [];
  playerPlanes = [];
  enemyPlanes = makeBattlePlanes(battlePlaneCount());
  battlePlayerGrid = [];
  battleEnemyGrid = [];
  document.getElementById('hint').innerHTML = '';
  renderBattleBoards();
  updateStatus();
}

function createBattleTable(kind) {
  const table = document.createElement('table');
  table.className = 'game-table';

  const headerRow = document.createElement('tr');
  const corner = document.createElement('td');
  corner.className = 'header-cell';
  headerRow.appendChild(corner);

  for (let x = 0; x < gridSize; x++) {
    const th = document.createElement('td');
    th.className = 'header-cell grid-number';
    th.textContent = x + 1;
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  const board = [];

  for (let y = 0; y < gridSize; y++) {
    const tr = document.createElement('tr');
    const rowLabel = document.createElement('td');
    rowLabel.className = 'header-cell grid-number';
    rowLabel.textContent = y + 1;
    tr.appendChild(rowLabel);

    const row = [];
    for (let x = 0; x < gridSize; x++) {
      const td = document.createElement('td');
      td.className = `game-cell ${kind === 'player' ? 'battle-player-cell' : 'battle-enemy-cell'}`;

      // Force Battle Mode board colors directly on the generated cells.
      // This prevents the original Radar .game-cell theme rules from overriding them.
      td.style.setProperty(
        'background-color',
        kind === 'player' ? '#3598DB' : '#2D3E50',
        'important'
      );
      td.style.setProperty('border-color', 'rgba(255,255,255,0.90)', 'important');

      td.dataset.row = y;
      td.dataset.col = x;
      td.style.aspectRatio = '1 / 1';
      td.style.width = '32px';
      td.style.height = '32px';
      td.style.padding = '0';

      if (kind === 'player') {
        const plane = playerPlanes.find(p => p.x === x && p.y === y);
        const botShot = enemyShotHistory.has(shotKey(y, x));
        if (plane) {
          td.textContent = '✈️';
          td.classList.add('placed-plane');
          if (plane.hit) {
            td.classList.add('player-hit');
            td.style.setProperty('background-color', '#ffeb00', 'important');
            td.style.setProperty('color', '#000', 'important');
          }
        } else if (botShot) {
          td.textContent = '·';
          td.classList.add('battle-miss');
        }
        if (battlePhase === 'placement') {
          td.addEventListener('click', () => togglePlayerPlane(y, x));
        }
      } else {
        const plane = enemyPlanes.find(p => p.x === x && p.y === y);
        if (plane && plane.hit) {
          td.textContent = '✈️';
          td.classList.add('enemy-hit', 'highlight');
          td.style.setProperty('background-color', '#ffeb00', 'important');
          td.style.setProperty('color', '#000', 'important');
        }

        if (playerShotHistory.has(shotKey(y, x)) && !(plane && plane.hit)) {
          td.textContent = '·';
          td.classList.add('battle-miss');
        }

        if (battlePhase === 'player') {
          td.addEventListener('click', () => playerBattleShot(y, x, td));
          td.addEventListener('mouseenter', () => showBattleTargetLock(y, x));
          td.addEventListener('mouseleave', clearBattleTargetLock);
        }
      }

      tr.appendChild(td);
      row.push(td);
    }
    table.appendChild(tr);
    board.push(row);
  }

  if (kind === 'player') battlePlayerGrid = board;
  else battleEnemyGrid = board;

  return table;
}

let enemyShotHistory = new Set();
let playerShotHistory = new Set();

function shotKey(row, col) {
  return `${row},${col}`;
}


function renderBattleBoards() {
  if (gameMode !== 'battle') return;

  const t = texts[lang];
  const gridDiv = document.getElementById('grid');
  gridDiv.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'battle-wrap';

  const message = document.createElement('div');
  message.className = 'battle-message' + (battlePhase === 'player' || battlePhase === 'bot' ? ' turn-pop' : '');

  if (battlePhase === 'placement') {
    message.textContent = t.placePlanes;
  } else if (battlePhase === 'player') {
    message.textContent = `🎯 ${t.yourTurn.toUpperCase()} — ${t.shotsLeft}: ${battleShotsLeft}`;
  } else if (battlePhase === 'bot') {
    message.textContent = `🤖 ${t.enemyTurn.toUpperCase()} — ${t.botTracking}`;
  }

  wrap.appendChild(message);

  if (battleVolleyNotice) {
    const notice = document.createElement('div');
    notice.className = 'battle-volley-notice';
    notice.textContent = battleVolleyNotice;
    wrap.appendChild(notice);
  }

  const boardsRow = document.createElement('div');
  boardsRow.className = 'battle-boards-row';

  const playerBlock = document.createElement('div');
  playerBlock.className = 'battle-board-block battle-player-block' + (battlePhase === 'bot' ? ' board-in' : '');
  const playerTitle = document.createElement('div');
  playerTitle.className = 'battle-board-title';
  playerTitle.textContent = `🛡️ ${t.yourGrid}`;
  playerBlock.appendChild(playerTitle);
  playerBlock.appendChild(createBattleTable('player'));

  const enemyBlock = document.createElement('div');
  enemyBlock.className = 'battle-board-block battle-enemy-block' + (battlePhase === 'player' ? ' board-in' : '');
  const enemyTitle = document.createElement('div');
  enemyTitle.className = 'battle-board-title';
  enemyTitle.textContent = `🎯 ${t.enemyGrid}`;
  enemyBlock.appendChild(enemyTitle);
  enemyBlock.appendChild(createBattleTable('enemy'));

  // Phone: show only the board that matters for the current phase.
  const summary = document.createElement('div');
  summary.className = 'battle-mobile-summary';

  if (battlePhase === 'placement') {
    enemyBlock.classList.add('mobile-hidden');
    summary.textContent = lang === 'mn'
      ? '🎯 Дайсны талбай — тулаан эхлэхэд нээгдэнэ'
      : '🎯 Enemy Grid — opens when battle starts';
  } else if (battlePhase === 'player') {
    playerBlock.classList.add('mobile-hidden');
    summary.textContent = lang === 'mn'
      ? `🛡️ Таны талбай — Дайсан ${enemyBattleHits}/${playerPlanes.length}`
      : `🛡️ Your Grid — Enemy ${enemyBattleHits}/${playerPlanes.length}`;
  } else if (battlePhase === 'bot') {
    enemyBlock.classList.add('mobile-hidden');
    summary.textContent = lang === 'mn'
      ? `🎯 Дайсны талбай — Та ${playerBattleHits}/${enemyPlanes.length}`
      : `🎯 Enemy Grid — You ${playerBattleHits}/${enemyPlanes.length}`;
  } else if (battlePhase === 'finished') {
    // V4.3.2: on phones keep only the decisive board expanded at game over.
    // Desktop still shows both boards because .mobile-hidden is mobile-only CSS.
    if (battleFinishedWinner === 'player') {
      playerBlock.classList.add('mobile-hidden');
      summary.textContent = lang === 'mn'
        ? `🛡️ Таны талбай — Дайсан ${enemyBattleHits}/${playerPlanes.length}`
        : `🛡️ Your Grid — Enemy ${enemyBattleHits}/${playerPlanes.length}`;
    } else {
      enemyBlock.classList.add('mobile-hidden');
      summary.textContent = lang === 'mn'
        ? `🎯 Дайсны талбай — Та ${playerBattleHits}/${enemyPlanes.length}`
        : `🎯 Enemy Grid — You ${playerBattleHits}/${enemyPlanes.length}`;
    }
  }

  boardsRow.appendChild(playerBlock);
  boardsRow.appendChild(enemyBlock);
  wrap.appendChild(boardsRow);

  if (battlePhase === 'placement') {
    const placed = playerPlanes.length;
    const needed = battlePlaneCount();

    const placement = document.createElement('div');
    placement.className = 'placement-status' + (placed === needed ? ' ready' : '');
    placement.textContent = placed === needed
      ? `✅ ${placed}/${needed} — ${t.readyBattle}`
      : `✈️ ${t.planesPlaced}: ${placed}/${needed}`;
    wrap.appendChild(placement);

    const btn = document.createElement('button');
    btn.className = 'battle-action';
    btn.textContent = `▶ ${t.startBattle}`;
    btn.disabled = placed !== needed;
    btn.addEventListener('click', beginBattle);
    wrap.appendChild(btn);
  }

  if (battlePhase === 'placement' || battlePhase === 'player' || battlePhase === 'bot' || battlePhase === 'finished') {
    wrap.appendChild(summary);
  }

  gridDiv.appendChild(wrap);
  renderBattleHints();
  updateStatus();
}
function togglePlayerPlane(row, col) {
  if (battlePhase !== 'placement') return;

  const idx = playerPlanes.findIndex(p => p.x === col && p.y === row);
  if (idx >= 0) {
    playerPlanes.splice(idx, 1);
  } else if (playerPlanes.length < battlePlaneCount()) {
    playerPlanes.push({ x: col, y: row, hit: false });
    playSound(battlePlaceSound);
  }

  renderBattleBoards();
}

function beginBattle() {
  if (playerPlanes.length !== battlePlaneCount()) return;
  startGameTimer();
  battlePhase = 'player';
  battleShotsLeft = battleVolleySize();
  enemyShotHistory = new Set();
  playerShotHistory = new Set();
  botRadarObservations = [];
  playerVolleyHits = 0;
  botVolleyHits = 0;
  battleVolleyNotice = '';
  renderBattleBoards();
  playBattleStartCue();
  setTimeout(playPlayerTurnCue, 230);
}

function clearBattleTargetLock() {
  battleEnemyGrid.flat().forEach(cell => {
    cell.classList.remove('battle-line', 'battle-target');
  });
}

function showBattleTargetLock(row, col) {
  clearBattleTargetLock();
  if (battlePhase !== 'player') return;

  for (let c = 0; c < gridSize; c++) {
    battleEnemyGrid[row][c].classList.add('battle-line');
  }
  for (let r = 0; r < gridSize; r++) {
    battleEnemyGrid[r][col].classList.add('battle-line');
  }
  battleEnemyGrid[row][col].classList.remove('battle-line');
  battleEnemyGrid[row][col].classList.add('battle-target');
}

function tVolley() { return texts[lang]; }

function playerBattleShot(row, col) {
  if (battlePhase !== 'player' || botBusy) return;

  const key = shotKey(row, col);
  if (playerShotHistory.has(key)) return;

  playerShotHistory.add(key);
  battleShotsLeft--;

  const plane = enemyPlanes.find(p => p.x === col && p.y === row);
  if (plane && !plane.hit) {
    plane.hit = true;
    playerBattleHits++;
    playerVolleyHits++;
    playSound(battleExplodeSound);
  } else {
    playSound(battleHitSound);
  }

  if (enemyPlanes.every(p => p.hit)) {
    battleFinishedWinner = 'player';
    battlePhase = 'finished';
    stopGameTimer();
    renderBattleBoards();
    showBattleResult(true);
    return;
  }

  renderBattleBoards();

  const firedCell = battleEnemyGrid[row]?.[col];
  if (firedCell) {
    firedCell.classList.add('player-shot');
    if (plane) firedCell.classList.add('battle-hit-burst');
  }

  if (battleShotsLeft <= 0) {
    // V4.4.2 deliberate-slow test: lock input and leave the final shot visible
    // before showing the volley summary.
    botBusy = true;
    const volleyHits = playerVolleyHits;
    const misses = battleVolleySize() - volleyHits;
    playerVolleyHits = 0;

    setTimeout(() => {
      battleVolleyNotice = `🎯 ${tVolley().yourVolley}: ✈️ ${volleyHits} ${volleyHits === 1 ? tVolley().volleyHit : tVolley().volleyHits} · • ${misses} ${tVolley().volleyMisses}`;
      renderBattleBoards();

      // Keep the summary on-screen long enough to actually read on a phone.
      setTimeout(() => {
        battleVolleyNotice = '';
        battlePhase = 'bot';
        renderBattleBoards();
        playEnemyTurnCue();

        // Hold on ENEMY TURN before the first bot shot.
        setTimeout(() => {
          botBusy = false;
          botTurn();
        }, 1500);
      }, 2000);
    }, 1500);
  }
}

function renderBattleHints() {
  if (gameMode !== 'battle') return;
  const hint = document.getElementById('hint');
  hint.innerHTML = '';

  if (battlePhase === 'placement') return;

  const lastShot = Array.from(playerShotHistory).pop();
  if (!lastShot) return;

  const [row, col] = lastShot.split(',').map(Number);
  const t = texts[lang];
  const box = document.createElement('div');
  box.className = 'battle-hints';

  enemyPlanes.forEach((p, i) => {
    if (p.hit) return;
    const dx = Math.abs(p.x - col);
    const dy = Math.abs(p.y - row);
    const diag = Math.min(dx, dy);
    const straight = Math.abs(dx - dy);
    const dist = (diag * 1.4 + straight).toFixed(1);

    const div = document.createElement('div');
    div.textContent = lang === 'en'
      ? `🛰️ ${t.battleHintPrefix} #${i + 1}: ${dist} ${t.battleHintMiddle}`
      : `🛰️ ${t.battleHintPrefix} #${i + 1}: ${dist} ${t.battleHintMiddle}`;
    box.appendChild(div);
  });

  hint.appendChild(box);
}

function radarDistance(r1, c1, r2, c2) {
  const dx = Math.abs(c2 - c1);
  const dy = Math.abs(r2 - r1);
  const diag = Math.min(dx, dy);
  const straight = Math.abs(dx - dy);
  return Number((diag * 1.4 + straight).toFixed(1));
}

function rememberBotRadarShot(row, col) {
  const distances = {};

  playerPlanes.forEach((plane, index) => {
    if (!plane.hit) {
      distances[index] = radarDistance(row, col, plane.y, plane.x);
    }
  });

  botRadarObservations.push({ row, col, distances });
}

function getBotCandidatesForPlane(planeIndex) {
  const candidates = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const key = shotKey(r, c);

      // A previously fired-at miss cannot contain an unhit plane.
      if (enemyShotHistory.has(key)) continue;

      let fits = true;

      for (const obs of botRadarObservations) {
        if (!(planeIndex in obs.distances)) continue;

        const expected = obs.distances[planeIndex];
        const candidateDistance = radarDistance(obs.row, obs.col, r, c);

        if (Math.abs(candidateDistance - expected) > 0.05) {
          fits = false;
          break;
        }
      }

      if (fits) candidates.push({ r, c, key });
    }
  }

  return candidates;
}

function chooseRandomBotShot() {
  const candidates = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const key = shotKey(r, c);
      if (!enemyShotHistory.has(key)) {
        candidates.push({ r, c, key });
      }
    }
  }

  return candidates.length
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : null;
}

// V4.6.5 Battle balance: keep equal 3/4/6 volleys, but let the bot
// deliberately waste a small number of shots on Medium and Hard.
function botIntentionalMissQuota() {
  if (gridSize === 8) return 1;   // Medium: 1 deliberate miss per volley
  if (gridSize === 10) return 2;  // Hard: 2 deliberate misses per volley
  return 0;                       // Easy: unchanged
}

// V4.6.6: choose the deliberate-miss shot positions randomly for each volley.
// Example on Hard: misses could be shots 1+4, 2+6, 3+5, etc.
function chooseIntentionalMissSlots(volleySize, quota) {
  const slots = Array.from({ length: volleySize }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return new Set(slots.slice(0, Math.min(quota, volleySize)));
}

function chooseIntentionalBotMiss() {
  const safeCells = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const key = shotKey(r, c);
      if (enemyShotHistory.has(key)) continue;

      // This is an intentional handicap: choose only an empty player cell.
      const hasPlane = playerPlanes.some(p => !p.hit && p.x === c && p.y === r);
      if (!hasPlane) safeCells.push({ r, c, key });
    }
  }

  return safeCells.length
    ? safeCells[Math.floor(Math.random() * safeCells.length)]
    : null;
}

function chooseBotShot() {
  // First radar sample is intentionally random.
  if (botRadarObservations.length === 0 || Math.random() > botSmartChance) {
    return chooseRandomBotShot();
  }

  const scores = new Map();

  playerPlanes.forEach((plane, planeIndex) => {
    if (plane.hit) return;

    const possible = getBotCandidatesForPlane(planeIndex);

    possible.forEach(cell => {
      const current = scores.get(cell.key) || {
        r: cell.r,
        c: cell.c,
        key: cell.key,
        score: 0
      };

      // Cells that could contain several remaining planes are especially useful.
      current.score += 1 / Math.max(1, possible.length);
      scores.set(cell.key, current);
    });
  });

  if (scores.size === 0) {
    return chooseRandomBotShot();
  }

  const ranked = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  const bestScore = ranked[0].score;

  // Choose among near-best cells, rather than behaving perfectly every time.
  const nearBest = ranked.filter(item => item.score >= bestScore * 0.85);
  return nearBest[Math.floor(Math.random() * nearBest.length)];
}

function botTurn() {
  if (gameMode !== 'battle' || battlePhase !== 'bot') return;

  botBusy = true;
  let shots = 0;
  const intentionalMissQuota = botIntentionalMissQuota();
  const intentionalMissSlots = chooseIntentionalMissSlots(
    battleVolleySize(),
    intentionalMissQuota
  );

  const fireNext = () => {
    if (shots >= battleVolleySize() || battlePhase !== 'bot') {
      botBusy = false;

      if (playerPlanes.every(p => p.hit)) {
        battleFinishedWinner = 'enemy';
        battlePhase = 'finished';
        renderBattleBoards();
        playBattleLoseCue();
        showBattleResult(false);
        return;
      }

      const misses = battleVolleySize() - botVolleyHits;
      battleVolleyNotice = `🤖 ${tVolley().enemyVolley}: ✈️ ${botVolleyHits} ${botVolleyHits === 1 ? tVolley().volleyHit : tVolley().volleyHits} · • ${misses} ${tVolley().volleyMisses}`;
      // V4.4.2: keep Your Grid visible while the enemy volley summary is shown.
      renderBattleBoards();
      botVolleyHits = 0;
      setTimeout(() => {
        battleVolleyNotice = '';
        battlePhase = 'player';
        battleShotsLeft = battleVolleySize();
        renderBattleBoards();
        playPlayerTurnCue();
      }, 2000);
      return;
    }

    // Medium/Hard balancing:
    // deliberate misses are assigned to random shot numbers at the start of
    // each enemy volley, so the miss is not predictably the last shot.
    const useIntentionalMiss = intentionalMissSlots.has(shots);

    let choice = useIntentionalMiss ? chooseIntentionalBotMiss() : chooseBotShot();
    if (!choice) choice = chooseBotShot();

    if (!choice) {
      botBusy = false;
      battlePhase = 'player';
      battleShotsLeft = battleVolleySize();
      renderBattleBoards();
      return;
    }

    enemyShotHistory.add(choice.key);
    const plane = playerPlanes.find(p => p.x === choice.c && p.y === choice.r);
    if (plane && !plane.hit) {
      plane.hit = true;
      enemyBattleHits++;
      botVolleyHits++;
      playSound(battleExplodeSound);
    } else {
      playSound(battleHitSound);
    }

    // The bot receives the same kind of exact radar information the player receives.
    rememberBotRadarShot(choice.r, choice.c);

    shots++;
    renderBattleBoards();

    const cell = battlePlayerGrid[choice.r]?.[choice.c];
    if (cell) {
      cell.classList.add('bot-shot');
      if (plane) cell.classList.add('battle-hit-burst');
      setTimeout(() => cell.classList.remove('bot-shot'), 1050);
    }

    if (playerPlanes.every(p => p.hit)) {
      botBusy = false;
      battleFinishedWinner = 'enemy';
      battlePhase = 'finished';
      stopGameTimer();
      renderBattleBoards();
      playBattleLoseCue();
      showBattleResult(false);
      return;
    }

    setTimeout(fireNext, 1200);
  };

  fireNext();
}

function hallKey(level) {
  return `hallOfFame_${level}`;
}

function getHallScores(level) {
  return JSON.parse(localStorage.getItem(hallKey(level)) || "[]");
}

function saveToHallOfFame(name) {
  const date = new Date().toLocaleString();
  const level = gridSize;

  const elapsedSeconds = getElapsedSeconds();
  const score = {
    name,
    moves,
    time: new Date(elapsedSeconds * 1000).toISOString().substr(14, 5),
    date
  };

  let scores = getHallScores(level);
  scores.push(score);
  scores.sort((a, b) => a.moves - b.moves || a.time.localeCompare(b.time));
  scores = scores.slice(0, 10);

  localStorage.setItem(hallKey(level), JSON.stringify(scores));
  renderHallOfFame();
}

function selectHallLevel(level) {
  renderHallOfFame();
}

function renderHallOfFame() {
  const hof = document.getElementById("hall-of-fame");
  const t = texts[lang];
  const level = gridSize;

  const levelNames = {
    5: t.easy,
    8: t.medium,
    10: t.hard
  };

  const scores = getHallScores(level);

  let html = `<h3>${t.hofTitle} — ${levelNames[level]} ${level}×${level}</h3>`;

  if (scores.length === 0) {
    html += `<div class="hof-empty">${t.noRecords}</div>`;
    hof.innerHTML = html;
    return;
  }

  html += `
    <table class="hof-table">
      <tr>
        <th>#</th>
        <th>${t.name}</th>
        <th>${t.moves}</th>
        <th>${t.time}</th>
        <th>${t.date}</th>
      </tr>`;

  scores.forEach((s, i) => {
    html += `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.moves}</td>
        <td>${s.time}</td>
        <td>${s.date}</td>
      </tr>`;
  });

  html += `</table>`;
  hof.innerHTML = html;
}

document.getElementById("difficulty").addEventListener("change", () => {
  savePreferences();
  restartGame();
});

document.getElementById("modeSelect").addEventListener("change", () => {
  savePreferences();
  restartGame();
});

function chooseGameMode(mode) {
  const modeSelect = document.getElementById("modeSelect");
  if (modeSelect.value === mode) return;
  modeSelect.value = mode;
  savePreferences();
  restartGame();
  updateLanguageUI();
}

document.getElementById("radarModeBtn").addEventListener("click", () => chooseGameMode("radar"));
document.getElementById("battleModeBtn").addEventListener("click", () => chooseGameMode("battle"));
window.onload = initializeGame;
