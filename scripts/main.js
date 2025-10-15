const manifestPath = "assets/manifest.json";

// fallback (จะถูก normalize อีกที)
const orderFallback = [
  "Body",
  "Eyes",
  "Mouth",
  "Hair",
  "Shirt",
  "Pants",
  "Shoes",
];

const ICONS = {
  Body: "🧍",
  Eyes: "👀",
  Mouth: "👄",
  Hair: "💇",
  Hair2: "💇‍♀️",
  Shirt: "👕",
  Pants: "👖",
  Shoes: "👟",
};

const TH_LABEL = {
  Eyes: "ดวงตา",
  Mouth: "ปาก",
  Hair: "ผม",
  Hair2: "ผมหญิง",
  Shirt: "เสื้อ",
  Pants: "กางเกง",
  Shoes: "รองเท้า",
};

const PAGE_SIZE = 8;

const state = {
  currentCat: "Eyes",
  pageByCat: {},
  selection: {
    Body: "",
    Eyes: "",
    Mouth: "",
    Hair: "",
    Hair2: "",
    Shirt: "",
    Pants: "",
    Shoes: "",
  },
};

// normalize category names from manifest/order/icons
const CANON = {
  body: "Body",
  eyes: "Eyes",
  mouth: "Mouth",
  hair: "Hair",
  hair2: "Hair2",
  top: "Shirt",
  shirt: "Shirt",
  bottom: "Pants",
  pants: "Pants",
  shoes: "Shoes",
};
function canonicalCat(c) {
  const k = String(c || "").toLowerCase();
  return CANON[k] || String(c || "");
}

async function loadManifest() {
  try {
    const res = await fetch(manifestPath);
    if (!res.ok) throw new Error("manifest not found");
    return await res.json();
  } catch (e) {
    console.warn("Failed to load manifest, using fallback. Reason:", e);
    return { order: orderFallback, parts: {} };
  }
}

function createLayer(id, src) {
  const img = document.createElement("img");
  img.id = id;
  img.alt = id;
  img.src = encodeURI(src || "");
  img.className = "absolute inset-0 w-full h-full object-contain";
  return img;
}

function buildNormalizedOrder(manifest) {
  const raw = Array.isArray(manifest.order) ? manifest.order : orderFallback;
  const norm = [];
  const seen = new Set();
  raw.map(canonicalCat).forEach((c) => {
    if (!seen.has(c)) {
      seen.add(c);
      norm.push(c);
    }
  });
  // ถ้าใน parts.Hair มี female ให้แทรก Hair2 ต่อจาก Hair (ถ้ายังไม่มีใน order)
  const hasFemale =
    Array.isArray(manifest?.parts?.Hair?.female) &&
    manifest.parts.Hair.female.length > 0;
  if (hasFemale && !seen.has("Hair2")) {
    const iHair = norm.indexOf("Hair");
    if (iHair >= 0) norm.splice(iHair + 1, 0, "Hair2");
    else norm.push("Hair2");
  }
  return norm;
}

function stageEnsureLayers(order) {
  const stage = document.getElementById("stage");
  stage.innerHTML = "";
  order.forEach((cat) => {
    const id = `layer-${cat.toLowerCase()}`;
    const img = createLayer(id, "");
    img.dataset.category = cat;
    stage.appendChild(img);
  });
  // เผื่อกรณี order ไม่มี Hair2 ก็ยังมีเลเยอร์ไว้ให้
  if (!document.getElementById("layer-hair2")) {
    stage.appendChild(createLayer("layer-hair2", ""));
  }
}

function getItemsForCategory(manifest, cat) {
  const c = canonicalCat(cat);
  if (c === "Hair") {
    const h = manifest.parts?.Hair;
    return Array.isArray(h?.male) ? h.male : [];
  }
  if (c === "Hair2") {
    const h = manifest.parts?.Hair;
    return Array.isArray(h?.female) ? h.female : [];
  }
  const items =
    c === "Shirt"
      ? manifest.parts?.Shirt
      : c === "Pants"
      ? manifest.parts?.Pants
      : manifest.parts?.[c];
  return Array.isArray(items) ? items : [];
}

function resolveIconForCat(manifest, cat) {
  const c = canonicalCat(cat);
  // explicit mapping first
  const map = manifest.iconsMap || {};
  if (map[c]) return map[c];
  if (map[c.toLowerCase()]) return map[c.toLowerCase()];

  // fallback: search manifest.icon by filename alias
  const list = Array.isArray(manifest.icon) ? manifest.icon : [];
  const aliases = {
    Eyes: ["eye", "eyes"],
    Mouth: ["mouth", "lip", "lips"],
    Hair: ["hair"],
    Hair2: ["hair2", "female"],
    Shirt: ["shirt", "top"],
    Pants: ["pants", "bottom", "trousers", "skirt"],
    Shoes: ["shoe", "shoes", "sneaker", "boots"],
  };
  const a = aliases[c] || [c.toLowerCase()];
  const found = list.find((src) => {
    const s = String(src).toLowerCase();
    return a.some((k) => s.includes(k));
  });
  return found || "";
}

// empty.png resolver
function resolveEmptySrc(manifest) {
  const list = manifest?.parts?.empty || manifest?.parts?.Empty;
  return Array.isArray(list) && list[0] ? list[0] : "assets/empty.png";
}

// ---------- Tab bar UX ----------
function ensureTabBarStyles() {
  if (!document.getElementById("css-no-scrollbar")) {
    const style = document.createElement("style");
    style.id = "css-no-scrollbar";
    style.textContent = `
      .no-scrollbar::-webkit-scrollbar{ display:none; }
      .no-scrollbar{ -ms-overflow-style:none; scrollbar-width:none; }
    `;
    document.head.appendChild(style);
  }
  const bar = document.getElementById("tabBar");
  if (!bar) return;
  bar.classList.add(
    "flex",
    "items-start",
    "gap-6",
    "overflow-x-auto",
    "whitespace-nowrap",
    "scroll-smooth",
    "px-4",
    "py-2",
    "no-scrollbar"
  );
}

function scrollActiveTabIntoView() {
  const bar = document.getElementById("tabBar");
  if (!bar) return;
  const active = bar.querySelector(`button[data-cat="${state.currentCat}"]`);
  if (!active) return;
  const target = active.offsetLeft - (bar.clientWidth - active.clientWidth) / 2;
  const next = Math.max(0, Math.min(target, bar.scrollWidth - bar.clientWidth));
  if (Math.abs(bar.scrollLeft - next) > 4) {
    bar.scrollTo({ left: next, behavior: "smooth" });
  }
}

function buildTabs(manifest) {
  const order = buildNormalizedOrder(manifest).filter((c) => c !== "Body"); // ไม่ให้เลือก Body

  const tabBar = document.getElementById("tabBar");
  if (!tabBar) return;
  tabBar.innerHTML = "";
  ensureTabBarStyles();

  order.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.cat = cat;
    btn.className =
      "shrink-0 flex flex-col items-center px-3 py-2 focus:outline-none";

    const iconSrc = resolveIconForCat(manifest, cat);
    const iconHTML = iconSrc
      ? `<div class="w-16 h-16 rounded-lg flex items-center justify-center">
           <img src="${encodeURI(
             iconSrc
           )}" alt="${cat} icon" class="max-w-[74%] max-h-[74%] object-contain block">
         </div>`
      : `<div class="w-16 h-16 rounded-lg flex items-center justify-center  text-2xl">
           ${ICONS[cat] || "🔹"}
         </div>`;

    const label = TH_LABEL[cat] || cat;
    btn.innerHTML = `${iconHTML}<div class="mt-1 text-sm text-center text-slate-800">${label}</div>`;

    btn.addEventListener("click", () => {
      state.currentCat = cat;
      state.pageByCat[cat] = 0;
      renderGrid(manifest);
      updateTabActive();
      scrollActiveTabIntoView();
    });

    tabBar.appendChild(btn);
  });

  updateTabActive();
  scrollActiveTabIntoView();
}

function updateTabActive() {
  const buttons = document.querySelectorAll("#tabBar button");
  buttons.forEach((b) => {
    const active = b.dataset.cat === state.currentCat;
    if (active) {
      b.classList.add("bg-white/50", "shadow");
    } else {
      b.classList.remove("bg-white/50", "shadow");
    }
  });
}

// ---------- Grid ----------
function renderGrid(manifest) {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";

  const cat = state.currentCat;
  const list = getItemsForCategory(manifest, cat);
  const page = state.pageByCat[cat] || 0;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  // none tile (กากบาท)
  const noneTile = document.createElement("button");
  noneTile.type = "button";
  noneTile.className =
    "relative aspect-square rounded-md border flex items-center justify-center text-xs text-slate-600 hover:bg-slate-50";
  noneTile.innerHTML =
    '<span class="text-red-600 font-semibold text-lg">×</span><span class="sr-only">None</span>';
  noneTile.addEventListener("click", () => selectItem(cat, ""));
  grid.appendChild(noneTile);

  pageItems.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "relative aspect-square rounded-md border overflow-hidden bg-white hover:bg-slate-50";
    const img = document.createElement("img");
    img.src = encodeURI(p);
    img.alt = p;
    img.className = "absolute inset-0 w-full h-full object-contain";
    btn.appendChild(img);

    const isSelected = state.selection[canonicalCat(cat)] === p;
    if (isSelected) {
      const badge = document.createElement("div");
      badge.className =
        "absolute top-1 right-1 w-5 h-5 rounded-full bg-[#B8A9FF] text-white text-[10px] flex items-center justify-center";
      badge.textContent = "✓";
      btn.appendChild(badge);
      btn.classList.add("ring-2", "ring-[#B8A9FF]" , "shadow-xl");
    }

    btn.addEventListener("click", () => selectItem(cat, p));
    grid.appendChild(btn);
  });

  const pager = document.getElementById("pager");
  if (pager)
    pager.textContent = `${Math.min(page + 1, totalPages)} / ${totalPages}`;
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  if (btnPrev) btnPrev.disabled = page <= 0;
  if (btnNext) btnNext.disabled = page >= totalPages - 1;
}

// ---------- Selection / actions ----------
function selectItem(cat, path) {
  const c = canonicalCat(cat);
  if (c === "Body") return; // ปลอดภัยไว้ก่อน: ไม่ให้เปลี่ยน/ล้าง Body

  const emptySrc = window.__emptySrc || "assets/empty.png";
  state.selection[c] = path || "";

  const img = document.getElementById(`layer-${c.toLowerCase()}`);
  if (img) img.src = path ? encodeURI(path) : encodeURI(emptySrc);

  if (window.__manifestCache) renderGrid(window.__manifestCache);
}

function randomize(manifest) {
  const order = buildNormalizedOrder(manifest).filter((c) => c !== "Body");
  const emptySrc = window.__emptySrc || "assets/empty.png";
  order.forEach((cat) => {
    const list = getItemsForCategory(manifest, cat);
    const pick = list.length
      ? list[Math.floor(Math.random() * list.length)]
      : "";
    state.selection[cat] = pick || "";
    const img = document.getElementById(`layer-${cat.toLowerCase()}`);
    if (img) img.src = pick ? encodeURI(pick) : encodeURI(emptySrc);
  });
  if (window.__manifestCache) renderGrid(window.__manifestCache);
}

function resetAll() {
  // คง Body เดิมไว้ และตั้งหมวดอื่นเป็น empty.png
  const bodySrc = state.selection.Body || "";
  const emptySrc = window.__emptySrc || "assets/empty.png";

  Object.keys(state.selection).forEach((k) => {
    if (k !== "Body") state.selection[k] = "";
  });

  document.querySelectorAll("#stage img").forEach((img) => {
    if (img.id === "layer-body") {
      img.src = bodySrc ? encodeURI(bodySrc) : "";
    } else {
      img.src = encodeURI(emptySrc);
    }
  });

  if (window.__manifestCache) renderGrid(window.__manifestCache);
}

// ---------- Export ----------
function exportPng() {
  const stage = document.getElementById("stage");
  const rect = stage.getBoundingClientRect();
  const W = Math.max(1, Math.round(rect.width));
  const H = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false; // คมสำหรับพิกเซลอาร์ต

  const imgs = Array.from(stage.querySelectorAll("img"));
  const promises = imgs.map(
    (img) =>
      new Promise((resolve) => {
        if (!img.src) return resolve();
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => {
          const sw = i.naturalWidth || i.width;
          const sh = i.naturalHeight || i.height;
          // emulate CSS object-contain
          const scale = Math.min(W / sw, H / sh);
          const dw = Math.round(sw * scale);
          const dh = Math.round(sh * scale);
          const dx = Math.round((W - dw) / 2);
          const dy = Math.round((H - dh) / 2);
          ctx.drawImage(i, dx, dy, dw, dh);
          resolve();
        };
        i.onerror = () => resolve();
        i.src = img.src;
      })
  );

  Promise.all(promises).then(() => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "character.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  });
}

// ---------- Init ----------
(async function init() {
  const manifest = await loadManifest();
  const orderNorm = buildNormalizedOrder(manifest); // รวม Body + Hair2 สำหรับ stage
  stageEnsureLayers(orderNorm);
  buildTabs(manifest);
  window.__manifestCache = manifest;

  // เก็บ path ของ empty.png ไว้ใช้ทั่วแอป
  window.__emptySrc = resolveEmptySrc(manifest);

  // ตั้งค่า Body ให้แสดงเสมอ (ใช้รูปแรกจาก parts.Body)
  const bodyList = Array.isArray(manifest.parts?.Body)
    ? manifest.parts.Body
    : [];
  const bodySrc = bodyList[0] || "";
  state.selection.Body = bodySrc;
  const bodyImg = document.getElementById("layer-body");
  if (bodyImg) bodyImg.src = bodySrc ? encodeURI(bodySrc) : "";

  // ตั้งหมวดเริ่มต้นเป็นตัวแรกที่ไม่ใช่ Body
  const firstVisible = orderNorm.find((c) => c !== "Body") || "Eyes";
  state.currentCat = firstVisible;

  renderGrid(manifest);

  // buttons
  const btnRandom = document.getElementById("btnRandom");
  if (btnRandom) btnRandom.addEventListener("click", () => randomize(manifest));
  const btnResetEl = document.getElementById("btnReset");
  if (btnResetEl) btnResetEl.addEventListener("click", resetAll);
  const btnExportEl = document.getElementById("btnExport");
  if (btnExportEl) btnExportEl.addEventListener("click", exportPng);
  const btnClearCatEl = document.getElementById("btnClearCat");
  if (btnClearCatEl)
    btnClearCatEl.addEventListener("click", (e) => {
      e.preventDefault();
      // กดกากบาทให้ล้างด้วย empty.png
      selectItem(state.currentCat, "");
    });

  const btnPrevEl = document.getElementById("btnPrev");
  if (btnPrevEl)
    btnPrevEl.addEventListener("click", () => {
      const c = state.currentCat;
      state.pageByCat[c] = Math.max(0, (state.pageByCat[c] || 0) - 1);
      renderGrid(manifest);
    });
  const btnNextEl = document.getElementById("btnNext");
  if (btnNextEl)
    btnNextEl.addEventListener("click", () => {
      const c = state.currentCat;
      const list = getItemsForCategory(manifest, c);
      const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      state.pageByCat[c] = Math.min(total - 1, (state.pageByCat[c] || 0) + 1);
      renderGrid(manifest);
    });

  // เริ่มต้นด้วยการสุ่ม (ข้าม Body)
  randomize(manifest);
})();
