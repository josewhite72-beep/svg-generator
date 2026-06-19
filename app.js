"use strict";

/* ============================================================
   CONFIG Y CONSTANTES
   ============================================================ */
const DPR = 3; // factor de render para que las tarjetas salgan nitidas al imprimir
const PAGE_W = 210, PAGE_H = 297; // A4 en mm
const MARGIN = 10, GUTTER = 4;

const IMG_SIZE = 512; // tamano logico (cuadrado) de cada imagen-asset generada
const LESSON_W = 640;
const MODULE_W = 640;

const COLORS = {
  ink: "#322f63",
  inkSoft: "rgba(50,47,99,.72)",
  inkFaint: "rgba(50,47,99,.45)",
  paper: "#f8f7ff",
  line: "#d6ddf5",
  kraft: "#5b9bf0",
  stamp: "#9b7ff0",
  sage: "#4fb8c4",
};
const TAB_CYCLE = [COLORS.kraft, COLORS.sage, COLORS.stamp, COLORS.ink];

const FONTS = {
  title: "bold 27px Georgia, 'Times New Roman', serif",
  subtitle: "14px Arial, Helvetica, sans-serif",
  label: "bold 11px Arial, Helvetica, sans-serif",
  item: "14.5px Arial, Helvetica, sans-serif",
  row: "15px Arial, Helvetica, sans-serif",
};

const SAMPLE_TEXT = {
  vocab: `ephemeral | lasting a very short time | Fame in the internet age is often ephemeral.
ubiquitous | present everywhere | Smartphones are now ubiquitous.
serendipity | a happy accident | Finding that book was pure serendipity.
resilient | able to recover quickly | Children are remarkably resilient.
procrastination | the action of delaying something | He's a chronic procrastinator who always waits until the last minute.`,
  lesson: `Tema: Introduccion a la fotosintesis
Materia: Ciencias Naturales, 5to grado

Los estudiantes aprenderan que las plantas producen su propio alimento usando luz solar, agua y dioxido de carbono. Se identificara el papel de la clorofila y se distinguira entre la reaccion luminosa y el ciclo de Calvin. Actividades: observacion de hojas, diagrama del proceso, experimento con una planta en la oscuridad durante una semana, discusion sobre por que las plantas son verdes.`,
  module: `Unidad: Era Victoriana en la Literatura Inglesa, 6 lecciones.

Leccion 1: Charles Dickens. Vida y obra. Objetivo: conocer sus obras principales y su critica social. Contenido: Oliver Twist, David Copperfield, critica a la pobreza y el trabajo infantil.

Leccion 2: Las hermanas Bronte. Romance gotico. Objetivo: comparar Jane Eyre y Cumbres Borrascosas. Contenido: Charlotte, Emily y Anne Bronte, pasion e aislamiento.

Leccion 3: Thomas Hardy. Tragedia rural. Objetivo: analizar Tess of the d'Urbervilles. Contenido: novelas de Wessex, destino contra libre albedrio.`,
};

/* ============================================================
   ESTADO
   ============================================================ */
const state = {
  type: "vocab",
  inputMode: "file",
  rawText: "",
  words: [], // {word, definition} - lista editable antes de generar imagenes (modo vocab)
  cards: [], // {svg, pxW, pxH, label}
};

/* ============================================================
   ALMACENAMIENTO LOCAL
   ============================================================ */
const LS_KEY = "svgen_api_key";
const LS_MODEL = "svgen_model";
const LS_HF_TOKEN = "svgen_hf_token";
const LS_HF_MODEL = "svgen_hf_model";
const LS_IMG_PROVIDER = "svgen_img_provider";

function loadSavedConfig() {
  const key = localStorage.getItem(LS_KEY) || "";
  const model = localStorage.getItem(LS_MODEL) || "openai/gpt-oss-120b";
  document.getElementById("apiKey").value = key;
  document.getElementById("modelName").value = model;
  document.getElementById("keyStatus").textContent = key
    ? "Clave guardada en este dispositivo (" + key.slice(0, 6) + "...)."
    : "Tu clave se guarda en este dispositivo (localStorage) y nunca se envia a ningun servidor distinto de Groq.";

  const hfToken = localStorage.getItem(LS_HF_TOKEN) || "";
  const hfModel = localStorage.getItem(LS_HF_MODEL) || "black-forest-labs/FLUX.1-schnell";
  document.getElementById("hfToken").value = hfToken;
  document.getElementById("hfModel").value = hfModel;
  document.getElementById("hfStatus").textContent = hfToken
    ? "Token guardado en este dispositivo (" + hfToken.slice(0, 6) + "...)."
    : "Tu token se guarda solo en este dispositivo.";

  const provider = localStorage.getItem(LS_IMG_PROVIDER) || "puter";
  document.querySelectorAll("#imgProviderToggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.provider === provider);
  });
  document.getElementById("hfFields").style.display = provider === "hf" ? "" : "none";
}

document.getElementById("saveKeyBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("modelName").value.trim() || "openai/gpt-oss-120b";
  localStorage.setItem(LS_KEY, key);
  localStorage.setItem(LS_MODEL, model);
  document.getElementById("keyStatus").textContent = key
    ? "Clave guardada en este dispositivo (" + key.slice(0, 6) + "...)."
    : "Clave borrada.";
});

const saveHfBtnEl = document.getElementById("saveHfBtn");
if (saveHfBtnEl) saveHfBtnEl.addEventListener("click", () => {
  const token = document.getElementById("hfToken").value.trim();
  const model = document.getElementById("hfModel").value.trim() || "black-forest-labs/FLUX.1-schnell";
  localStorage.setItem(LS_HF_TOKEN, token);
  localStorage.setItem(LS_HF_MODEL, model);
  document.getElementById("hfStatus").textContent = token
    ? "Token guardado en este dispositivo (" + token.slice(0, 6) + "...)."
    : "Token borrado.";
});

document.querySelectorAll("#imgProviderToggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#imgProviderToggle button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const provider = btn.dataset.provider;
    localStorage.setItem(LS_IMG_PROVIDER, provider);
    document.getElementById("hfFields").style.display = provider === "hf" ? "" : "none";
  });
});

/* ============================================================
   LOG / ESTADO EN PANTALLA
   ============================================================ */
const logEl = document.getElementById("statusLog");
function log(msg, cls) {
  logEl.classList.add("show");
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}
function clearLog() {
  logEl.innerHTML = "";
  logEl.classList.remove("show");
}

/* ============================================================
   UI: TABS DE TIPO
   ============================================================ */
const TYPE_HINTS = {
  vocab: "Una palabra por linea: palabra | definicion | ejemplo. La IA extrae la lista de palabras; despues podras editarla antes de generar las imagenes.",
  lesson: "Un solo plan de leccion: titulo, objetivos y contenido (en cualquier formato libre).",
  module: "Varias lecciones juntas; la IA las separa automaticamente.",
};
const GENERATE_BTN_LABEL = {
  vocab: ["Extraer", "vocabulario"],
  lesson: ["Generar", "tarjeta"],
  module: ["Generar", "modulo"],
};
function setGenerateBtnLabel() {
  const [l1, l2] = GENERATE_BTN_LABEL[state.type];
  const elL1 = document.getElementById("generateBtnL1");
  const elL2 = document.getElementById("generateBtnL2");
  if (elL1) elL1.textContent = l1;
  if (elL2) elL2.textContent = l2;
}
document.querySelectorAll("#typeTabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#typeTabs .tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.type = btn.dataset.type;
    document.getElementById("typeHint").textContent = TYPE_HINTS[state.type];
    setGenerateBtnLabel();
    document.getElementById("wordListSection").style.display = "none";
  });
});
document.getElementById("typeHint").textContent = TYPE_HINTS.vocab;
setGenerateBtnLabel();

/* ============================================================
   UI: MODO DE ENTRADA (archivo / pegar texto)
   ============================================================ */
document.querySelectorAll(".mode-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-toggle button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.inputMode = btn.dataset.mode;
    document.getElementById("fileInputArea").style.display = state.inputMode === "file" ? "" : "none";
    document.getElementById("pasteInputArea").style.display = state.inputMode === "paste" ? "" : "none";
  });
});

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
let chosenFile = null;
fileInput.addEventListener("change", (e) => {
  chosenFile = e.target.files[0] || null;
  updateDropzoneLabel();
});
["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
);
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files[0];
  if (f) { chosenFile = f; fileInput.value = ""; updateDropzoneLabel(); }
});
function updateDropzoneLabel() {
  const txt = document.getElementById("dropzoneText");
  txt.innerHTML = chosenFile
    ? "Archivo listo: <span class='filename-chip'>" + chosenFile.name + "</span>"
    : "Toca para elegir un archivo Word o PDF<br>o arrastralo aqui";
}

document.getElementById("sampleBtn").addEventListener("click", () => {
  document.querySelector('.mode-toggle button[data-mode="paste"]').click();
  document.getElementById("pasteText").value = SAMPLE_TEXT[state.type];
});

document.getElementById("clearBtn").addEventListener("click", () => {
  chosenFile = null;
  fileInput.value = "";
  updateDropzoneLabel();
  document.getElementById("pasteText").value = "";
  state.cards = [];
  state.words = [];
  document.getElementById("wordListSection").style.display = "none";
  document.getElementById("wordChips").innerHTML = "";
  clearLog();
  document.getElementById("resultsSection").style.display = "none";
  document.getElementById("resultsGrid").innerHTML = "";
});

/* ============================================================
   LISTA EDITABLE DE PALABRAS (modo vocab)
   ============================================================ */
function renderWordChips() {
  const wrap = document.getElementById("wordChips");
  wrap.innerHTML = "";
  state.words.forEach((w, i) => {
    const chip = document.createElement("div");
    chip.className = "word-chip";
    const span = document.createElement("span");
    span.textContent = w.word;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "\u2715";
    btn.title = "Quitar";
    btn.addEventListener("click", () => {
      state.words.splice(i, 1);
      renderWordChips();
    });
    chip.appendChild(span);
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
  document.getElementById("wordListSection").style.display = state.words.length ? "" : "none";
}

const addWordBtnEl = document.getElementById("addWordBtn");
const newWordInputEl = document.getElementById("newWordInput");
if (addWordBtnEl) {
  addWordBtnEl.addEventListener("click", () => {
    const input = document.getElementById("newWordInput");
    const val = input.value.trim();
    if (!val) return;
    state.words.push({ word: val, definition: "" });
    input.value = "";
    renderWordChips();
  });
}
if (newWordInputEl) {
  newWordInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (addWordBtnEl) addWordBtnEl.click(); }
  });
}

/* ============================================================
   LECTURA DE ARCHIVOS
   ============================================================ */
async function readFileAsText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt") {
    return await file.text();
  }
  if (ext === "docx") {
    const buf = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }
  if (ext === "pdf") {
    if (!window.pdfjsLib) throw new Error("El lector de PDF todavia no ha cargado, intenta de nuevo en un momento.");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text;
  }
  throw new Error("Formato no soportado: ." + ext);
}

/* ============================================================
   LLAMADA A GROQ + EXTRACCION JSON
   ============================================================ */
const SYSTEM_PROMPTS = {
  vocab: `Eres un asistente que extrae listas de vocabulario de un texto educativo para generar tarjetas de estudio.
Devuelve UNICAMENTE un objeto JSON valido, sin texto adicional, sin bloques de markdown, con esta forma exacta:
{"words":[{"word":"...","phonetic":"...","pos":"...","definition":"...","example":"..."}]}
Reglas:
- Conserva el idioma original de cada palabra y su definicion; no traduzcas.
- "phonetic": transcripcion IPA si puedes inferirla con confianza, si no, cadena vacia "".
- "pos": categoria gramatical abreviada (noun, verb, adjective, adverb, etc.) o vacio si no aplica.
- "definition": una definicion breve y clara, apta para estudiantes.
- "example": una frase de ejemplo breve usando la palabra. Si el texto fuente ya trae un ejemplo, usalo; si no, crea uno simple y apropiado.
- Si el texto no trae una lista clara de palabras, identifica los terminos clave o vocabulario nuevo relevante del texto y construyelos tu.
Responde solo JSON.`,
  lesson: `Eres un asistente que organiza un plan de leccion en una estructura clara para una tarjeta visual.
Devuelve UNICAMENTE un objeto JSON valido, sin texto adicional, con esta forma exacta:
{"title":"...","subtitle":"...","objectives":["...","..."],"content":["...","..."]}
Reglas:
- "title": titulo principal de la leccion.
- "subtitle": materia, grado o contexto breve (cadena vacia "" si no hay informacion).
- "objectives": lista de objetivos de aprendizaje, frases breves, en el idioma original del texto.
- "content": lista de puntos clave de contenido o actividades, frases breves.
- Conserva el idioma original; no traduzcas.
- Si el texto no distingue explicitamente objetivos de contenido, infiere una division razonable.
Responde solo JSON.`,
  module: `Eres un asistente que organiza una unidad o modulo educativo con varias lecciones en una estructura clara.
Devuelve UNICAMENTE un objeto JSON valido, sin texto adicional, con esta forma exacta:
{"title":"...","subtitle":"...","lessons":[{"title":"...","subtitle":"...","objectives":["..."],"content":["..."]}]}
Reglas:
- "title"/"subtitle" del modulo completo (subtitle vacio "" si no hay informacion).
- Cada elemento de "lessons" sigue la misma estructura que una leccion individual.
- Conserva el idioma original; no traduzcas.
- Si el texto describe varias lecciones, secciones o temas separados, cada uno debe ser un elemento de "lessons".
Responde solo JSON.`,
};

function cleanJsonString(raw) {
  let s = raw.trim();
  s = s.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  return s.trim();
}

async function callGroq(systemPrompt, userText, apiKey, model) {
  const truncated = userText.length > 20000 ? userText.slice(0, 20000) : userText;
  if (userText.length > 20000) log("Documento largo: se usaron los primeros 20,000 caracteres.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncated },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Error de Groq (" + res.status + "): " + errText.slice(0, 300));
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message.content;
  if (!content) throw new Error("Groq no devolvio contenido.");
  return JSON.parse(cleanJsonString(content));
}

/* ============================================================
   MEDICION Y WRAP DE TEXTO (canvas, exacto via measureText)
   ============================================================ */
const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");

function wrapTextPx(text, maxWidthPx, font) {
  measureCtx.font = font;
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? current + " " + w : w;
    if (measureCtx.measureText(candidate).width <= maxWidthPx) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (measureCtx.measureText(w).width > maxWidthPx) {
        let piece = "";
        for (const ch of w) {
          if (piece && measureCtx.measureText(piece + ch + "-").width > maxWidthPx) {
            lines.push(piece + "-");
            piece = ch;
          } else {
            piece += ch;
          }
        }
        current = piece;
      } else {
        current = w;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/* ============================================================
   FORMAS AUXILIARES DE DIBUJO
   ============================================================ */
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawCheckbox(ctx, x, y, size) {
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.4;
  roundedRect(ctx, x, y, size, size, 2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.2, y + size * 0.55);
  ctx.lineTo(x + size * 0.42, y + size * 0.78);
  ctx.lineTo(x + size * 0.82, y + size * 0.22);
  ctx.strokeStyle = COLORS.sage;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}
function drawBullet(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = COLORS.kraft;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ============================================================
   CANVAS -> SVG (sin elementos de texto: todo queda como imagen)
   ============================================================ */
function canvasToSvgImage(canvas, logicalW, logicalH) {
  const dataUrl = canvas.toDataURL("image/png");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + logicalW + '" height="' + logicalH +
    '" viewBox="0 0 ' + logicalW + " " + logicalH + '">' +
    '<image href="' + dataUrl + '" x="0" y="0" width="' + logicalW + '" height="' + logicalH + '"/>' +
    "</svg>";
  return { svg, pxW: logicalW, pxH: logicalH };
}

/* ============================================================
   TARJETA: LECCION
   ============================================================ */
function layoutLessonCard(lesson) {
  const W = LESSON_W;
  const padX = 44;
  const maxTextW = W - padX * 2;
  const itemTextW = maxTextW - 22; // resta el ancho del icono (checkbox/bullet) + su margen
  const TITLE_LH = 32;

  const titleLines = wrapTextPx(lesson.title || "Sin titulo", maxTextW, FONTS.title);
  const objLines = (lesson.objectives || []).map((o) => wrapTextPx(o, itemTextW, FONTS.item));
  const contLines = (lesson.content || []).map((c) => wrapTextPx(c, itemTextW, FONTS.item));

  let y = 54;
  const titleY = y;
  y += (titleLines.length - 1) * TITLE_LH; // espacio extra si el titulo ocupa mas de una linea
  y += 30;

  let subtitleY = null;
  if (lesson.subtitle) {
    subtitleY = y;
    y += 22;
  }

  const ruleY = y;
  y += 30;

  const objStartY = y;
  const objRowHeights = objLines.map((lines) => Math.max(20, lines.length * 19) + 12);
  objRowHeights.forEach((h) => (y += h));
  y += 14;

  const contStartY = y;
  const contRowHeights = contLines.map((lines) => Math.max(20, lines.length * 19) + 12);
  contRowHeights.forEach((h) => (y += h));
  y += 26;

  return {
    W, H: Math.max(220, y), padX,
    titleLines, titleY, TITLE_LH,
    subtitleY, ruleY,
    objStartY, objLines, objRowHeights,
    contStartY, contLines, contRowHeights,
  };
}

function drawLessonCard(lesson, accentIdx) {
  const L = layoutLessonCard(lesson);
  const canvas = document.createElement("canvas");
  canvas.width = L.W * DPR;
  canvas.height = L.H * DPR;
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);

  roundedRect(ctx, 0, 0, L.W, L.H, 14);
  ctx.fillStyle = COLORS.paper;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.ink;
  roundedRect(ctx, 1, 1, L.W - 2, L.H - 2, 13);
  ctx.stroke();

  const accent = TAB_CYCLE[accentIdx % TAB_CYCLE.length];
  ctx.fillStyle = accent;
  roundedRect(ctx, 0, 18, 7, L.H - 36, 3);
  ctx.fill();

  ctx.textBaseline = "alphabetic";
  ctx.font = FONTS.title;
  ctx.fillStyle = COLORS.ink;
  L.titleLines.forEach((line, i) => ctx.fillText(line, L.padX, L.titleY + i * L.TITLE_LH));

  if (lesson.subtitle && L.subtitleY) {
    ctx.font = FONTS.subtitle;
    ctx.fillStyle = COLORS.inkSoft;
    ctx.fillText(lesson.subtitle, L.padX, L.subtitleY);
  }

  ctx.strokeStyle = COLORS.line;
  ctx.beginPath();
  ctx.moveTo(L.padX, L.ruleY);
  ctx.lineTo(L.W - L.padX, L.ruleY);
  ctx.stroke();

  ctx.font = FONTS.label;
  ctx.fillStyle = COLORS.kraft;
  ctx.fillText("OBJETIVOS", L.padX, L.objStartY - 14);

  let oy = L.objStartY;
  ctx.font = FONTS.item;
  L.objLines.forEach((lines, idx) => {
    drawCheckbox(ctx, L.padX, oy - 11, 13);
    ctx.fillStyle = COLORS.ink;
    lines.forEach((line, i) => ctx.fillText(line, L.padX + 22, oy + i * 19));
    oy += L.objRowHeights[idx];
  });

  ctx.font = FONTS.label;
  ctx.fillStyle = COLORS.kraft;
  ctx.fillText("CONTENIDO", L.padX, L.contStartY - 14);

  let cy = L.contStartY;
  ctx.font = FONTS.item;
  L.contLines.forEach((lines, idx) => {
    drawBullet(ctx, L.padX + 5, cy - 5, 3.4);
    ctx.fillStyle = COLORS.ink;
    lines.forEach((line, i) => ctx.fillText(line, L.padX + 22, cy + i * 19));
    cy += L.contRowHeights[idx];
  });

  return canvasToSvgImage(canvas, L.W, L.H);
}

/* ============================================================
   TARJETA: PORTADA DE MODULO
   ============================================================ */
function layoutModuleOverview(mod) {
  const W = MODULE_W;
  const padX = 44;
  const TITLE_LH = 32;
  const titleLines = wrapTextPx(mod.title || "Modulo", W - padX * 2, FONTS.title);
  const subtitleLines = mod.subtitle ? wrapTextPx(mod.subtitle, W - padX * 2, FONTS.subtitle) : [];
  const rows = (mod.lessons || []).map((l, i) =>
    wrapTextPx((i + 1) + ". " + (l.title || "Leccion " + (i + 1)), W - padX * 2 - 16, FONTS.row)
  );

  let y = 56;
  const titleY = y;
  y += (titleLines.length - 1) * TITLE_LH;
  y += 28;

  let subtitleY = null;
  if (subtitleLines.length) {
    subtitleY = y;
    y += (subtitleLines.length - 1) * 20;
    y += 24;
  }

  const ruleY = y;
  y += 26;
  const rowsStartY = y;
  const rowHeights = rows.map((lines) => Math.max(34, lines.length * 18 + 18));
  rowHeights.forEach((h) => (y += h + 8));
  y += 14;
  return {
    W, H: Math.max(220, y), padX,
    titleLines, titleY, TITLE_LH,
    subtitleLines, subtitleY,
    ruleY, rowsStartY, rows, rowHeights,
  };
}

function drawModuleOverview(mod) {
  const L = layoutModuleOverview(mod);
  const canvas = document.createElement("canvas");
  canvas.width = L.W * DPR;
  canvas.height = L.H * DPR;
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);

  roundedRect(ctx, 0, 0, L.W, L.H, 16);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.font = FONTS.title;
  ctx.fillStyle = COLORS.paper;
  L.titleLines.forEach((line, i) => ctx.fillText(line, L.W / 2, L.titleY + i * L.TITLE_LH));

  if (L.subtitleLines.length && L.subtitleY) {
    ctx.font = FONTS.subtitle;
    ctx.fillStyle = "rgba(251,248,240,.7)";
    L.subtitleLines.forEach((line, i) => ctx.fillText(line, L.W / 2, L.subtitleY + i * 20));
  }
  ctx.textAlign = "left";

  ctx.strokeStyle = "rgba(251,248,240,.3)";
  ctx.beginPath();
  ctx.moveTo(L.padX, L.ruleY);
  ctx.lineTo(L.W - L.padX, L.ruleY);
  ctx.stroke();

  let ry = L.rowsStartY;
  L.rows.forEach((lines, idx) => {
    const h = L.rowHeights[idx];
    roundedRect(ctx, L.padX, ry - 22, L.W - L.padX * 2, h, 8);
    ctx.fillStyle = "rgba(251,248,240,.08)";
    ctx.fill();
    ctx.font = FONTS.row;
    ctx.fillStyle = COLORS.paper;
    lines.forEach((line, i) => ctx.fillText(line, L.padX + 14, ry + i * 18));
    ry += h + 8;
  });

  return canvasToSvgImage(canvas, L.W, L.H);
}

/* ============================================================
   PAGINACION (cuadricula vocab / apilado lesson-modulo)
   ============================================================ */
function paginateVocab(cards, cols = 3, rows = 4) {
  const cellW = (PAGE_W - 2 * MARGIN - (cols - 1) * GUTTER) / cols;
  const cellH = (PAGE_H - 2 * MARGIN - (rows - 1) * GUTTER) / rows;
  const perPage = cols * rows;
  const pages = [];
  for (let i = 0; i < cards.length; i += perPage) {
    const slice = cards.slice(i, i + perPage);
    const page = slice.map((card, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = MARGIN + col * (cellW + GUTTER);
      const y = MARGIN + row * (cellH + GUTTER);
      const scale = Math.min(cellW / card.pxW, cellH / card.pxH);
      const w = card.pxW * scale, h = card.pxH * scale;
      return { card, x: x + (cellW - w) / 2, y: y + (cellH - h) / 2, width: w, height: h };
    });
    pages.push(page);
  }
  return pages;
}

function paginateStacked(cards, fixedWidthMm = PAGE_W - 2 * MARGIN) {
  const usableH = PAGE_H - 2 * MARGIN;
  const pages = [];
  let current = [];
  let cursorY = MARGIN;
  for (const card of cards) {
    const scale = fixedWidthMm / card.pxW;
    let h = card.pxH * scale;
    if (h > usableH) {
      const shrink = usableH / card.pxH;
      const w2 = card.pxW * shrink;
      if (current.length) { pages.push(current); current = []; cursorY = MARGIN; }
      pages.push([{ card, x: MARGIN + (fixedWidthMm - w2) / 2, y: MARGIN, width: w2, height: usableH }]);
      continue;
    }
    if (cursorY + h > MARGIN + usableH) {
      pages.push(current);
      current = [];
      cursorY = MARGIN;
    }
    current.push({ card, x: MARGIN, y: cursorY, width: fixedWidthMm, height: h });
    cursorY += h + GUTTER;
  }
  if (current.length) pages.push(current);
  return pages;
}

/* ============================================================
   GENERAR (orquesta todo)
   ============================================================ */
const generateBtn = document.getElementById("generateBtn");

generateBtn.addEventListener("click", async () => {
  clearLog();
  document.getElementById("resultsGrid").innerHTML = "";
  document.getElementById("resultsSection").style.display = "none";
  state.cards = [];

  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("modelName").value.trim() || "openai/gpt-oss-120b";
  if (!apiKey) { log("Falta tu API key de Groq.", "err"); return; }

  generateBtn.disabled = true;
  try {
    let rawText = "";
    if (state.inputMode === "file") {
      if (!chosenFile) { log("Elige un archivo primero.", "err"); generateBtn.disabled = false; return; }
      log("Leyendo " + chosenFile.name + " ...");
      rawText = await readFileAsText(chosenFile);
    } else {
      rawText = document.getElementById("pasteText").value;
      if (!rawText.trim()) { log("Pega o escribe texto primero.", "err"); generateBtn.disabled = false; return; }
    }
    if (!rawText.trim()) { log("No se pudo extraer texto del documento.", "err"); generateBtn.disabled = false; return; }
    log("Texto extraido (" + rawText.length + " caracteres).", "ok");

    log("Consultando IA (Groq) para extraer la estructura...");
    const data = await callGroq(SYSTEM_PROMPTS[state.type], rawText, apiKey, model);
    log("Datos extraidos correctamente.", "ok");

    if (state.type === "vocab") {
      const words = data.words || [];
      if (!words.length) throw new Error("La IA no devolvio palabras de vocabulario.");
      state.words = words.map((w) => ({ word: w.word, definition: w.definition || "" }));
      renderWordChips();
      log("Lista lista para revisar abajo: quita o agrega palabras y luego genera las imagenes.", "ok");
    } else if (state.type === "lesson") {
      log("Dibujando tarjeta...");
      const card = drawLessonCard(data, 0);
      state.cards = [{ ...card, label: data.title || "Leccion" }];
      renderResults(state.cards);
      log("Listo: 1 tarjeta generada.", "ok");
    } else {
      log("Dibujando tarjetas...");
      const cards = [];
      const overview = drawModuleOverview(data);
      cards.push({ ...overview, label: data.title || "Modulo (portada)" });
      (data.lessons || []).forEach((l, i) => {
        const card = drawLessonCard(l, i);
        cards.push({ ...card, label: l.title || "Leccion " + (i + 1) });
      });
      state.cards = cards;
      renderResults(cards);
      log("Listo: " + cards.length + " tarjeta(s) generada(s).", "ok");
    }
  } catch (err) {
    console.error(err);
    log("Error: " + err.message, "err");
  } finally {
    generateBtn.disabled = false;
  }
});

/* ============================================================
   IMAGEN-ASSET (Puter.js o Hugging Face) - modo vocab
   ============================================================ */
function buildImagePrompt(w) {
  let p = 'Simple flat colorful cartoon/comic-style illustration of "' + w.word + '"';
  if (w.definition) p += " (" + w.definition + ")";
  p += ". Centered single subject, clean comic asset style, plain background, no text, no letters, no watermark, no signature.";
  return p;
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen recibida."));
    img.src = url;
  });
}

function base64ToBlob(base64, contentType) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: contentType || "image/jpeg" });
}

async function callHuggingFaceImage(prompt, token, model) {
  // Le habla a nuestra propia funcion /api/hf-image (mismo origen, sin CORS),
  // que a su vez le habla a Hugging Face desde el servidor.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("/api/hf-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, token }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error("Respuesta invalida del servidor (" + res.status + "). ¿Se subio la carpeta api/hf-image.js a Vercel?");
    }
    if (res.ok && data.image_base64) {
      const blob = base64ToBlob(data.image_base64, data.content_type);
      return await blobToImage(blob);
    }
    if (res.status === 503 && data.estimated_time) {
      const wait = Math.min(20000, Math.ceil(data.estimated_time * 1000) + 500);
      log("Modelo cargando en Hugging Face, esperando " + Math.round(wait / 1000) + "s...");
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    function flattenDetail(d) {
      if (!d) return "";
      let s = d.message + (d.code ? " [" + d.code + "]" : "");
      if (d.cause) s += " <- " + flattenDetail(d.cause);
      return s;
    }
    const extra = data.detail ? flattenDetail(data.detail) : (data.cause || "");
    throw new Error("Hugging Face (" + res.status + "): " + String(data.error || JSON.stringify(data)).slice(0, 150) + (extra ? " | " + extra : ""));
  }
  throw new Error("El modelo de Hugging Face sigue cargando. Intenta de nuevo en un minuto.");
}

async function generateOneImage(prompt) {
  const activeBtn = document.querySelector("#imgProviderToggle button.active");
  const provider = activeBtn ? activeBtn.dataset.provider : "puter";
  if (provider === "hf") {
    const token = document.getElementById("hfToken").value.trim();
    const model = document.getElementById("hfModel").value.trim() || "black-forest-labs/FLUX.1-schnell";
    if (!token) throw new Error("Falta tu token de Hugging Face (guardalo arriba primero).");
    return await callHuggingFaceImage(prompt, token, model);
  }
  if (!window.puter || !window.puter.ai || !window.puter.ai.txt2img) {
    throw new Error("Puter.js todavia no ha cargado. Espera un momento e intenta de nuevo.");
  }
  return await window.puter.ai.txt2img(prompt, { model: "gemini-2.5-flash-image-preview" });
}

function drawImageCard(imgEl) {
  const canvas = document.createElement("canvas");
  canvas.width = IMG_SIZE * DPR;
  canvas.height = IMG_SIZE * DPR;
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);
  // "cover" fit: recorta al centro para llenar el cuadro sin deformar la imagen
  const iw = imgEl.naturalWidth || imgEl.width;
  const ih = imgEl.naturalHeight || imgEl.height;
  const scale = Math.max(IMG_SIZE / iw, IMG_SIZE / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(imgEl, (IMG_SIZE - dw) / 2, (IMG_SIZE - dh) / 2, dw, dh);
  return canvasToSvgImage(canvas, IMG_SIZE, IMG_SIZE);
}

const generateImagesBtnEl = document.getElementById("generateImagesBtn");
if (generateImagesBtnEl) generateImagesBtnEl.addEventListener("click", async () => {
  if (!state.words.length) { log("No hay palabras en la lista.", "err"); return; }
  document.getElementById("resultsGrid").innerHTML = "";
  document.getElementById("resultsSection").style.display = "none";
  state.cards = [];
  const btn = document.getElementById("generateImagesBtn");
  btn.disabled = true;
  clearLog();
  let okCount = 0;
  for (let i = 0; i < state.words.length; i++) {
    const w = state.words[i];
    log("Generando imagen " + (i + 1) + "/" + state.words.length + ": " + w.word + " ...");
    try {
      const prompt = buildImagePrompt(w);
      const imgEl = await generateOneImage(prompt);
      const card = drawImageCard(imgEl);
      state.cards.push({ ...card, label: w.word });
      okCount++;
      renderResults(state.cards); // se actualiza tras CADA imagen: nada se pierde si algo falla a mitad de camino
    } catch (err) {
      console.error(err);
      log("Error en \"" + w.word + "\": " + err.message, "err");
      log("Se detuvo aqui. Lo generado hasta ahora (" + okCount + ") esta guardado abajo; puedes descargarlo, o cambiar de proveedor arriba y tocar \"Generar imagenes\" otra vez (quita primero de la lista las palabras ya generadas).", "err");
      break;
    }
  }
  if (okCount === state.words.length) log("Listo: " + okCount + " imagen(es) generada(s).", "ok");
  btn.disabled = false;
});

/* ============================================================
   RESULTADOS EN PANTALLA + DESCARGA INDIVIDUAL
   ============================================================ */
function renderResults(cards) {
  const grid = document.getElementById("resultsGrid");
  grid.innerHTML = "";
  document.getElementById("cardCount").textContent = cards.length;
  cards.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "card-thumb";
    const img = document.createElement("img");
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(c.svg)));
    div.appendChild(img);
    const meta = document.createElement("div");
    meta.className = "meta";
    const span = document.createElement("span");
    span.textContent = c.label;
    const dlBtn = document.createElement("button");
    dlBtn.className = "btn btn-small";
    dlBtn.textContent = "SVG";
    dlBtn.addEventListener("click", () => downloadSvg(c.svg, slugify(c.label) + ".svg"));
    meta.appendChild(span);
    meta.appendChild(dlBtn);
    div.appendChild(meta);
    grid.appendChild(div);
  });
  document.getElementById("resultsSection").style.display = "";
}

function slugify(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tarjeta";
}

function downloadSvg(svgString, filename) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   EXPORTAR HOJA PDF (jsPDF + svg2pdf, cada tarjeta es <image>)
   ============================================================ */
document.getElementById("downloadPdfBtn").addEventListener("click", async () => {
  if (!state.cards.length) return;
  const btn = document.getElementById("downloadPdfBtn");
  btn.disabled = true;
  btn.textContent = "Generando PDF...";
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pages = state.type === "vocab" ? paginateVocab(state.cards) : paginateStacked(state.cards);
    const sandbox = document.getElementById("svgSandbox");

    for (let p = 0; p < pages.length; p++) {
      if (p > 0) pdf.addPage();
      for (const cell of pages[p]) {
        const doc = new DOMParser().parseFromString(cell.card.svg, "image/svg+xml");
        const svgEl = doc.documentElement;
        sandbox.appendChild(svgEl);
        await pdf.svg(svgEl, { x: cell.x, y: cell.y, width: cell.width, height: cell.height });
        sandbox.removeChild(svgEl);
      }
    }
    pdf.save("tarjetas-" + state.type + ".pdf");
  } catch (err) {
    console.error(err);
    log("Error generando el PDF: " + err.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Descargar hoja PDF";
  }
});

/* ============================================================
   DESCARGAR TODO EN ZIP (cada imagen ya como archivo separado)
   ============================================================ */
document.getElementById("downloadZipBtn").addEventListener("click", async () => {
  if (!state.cards.length) return;
  const btn = document.getElementById("downloadZipBtn");
  btn.disabled = true;
  btn.textContent = "Empaquetando...";
  try {
    const zip = new JSZip();
    const usedNames = {};
    state.cards.forEach((card) => {
      let name = slugify(card.label) + ".svg";
      if (usedNames[name] != null) {
        usedNames[name]++;
        name = slugify(card.label) + "-" + usedNames[name] + ".svg";
      } else {
        usedNames[name] = 0;
      }
      zip.file(name, card.svg);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imagenes-" + state.type + ".zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    log("Error empaquetando el ZIP: " + err.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Descargar todo (ZIP)";
  }
});

/* ============================================================
   INICIO
   ============================================================ */
try {
  loadSavedConfig();
} catch (err) {
  console.error("loadSavedConfig fallo (posible desajuste de cache):", err);
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
