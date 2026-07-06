const storageKey = "eggmanEnemySettings:v1";
const defaultImages = {
  normal: "assets/enemies/nato/normal.png?v=2",
  pixel: "assets/enemies/nato/pixel.png?v=2",
  eggman: "assets/enemies/nato/eggman.png?v=2"
};

const form = document.querySelector("#settingsForm");
const displayName = document.querySelector("#displayName");
const message = document.querySelector("#settingsMessage");
const fields = {
  normal: {
    input: document.querySelector("#normalImage"),
    preview: document.querySelector("#normalPreview")
  },
  pixel: {
    input: document.querySelector("#pixelImage"),
    preview: document.querySelector("#pixelPreview")
  },
  eggman: {
    input: document.querySelector("#eggmanImage"),
    preview: document.querySelector("#eggmanPreview")
  }
};

let settings = loadSettings();

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || { images: {} };
  } catch {
    return { images: {} };
  }
}

function saveSettings() {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

function render() {
  displayName.value = settings.displayName || "nato-san";
  Object.entries(fields).forEach(([stage, field]) => {
    field.preview.src = settings.images?.[stage] || defaultImages[stage];
  });
}

function setMessage(text) {
  message.textContent = text;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

Object.entries(fields).forEach(([stage, field]) => {
  field.input.addEventListener("change", async () => {
    const file = field.input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("画像ファイルを選んでください。");
      return;
    }

    settings.images = settings.images || {};
    settings.images[stage] = await readFileAsDataUrl(file);
    field.preview.src = settings.images[stage];
    setMessage("画像を読み込みました。保存するとバトルに反映されます。");
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  settings.displayName = displayName.value.trim() || "nato-san";
  settings.images = settings.images || {};
  saveSettings();
  setMessage("保存しました。バトル画面を開くと反映されます。");
});

document.querySelector("#resetButton").addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  settings = { images: {} };
  render();
  setMessage("初期状態に戻しました。");
});

render();
