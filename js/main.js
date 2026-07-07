const canvas = document.querySelector("#battleCanvas");
const ctx = canvas.getContext("2d");
const messageText = document.querySelector("#messageText");
const messageBox = document.querySelector("#messageBox");
const titleMenu = document.querySelector("#titleMenu");
const buttons = {
  start: document.querySelector("#startButton"),
  share: document.querySelector("#shareButton"),
  virus: document.querySelector("#virusButton"),
  mayo: document.querySelector("#mayoButton"),
  run: document.querySelector("#runButton")
};

const VIEW = { width: 960, height: 540 };
const player = { name: "Eggman", stamina: 100, maxStamina: 100 };
const actionCosts = {
  virus: 5,
  mayo: 30
};
const enemySettingsKey = "eggmanEnemySettings:v1";
let audioContext = null;
const state = {
  scene: "loading",
  enemy: null,
  infection: 0,
  stage: "normal",
  images: {},
  playerImage: null,
  messageQueue: [],
  typing: null,
  busy: false,
  effect: null,
  effectUntil: 0,
  effectStartedAt: 0,
  lastAction: "",
  resultText: ""
};

function playerEnergyLabel() {
  return `体力 ${player.stamina}/${player.maxStamina}`;
}

const stageLabels = {
  normal: "正常",
  pixel: "ピクセル化",
  eggman: "感染完了"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  if (!audioContext) {
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency, duration = 0.12, type = "square", volume = 0.08, delay = 0) {
  const audio = getAudioContext();
  if (!audio) return;

  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoise(duration = 0.16, volume = 0.08, delay = 0) {
  const audio = getAudioContext();
  if (!audio) return;

  const sampleRate = audio.sampleRate;
  const buffer = audio.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const start = audio.currentTime + delay;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.buffer = buffer;
  source.connect(gain).connect(audio.destination);
  source.start(start);
}

function playSound(name) {
  switch (name) {
    case "select":
      playTone(660, 0.06, "square", 0.05);
      playTone(880, 0.08, "square", 0.04, 0.05);
      break;
    case "start":
      playTone(392, 0.09, "square", 0.06);
      playTone(523, 0.09, "square", 0.06, 0.08);
      playTone(784, 0.14, "square", 0.06, 0.16);
      break;
    case "virus":
      playTone(220, 0.08, "sawtooth", 0.05);
      playTone(330, 0.12, "sawtooth", 0.05, 0.08);
      playNoise(0.12, 0.035, 0.02);
      break;
    case "mayo":
      playTone(330, 0.12, "triangle", 0.07);
      playTone(440, 0.16, "triangle", 0.07, 0.08);
      playTone(660, 0.28, "triangle", 0.08, 0.2);
      break;
    case "pixel":
      playNoise(0.28, 0.09);
      playTone(900, 0.05, "square", 0.05, 0.02);
      playTone(520, 0.05, "square", 0.05, 0.08);
      playTone(760, 0.06, "square", 0.05, 0.14);
      break;
    case "cream":
      playTone(300, 0.1, "triangle", 0.05);
      playTone(180, 0.12, "triangle", 0.05, 0.08);
      playNoise(0.09, 0.06, 0.18);
      break;
    case "complete":
      playTone(523, 0.12, "square", 0.06);
      playTone(659, 0.12, "square", 0.06, 0.1);
      playTone(784, 0.12, "square", 0.06, 0.2);
      playTone(1046, 0.28, "square", 0.06, 0.3);
      break;
    case "fail":
      playTone(220, 0.18, "sawtooth", 0.06);
      playTone(165, 0.28, "sawtooth", 0.06, 0.16);
      break;
    case "run":
      playTone(740, 0.06, "square", 0.05);
      playTone(520, 0.06, "square", 0.05, 0.06);
      playTone(360, 0.1, "square", 0.05, 0.12);
      break;
    default:
      break;
  }
}

function shareToX() {
  playSound("select");
  const shareUrl = new URL(window.location.href);
  shareUrl.hash = "";
  shareUrl.search = "";

  const text = [
    "完全！感染！Eggman！",
    "Infection Battle",
    "Eggman Virusで感染拡大中！"
  ].join("\n");

  const intentUrl = new URL("https://twitter.com/intent/tweet");
  intentUrl.searchParams.set("text", text);
  intentUrl.searchParams.set("url", shareUrl.toString());
  window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");
}

async function loadEnemy(path) {
  const enemy = await fetch(path).then((response) => response.json());
  const settings = loadEnemySettings();
  const mergedEnemy = mergeEnemySettings(enemy, settings);
  const imageEntries = Object.entries(mergedEnemy.images);
  const images = {};

  await Promise.all(imageEntries.map(([key, src]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images[key] = img;
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  })));

  state.enemy = mergedEnemy;
  state.images = images;
  state.infection = mergedEnemy.startsPixelized ? 50 : 0;
  state.stage = mergedEnemy.startsPixelized ? "pixel" : "normal";
}

function loadEnemySettings() {
  try {
    return JSON.parse(localStorage.getItem(enemySettingsKey)) || {};
  } catch {
    return {};
  }
}

function mergeEnemySettings(enemy, settings) {
  const images = { ...enemy.images };
  if (settings.images) {
    ["normal", "pixel", "eggman"].forEach((stage) => {
      if (settings.images[stage]) {
        images[stage] = settings.images[stage];
      }
    });
  }

  return {
    ...enemy,
    displayName: settings.displayName?.trim() || enemy.displayName,
    images
  };
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAssets() {
  await loadEnemy("assets/enemies/nato/enemy.json");
  state.playerImage = await loadImage("assets/player/eggman.png");
}

function setButtonsEnabled(enabled) {
  [buttons.virus, buttons.mayo, buttons.run].forEach((button) => {
    button.disabled = !enabled;
  });
}

function setTitleVisible(visible) {
  titleMenu.hidden = !visible;
  messageBox.hidden = visible;
  document.querySelector(".command-panel").hidden = visible;
}

function clearTyping() {
  if (state.typing?.timer) {
    window.clearTimeout(state.typing.timer);
  }
  state.typing = null;
}

function queueMessage(lines, after) {
  state.messageQueue.push({ text: Array.isArray(lines) ? lines.join("\n") : lines, after });
  if (!state.typing) {
    showNextMessage();
  }
}

function showNextMessage() {
  const next = state.messageQueue.shift();
  if (!next) {
    state.typing = null;
    if (state.scene === "battle" && !state.busy) {
      setButtonsEnabled(true);
    }
    return;
  }

  typeMessage(next.text, () => {
    if (next.after) {
      next.after();
    }
  });
}

function typeMessage(text, done) {
  state.typing = {
    text,
    index: 0,
    done,
    complete: false,
    timer: null
  };
  messageText.textContent = "";

  const tick = () => {
    if (!state.typing) return;
    state.typing.index += 1;
    messageText.textContent = text.slice(0, state.typing.index);

    if (state.typing.index >= text.length) {
      state.typing.complete = true;
      state.typing.timer = window.setTimeout(() => {
        const callback = state.typing?.done;
        state.typing = null;
        if (callback) callback();
        if (!state.typing) {
          showNextMessage();
        }
      }, 380);
      return;
    }

    state.typing.timer = window.setTimeout(tick, text[state.typing.index - 1] === "\n" ? 70 : 28);
  };

  tick();
}

function advanceMessage() {
  playSound("select");

  if (state.scene === "result" || state.scene === "escaped") {
    resetToTitle();
    return;
  }

  if (!state.typing) return;

  if (!state.typing.complete) {
    window.clearTimeout(state.typing.timer);
    state.typing.index = state.typing.text.length;
    state.typing.complete = true;
    messageText.textContent = state.typing.text;
    return;
  }

  window.clearTimeout(state.typing.timer);
  const callback = state.typing.done;
  state.typing = null;
  if (callback) callback();
  if (!state.typing) {
    showNextMessage();
  }
}

function resetToTitle() {
  clearTyping();
  state.scene = "title";
  state.infection = state.enemy.startsPixelized ? 50 : 0;
  state.stage = state.enemy.startsPixelized ? "pixel" : "normal";
  state.busy = false;
  state.messageQueue = [];
  state.resultText = "";
  player.stamina = player.maxStamina;
  messageText.textContent = "";
  setTitleVisible(true);
  setButtonsEnabled(false);
}

function startBattle() {
  playSound("start");
  clearTyping();
  setTitleVisible(false);
  state.scene = "battle";
  state.infection = state.enemy.startsPixelized ? 50 : 0;
  state.stage = state.enemy.startsPixelized ? "pixel" : "normal";
  state.busy = false;
  state.messageQueue = [];
  state.resultText = "";
  player.stamina = player.maxStamina;
  setButtonsEnabled(false);
  queueMessage(["野生の", `${state.enemy.displayName}が`, "あらわれた！"]);
}

async function useVirus() {
  if (!canAct()) return;
  if (!trySpendEnergy("eggmanウィルス", actionCosts.virus)) return;
  playSound("virus");
  state.busy = true;
  setButtonsEnabled(false);
  state.lastAction = "eggmanウィルス";

  const base = state.stage === "pixel" ? randInt(6, 9) : randInt(13, 17);
  const amount = Math.max(4, Math.round(base / state.enemy.virusResistance));

  queueMessage(["Eggmanは", "体力を少し使って", "eggmanウィルスを", "ばらまいた！", `体力 -${actionCosts.virus}`], async () => {
    triggerEffect("infection", 430);
    await sleep(360);
    applyInfection(amount, "感染！！");
  });
}

async function useMayo() {
  if (!canAct()) return;
  if (!trySpendEnergy("マヨビーム", actionCosts.mayo)) return;
  playSound("mayo");
  state.busy = true;
  setButtonsEnabled(false);
  state.lastAction = "マヨビーム";

  const amount = randInt(35, 40);
  queueMessage(["Eggmanは", "体力を大量にこめて", "マヨビームを", "かまえた！", `体力 -${actionCosts.mayo}`], async () => {
    triggerEffect("mayo", 560);
    await sleep(420);
    applyInfection(amount, "マヨビーーーム！！");
  });
}

function runAway() {
  if (!canAct()) return;
  playSound("run");
  state.busy = true;
  setButtonsEnabled(false);
  state.scene = "escaped";
  state.messageQueue = [];
  queueMessage(["Eggmanは", "にげだした！", "感染は失敗した。"]);
}

function canAct() {
  return state.scene === "battle" && !state.busy && !state.typing;
}

function trySpendEnergy(actionName, cost) {
  if (player.stamina < cost) {
    state.busy = true;
    setButtonsEnabled(false);

    if (player.stamina < actionCosts.virus) {
      failEggmanization();
      return false;
    }

    queueMessage(["体力が足りない！", `${actionName}には`, `体力が${cost}必要だ！`], () => {
      state.busy = false;
      setButtonsEnabled(true);
    });
    return false;
  }

  player.stamina = clamp(player.stamina - cost, 0, player.maxStamina);
  return true;
}

function loseBattle() {
  state.scene = "result";
  state.resultText = "Eggmanは\n体力を使い果たした……";
  queueMessage(["Eggmanは", "体力を使い果たした……"]);
}

function cannotContinueInfection() {
  return state.scene === "battle" && state.infection < 100 && player.stamina < actionCosts.virus;
}

function failEggmanization() {
  playSound("fail");
  state.scene = "result";
  state.busy = true;
  setButtonsEnabled(false);
  state.resultText = "Eggman化に\n失敗した……";
  queueMessage(["体力が足りない……", "eggmanウィルスも", "撃てない！"]);
  queueMessage(["Eggman化に", "失敗した……"]);
}

function applyInfection(amount, shout) {
  const before = state.infection;
  state.infection = clamp(state.infection + amount, 0, 100);
  const gained = state.infection - before;

  queueMessage([shout, "感染率が", `${gained}%`, "上昇した！"], () => {
    if (state.infection >= 100) {
      completeInfection();
      return;
    }

    if (before < 50 && state.infection >= 50) {
      pixelize();
      return;
    }

    if (cannotContinueInfection()) {
      failEggmanization();
      return;
    }

    enemyTurn();
  });
}

function pixelize() {
  playSound("pixel");
  state.stage = "pixel";
  triggerEffect("noise", 760);
  queueMessage(["身体のデジタル化が", "始まった……"], () => {
    queueMessage(["ピクセル化した！", "Virusへの耐性が", "上昇した！"], () => {
      if (cannotContinueInfection()) {
        failEggmanization();
        return;
      }

      enemyTurn();
    });
  });
}

function completeInfection() {
  playSound("complete");
  state.stage = "eggman";
  state.infection = 100;
  triggerEffect("complete", 900);
  state.scene = "result";
  state.resultText = `感染完了！\n${state.enemy.displayName}は\nEggmanになった！`;
  queueMessage(["感染完了！", `${state.enemy.displayName}は`, "Eggmanになった！"]);
}

function enemyTurn() {
  if (state.scene !== "battle") return;
  const damage = state.stage === "pixel" ? randInt(8, 13) : randInt(5, 10);

  queueMessage([`${state.enemy.displayName}は`, "Eggmanに向かって", "何かを投げた！"], () => {
    playSound("cream");
    triggerEffect("cream", 1050);
    queueMessage(["Eggman「これは、", "マヨネーズ？！」"]);
    queueMessage(["Eggmanは", "口を開いた"]);
    queueMessage(["「甘っ！」"]);
    queueMessage(["マヨネーズではなく", "生クリームだった", "ダメージ！！"], () => {
      player.stamina = clamp(player.stamina - damage, 0, player.maxStamina);

      if (cannotContinueInfection()) {
        queueMessage([`体力 -${damage}`]);
        failEggmanization();
        return;
      }

      queueMessage([`体力 -${damage}`, playerEnergyLabel()], () => {
        state.busy = false;
        setButtonsEnabled(true);
      });
    });
  });
}

function triggerEffect(type, duration) {
  state.effect = type;
  state.effectStartedAt = performance.now();
  state.effectUntil = performance.now() + duration;
}

function infectionColor() {
  if (state.infection >= 100) return "#ff5149";
  if (state.infection >= 50) return "#ff9d35";
  if (state.infection >= 26) return "#f4d94e";
  return "#6bed75";
}

function draw() {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawBackground();

  if (state.scene === "loading") {
    drawCenteredText("Loading...", VIEW.width / 2, VIEW.height / 2, 34);
    requestAnimationFrame(draw);
    return;
  }

  drawPlayer();
  drawEnemy();
  drawStatusPanels();

  if (state.scene === "title") {
    drawTitleOverlay();
  }

  if (state.resultText) {
    drawResultOverlay();
  }

  drawEffect();
  requestAnimationFrame(draw);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, "#271719");
  gradient.addColorStop(0.43, "#4b2f21");
  gradient.addColorStop(0.44, "#142647");
  gradient.addColorStop(1, "#07101f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  drawCathedralWindows();

  ctx.fillStyle = "rgba(255, 209, 82, 0.12)";
  for (let y = 28; y < 296; y += 9) {
    ctx.fillRect(0, y, VIEW.width, 2);
  }

  drawBattlePlatform(660, 330, 300, 74, "#3a3152", "#e1b73e");
  drawBattlePlatform(212, 432, 360, 86, "#173d66", "#e1b73e");
}

function drawCathedralWindows() {
  const windows = [320, 480, 640];
  windows.forEach((x, index) => {
    ctx.save();
    ctx.fillStyle = index === 1 ? "rgba(73, 174, 255, 0.34)" : "rgba(255, 210, 83, 0.24)";
    ctx.strokeStyle = "#d9ab36";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 42);
    ctx.lineTo(x + 54, 112);
    ctx.lineTo(x + 54, 248);
    ctx.lineTo(x - 54, 248);
    ctx.lineTo(x - 54, 112);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 240, 160, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 54);
    ctx.lineTo(x, 248);
    ctx.moveTo(x - 44, 142);
    ctx.lineTo(x + 44, 142);
    ctx.moveTo(x - 48, 218);
    ctx.lineTo(x + 48, 92);
    ctx.moveTo(x - 48, 92);
    ctx.lineTo(x + 48, 218);
    ctx.stroke();
    ctx.restore();
  });

  ctx.fillStyle = "rgba(255, 207, 69, 0.18)";
  for (let i = 0; i < 18; i += 1) {
    const x = 64 + i * 48;
    const h = 90 + (i % 4) * 28;
    ctx.fillRect(x, 270 - h, 7, h);
    ctx.fillStyle = i % 2 ? "rgba(255, 207, 69, 0.18)" : "rgba(255, 255, 196, 0.14)";
  }
}

function drawBattlePlatform(cx, cy, width, height, fill, stroke) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  if (state.playerImage) {
    ctx.save();
    const bob = Math.sin(performance.now() / 420) * 3;
    ctx.drawImage(state.playerImage, 54, 230 + bob, 260, 260);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(200, 315);
  ctx.fillStyle = "#151820";
  ctx.fillRect(-64, 64, 150, 18);
  ctx.fillStyle = "#d9413b";
  ctx.fillRect(-26, -54, 86, 94);
  ctx.fillStyle = "#f4d9ad";
  ctx.fillRect(-42, -110, 92, 70);
  ctx.fillStyle = "#28201a";
  ctx.fillRect(-52, -104, 18, 24);
  ctx.fillRect(42, -104, 18, 24);
  ctx.fillStyle = "#f1f1f1";
  ctx.fillRect(-24, -82, 18, 12);
  ctx.fillRect(12, -82, 18, 12);
  ctx.fillStyle = "#16161a";
  ctx.fillRect(-18, -78, 8, 8);
  ctx.fillRect(18, -78, 8, 8);
  ctx.fillStyle = "#d65b4d";
  ctx.fillRect(-8, -62, 20, 10);
  ctx.fillStyle = "#f1c34f";
  ctx.fillRect(-20, 40, 26, 48);
  ctx.fillRect(28, 40, 26, 48);
  ctx.restore();
}

function drawEnemy() {
  const img = state.images[state.stage] || state.images.normal;
  if (!img) return;
  ctx.save();
  const bob = Math.sin(performance.now() / 350) * 4;
  ctx.drawImage(img, 608, 106 + bob, 224, 224);
  ctx.restore();
}

function drawStatusPanels() {
  drawPanel(34, 34, 360, 112, "#050507", "#d9ab36");
  drawText(`${state.enemy.displayName}`, 58, 68, 24, "#fff7d1");
  drawText(`Lv.${state.enemy.level}`, 280, 68, 19, "#fff7d1");
  drawText("感染率", 58, 108, 17, "#fff7d1");
  drawInfectionBlocks(146, 93);
  drawText(`${Math.round(state.infection)}%`, 302, 111, 19, infectionColor());

  drawPanel(552, 358, 356, 120, "#050507", "#d9ab36");
  drawText("Eggman", 576, 393, 24, "#fff7d1");
  drawText("体力", 576, 432, 18, "#fff7d1");
  drawBar(638, 414, 194, 22, player.stamina / player.maxStamina, "#68d66f");
  drawText(`${player.stamina}/${player.maxStamina}`, 748, 451, 18, "#fff7d1");
}

function drawPanel(x, y, width, height, fill = "#20263b", stroke = "#f7f1d7") {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, width, height);
  ctx.strokeStyle = "rgba(255, 243, 178, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 7, y + 7, width - 14, height - 14);
}

function drawBar(x, y, width, height, ratio, color) {
  ctx.fillStyle = "#1b1c20";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(width * ratio), height);
  ctx.strokeStyle = "#d9ab36";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

function drawInfectionBlocks(x, y) {
  const filled = Math.ceil(state.infection / 12.5);
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i < filled ? infectionColor() : "#10131b";
    ctx.fillRect(x + i * 18, y, 13, 22);
    ctx.strokeStyle = "#d9ab36";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i * 18, y, 13, 22);
  }
}

function drawTitleOverlay() {
  ctx.fillStyle = "rgba(5, 7, 12, 0.56)";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawCenteredText("完全！感染！Eggman！", VIEW.width / 2, 194, 46, "#f5cf4c");
  drawCenteredText("Infection Battle", VIEW.width / 2, 258, 38, "#f7f1d7");
}

function drawResultOverlay() {
  ctx.fillStyle = "rgba(5, 7, 12, 0.55)";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const lines = state.resultText.split("\n");
  lines.forEach((line, index) => {
    drawCenteredText(line, VIEW.width / 2, 180 + index * 50, 34, index === 0 ? "#ff5149" : "#f7f1d7");
  });
  drawCenteredText("クリックでタイトルへ", VIEW.width / 2, 390, 18, "#72d8ff");
}

function drawEffect() {
  const now = performance.now();
  if (!state.effect || now > state.effectUntil) {
    state.effect = null;
    return;
  }

  const alpha = (state.effectUntil - now) / 700;
  if (state.effect === "infection") {
    ctx.fillStyle = `rgba(255, 80, 80, ${0.28 * alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawCenteredText("感染！！", VIEW.width / 2, 104, 36, "#ff5149");
  }

  if (state.effect === "mayo") {
    ctx.fillStyle = `rgba(255, 229, 82, ${0.45 * alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = "#ffe552";
    for (let y = 130; y < 310; y += 18) {
      ctx.fillRect(260, y, 430, 8);
    }
    drawCenteredText("マヨビーーーム！！", VIEW.width / 2, 104, 32, "#fff1a6");
  }

  if (state.effect === "cream") {
    const duration = state.effectUntil - state.effectStartedAt;
    const progress = clamp((now - state.effectStartedAt) / duration, 0, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const x = 706 - 508 * ease;
    const y = 230 + Math.sin(progress * Math.PI) * -88 + 84 * ease;

    ctx.save();
    ctx.fillStyle = "rgba(255, 250, 237, 0.96)";
    ctx.strokeStyle = "#8d734e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 18 + Math.sin(progress * Math.PI) * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(x - 8, y - 18, 13, 7);
    ctx.fillRect(x + 4, y - 6, 16, 7);
    ctx.restore();

    if (progress > 0.72) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(progress - 0.72) * 1.7})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  if (state.effect === "noise") {
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.34)" : "rgba(0,0,0,0.28)";
      ctx.fillRect(randInt(0, VIEW.width), randInt(0, VIEW.height), randInt(12, 80), randInt(2, 9));
    }
  }

  if (state.effect === "complete") {
    ctx.fillStyle = `rgba(255, 32, 48, ${0.34 * alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function drawText(text, x, y, size = 20, color = "#f7f1d7") {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawCenteredText(text, x, y, size = 24, color = "#f7f1d7") {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

buttons.start.addEventListener("click", startBattle);
buttons.share.addEventListener("click", shareToX);
buttons.virus.addEventListener("click", useVirus);
buttons.mayo.addEventListener("click", useMayo);
buttons.run.addEventListener("click", runAway);
messageBox.addEventListener("click", advanceMessage);
messageBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    advanceMessage();
  }
});

setButtonsEnabled(false);
draw();

loadAssets()
  .then(() => {
    state.scene = "title";
    resetToTitle();
  })
  .catch(() => {
    messageText.textContent = "読み込みに失敗しました。";
  });
