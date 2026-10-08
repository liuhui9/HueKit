const colorPicker = document.getElementById("color-picker");
const hexInput = document.getElementById("hex-input");
const hexHelp = document.getElementById("hex-help");
const colorControl = document.querySelector(".color-control");
const schemeOptions = document.getElementById("scheme-options");
const schemeDescription = document.getElementById("scheme-description");
const paletteElement = document.getElementById("palette");
const preview = document.getElementById("preview");
const toast = document.getElementById("toast");

const descriptions = {
  analogous: "色相相近，过渡自然。",
  complementary: "冷暖呼应，对比更鲜明。",
  triadic: "三方平衡，画面更有活力。",
  monochrome: "同一色相，用明暗建立层次。",
};

let baseColor = "#5369D8";
let activeScheme = "analogous";
let currentPalette = [];
let toastTimer;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value) {
  const cleaned = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(cleaned)) {
    return `#${[...cleaned].map((digit) => digit + digit).join("").toUpperCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  return null;
}

function hexToRgb(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function rgbToHsl(red, green, blue) {
  const [r, g, b] = [red, green, blue].map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  const lightness = (max + min) / 2;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }
  return [((hue % 360) + 360) % 360, saturation * 100, lightness * 100];
}

function hslToHex(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const offset = l - chroma / 2;
  const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
  const [r, g, b] = sectors[Math.floor(h / 60) % 6];
  return rgbToHex((r + offset) * 255, (g + offset) * 255, (b + offset) * 255);
}

function createPalette(hex, scheme) {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  if (scheme === "monochrome") {
    const levels = [clamp(l + 36, 14, 91), clamp(l + 18, 12, 88), l, clamp(l - 18, 10, 83), clamp(l - 36, 8, 79)];
    return levels.map((level, index) => index === 2 ? hex : hslToHex(h, s, level));
  }

  const offsets = {
    analogous: [-36, -18, 0, 18, 36],
    complementary: [-24, 0, 0, 156, 180],
    triadic: [-120, -90, 0, 90, 120],
  }[scheme];
  const lightnessOffsets = [18, 9, 0, -9, -18];
  return offsets.map((offset, index) => index === 2
    ? hex
    : hslToHex(h + offset, s, clamp(l + lightnessOffsets[index], 17, 83)));
}

function readableInk(hex) {
  const linear = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.18 ? "#152238" : "#FFFFFF";
}

function setError(message) {
  colorControl.classList.toggle("is-invalid", Boolean(message));
  hexInput.setAttribute("aria-invalid", message ? "true" : "false");
  hexHelp.classList.toggle("is-error", Boolean(message));
  hexHelp.textContent = message || "支持 #RGB 或 #RRGGBB";
}

function render() {
  currentPalette = createPalette(baseColor, activeScheme);
  schemeDescription.textContent = descriptions[activeScheme];
  paletteElement.replaceChildren();

  currentPalette.forEach((hex, index) => {
    const item = document.createElement("div");
    item.className = "swatch";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch-button";
    button.style.setProperty("--swatch", hex);
    button.style.setProperty("--swatch-ink", readableInk(hex));
    button.dataset.hex = hex;
    button.setAttribute("aria-label", `复制颜色 ${hex}`);
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke-linecap="round" /></svg>';

    const label = document.createElement("div");
    label.className = "swatch-label";
    const value = document.createElement("span");
    value.textContent = hex;
    const order = document.createElement("span");
    order.textContent = String(index + 1).padStart(2, "0");
    label.append(value, order);
    item.append(button, label);
    paletteElement.append(item);
  });

  preview.style.setProperty("--preview-ground", currentPalette[4]);
  preview.style.setProperty("--preview-main", currentPalette[2]);
  preview.style.setProperty("--preview-ink", readableInk(currentPalette[2]));
  preview.style.setProperty("--preview-accent", currentPalette[0]);
  preview.style.setProperty("--preview-accent-ink", readableInk(currentPalette[0]));
  preview.style.setProperty("--preview-side", currentPalette[1]);
  preview.style.setProperty("--preview-side-ink", readableInk(currentPalette[1]));
  preview.style.setProperty("--preview-circle", currentPalette[4]);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

async function copyText(value, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const field = document.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("copy unavailable");
    }
    showToast(successMessage);
  } catch {
    showToast("复制失败，请手动选取色值");
  }
}

function applyColor(value) {
  const normalized = normalizeHex(value);
  if (!normalized) {
    setError("请输入有效的十六进制色值");
    return false;
  }
  setError("");
  baseColor = normalized;
  hexInput.value = normalized;
  colorPicker.value = normalized.toLowerCase();
  render();
  return true;
}

colorPicker.addEventListener("input", (event) => applyColor(event.target.value));
hexInput.addEventListener("input", () => {
  setError("");
  if (/^#?[0-9a-f]{6}$/i.test(hexInput.value.trim())) applyColor(hexInput.value);
});
hexInput.addEventListener("blur", () => applyColor(hexInput.value));
hexInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (applyColor(hexInput.value)) hexInput.blur();
  }
});
schemeOptions.addEventListener("change", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.name === "scheme") {
    activeScheme = event.target.value;
    render();
  }
});
document.getElementById("random-button").addEventListener("click", () => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 55 + Math.floor(Math.random() * 25);
  const lightness = 42 + Math.floor(Math.random() * 18);
  applyColor(hslToHex(hue, saturation, lightness));
});
paletteElement.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-hex]");
  if (button) copyText(button.dataset.hex, `已复制 ${button.dataset.hex}`);
});
document.getElementById("copy-all-button").addEventListener("click", () => {
  copyText(currentPalette.join("\n"), "已复制整组色值");
});

render();

if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: "generate_palette",
      title: "生成配色",
      description: "根据主色和搭配方式生成五色配色，并更新页面中的配色与预览。",
      inputSchema: {
        type: "object",
        properties: {
          color: { type: "string", description: "十六进制颜色，如 #5369D8" },
          scheme: { type: "string", enum: Object.keys(descriptions) },
        },
        required: ["color", "scheme"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input.color !== "string" || !normalizeHex(input.color)) {
          throw new Error("请输入有效的十六进制主色");
        }
        if (typeof input.scheme !== "string" || !Object.hasOwn(descriptions, input.scheme)) {
          throw new Error("请选择有效的搭配方式");
        }
        activeScheme = input.scheme;
        document.querySelector(`input[name="scheme"][value="${activeScheme}"]`).checked = true;
        applyColor(input.color);
        return { baseColor, scheme: activeScheme, colors: currentPalette };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
  } catch {
    // The browser can reject optional WebMCP registration without affecting the tool.
  }
}
