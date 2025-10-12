const manifestPath = "assets/manifest.json";
const orderFallback = [
  "Body",
  "Eyes",
  "Mouth",
  "Hair",
  "Top",
  "Bottom",
  "Shoes",
];
const ICONS = {
  Body: "🧍",
  Eyes: "👀",
  Mouth: "👄",
  Hair: "💇",
  Top: "👕",
  Bottom: "🩳",
  Shoes: "👟",
};
const PAGE_SIZE = 8;
const state = {
  currentCat: "Body",
  // hairGender can be 'male' | 'female' | 'both'
  hairGender: "male",
  pageByCat: {},
  selection: {
    Body: "",
    Eyes: "",
    Mouth: "",
    Hair: "",
    Hair2: "", // second hair layer when 'both'
    Top: "",
    Bottom: "",
    Shoes: "",
  },
};

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

function stageEnsureLayers(order) {
  const stage = document.getElementById("stage");
  stage.innerHTML = "";
  order.forEach((cat) => {
    const id = `layer-${cat.toLowerCase()}`;
    const img = createLayer(id, "");
    img.dataset.category = cat;
    stage.appendChild(img);
  });
  // ensure an extra hair layer on top for 'both' mode
  if (!document.getElementById("layer-hair2")) {
    stage.appendChild(createLayer("layer-hair2", ""));
  }
}

function getItemsForCategory(manifest, cat) {
  const items = manifest.parts?.[cat];
  if (Array.isArray(items)) return items;
  if (cat === "Hair" && items && typeof items === "object") {
    if (state.hairGender === "both") {
      return [...(items.male || []), ...(items.female || [])];
    }
    const list =
      state.hairGender === "female" ? items.female || [] : items.male || [];
    return list;
  }
  return [];
}

function buildTabs(manifest) {
  const order = manifest.order || orderFallback;
  const tabBar = document.getElementById("tabBar");
  tabBar.innerHTML = "";
  order.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.cat = cat;
    btn.className =
      "px-2.5 py-1.5 text-sm rounded-md border bg-white hover:bg-slate-50";
    btn.innerHTML = `<span class="mr-1">${ICONS[cat] || "🔹"}</span>${cat}`;
    btn.addEventListener("click", () => {
      state.currentCat = cat;
      state.pageByCat[cat] = 0;
      renderGrid(manifest);
      updateTabActive();
      updateHairFilterVisibility(cat);
    });
    tabBar.appendChild(btn);
  });
  updateTabActive();
  updateHairFilterVisibility(state.currentCat);
}

function updateTabActive() {
  const buttons = document.querySelectorAll("#tabBar button");
  buttons.forEach((b) => {
    if (b.dataset.cat === state.currentCat)
      b.classList.add("bg-indigo-600", "text-white", "border-indigo-600");
    else b.classList.remove("bg-indigo-600", "text-white", "border-indigo-600");
  });
}

function updateHairFilterVisibility(cat) {
  const el = document.getElementById("hairFilter");
  el.classList.toggle("hidden", cat !== "Hair");
  if (cat === "Hair") {
    el.querySelectorAll("button").forEach((btn) => {
      const active = btn.dataset.gender === state.hairGender;
      btn.classList.toggle("bg-indigo-600", active);
      btn.classList.toggle("text-white", active);
    });
  }
}

function renderGrid(manifest) {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  const cat = state.currentCat;
  const list = getItemsForCategory(manifest, cat);
  const page = state.pageByCat[cat] || 0;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

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

    const isSelected =
      state.selection[cat] === p ||
      (cat === "Hair" &&
        (state.selection.Hair === p || state.selection.Hair2 === p));
    if (isSelected) {
      const badge = document.createElement("div");
      badge.className =
        "absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center";
      badge.textContent = "✓";
      btn.appendChild(badge);
      btn.classList.add("ring-2", "ring-indigo-600");
    }

    btn.addEventListener("click", () => selectItem(cat, p));
    grid.appendChild(btn);
  });

  document.getElementById("pager").textContent = `${Math.min(
    page + 1,
    totalPages
  )} / ${totalPages}`;
  document.getElementById("btnPrev").disabled = page <= 0;
  document.getElementById("btnNext").disabled = page >= totalPages - 1;
}

function selectItem(cat, path) {
  if (cat === "Hair" && state.hairGender === "both") {
    // Fill first empty slot, then second; subsequent picks overwrite the oldest
    if (!state.selection.Hair) state.selection.Hair = path || "";
    else if (!state.selection.Hair2) state.selection.Hair2 = path || "";
    else {
      // rotate: move Hair2 to Hair, set Hair2 to new path
      state.selection.Hair = state.selection.Hair2;
      state.selection.Hair2 = path || "";
    }
    const main = document.getElementById("layer-hair");
    const alt = document.getElementById("layer-hair2");
    if (main)
      main.src = state.selection.Hair ? encodeURI(state.selection.Hair) : "";
    if (alt)
      alt.src = state.selection.Hair2 ? encodeURI(state.selection.Hair2) : "";
  } else {
    state.selection[cat] = path || "";
    if (cat === "Hair") state.selection.Hair2 = ""; // clear secondary if leaving both mode
    const img = document.getElementById(`layer-${cat.toLowerCase()}`);
    img.src = path ? encodeURI(path) : "";
  }
  if (window.__manifestCache) renderGrid(window.__manifestCache);
}

function randomize(manifest) {
  const order = manifest.order || orderFallback;
  order.forEach((cat) => {
    const items = manifest.parts?.[cat];
    let list = [];
    if (Array.isArray(items)) list = items;
    else if (cat === "Hair" && items) {
      if (state.hairGender === "both") {
        const male = items.male || [];
        const female = items.female || [];
        const pickM = male.length
          ? male[Math.floor(Math.random() * male.length)]
          : "";
        const pickF = female.length
          ? female[Math.floor(Math.random() * female.length)]
          : "";
        state.selection.Hair = pickM || "";
        state.selection.Hair2 = pickF || "";
        const main = document.getElementById("layer-hair");
        const alt = document.getElementById("layer-hair2");
        if (main)
          main.src = state.selection.Hair
            ? encodeURI(state.selection.Hair)
            : "";
        if (alt)
          alt.src = state.selection.Hair2
            ? encodeURI(state.selection.Hair2)
            : "";
        return;
      }
      list = [...(items.male || []), ...(items.female || [])];
    }
    const pick = list.length
      ? list[Math.floor(Math.random() * list.length)]
      : "";
    state.selection[cat] = pick || "";
    const img = document.getElementById(`layer-${cat.toLowerCase()}`);
    img.src = pick ? encodeURI(pick) : "";
  });
  if (window.__manifestCache) renderGrid(window.__manifestCache);
}

function resetAll() {
  Object.keys(state.selection).forEach((k) => (state.selection[k] = ""));
  document.querySelectorAll("#stage img").forEach((img) => (img.src = ""));
  if (window.__manifestCache) renderGrid(window.__manifestCache);
}

function exportPng() {
  const stage = document.getElementById("stage");
  const imgs = Array.from(stage.querySelectorAll("img"));
  const canvas = document.createElement("canvas");
  const W = 300,
    H = 400;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const promises = imgs.map(
    (img) =>
      new Promise((resolve) => {
        if (!img.src) return resolve();
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => {
          ctx.drawImage(i, 0, 0, W, H);
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

(async function init() {
  const manifest = await loadManifest();
  const order = manifest.order || orderFallback;
  stageEnsureLayers(order);
  buildTabs(manifest);
  window.__manifestCache = manifest;
  renderGrid(manifest);

  document
    .getElementById("btnRandom")
    .addEventListener("click", () => randomize(manifest));
  document.getElementById("btnReset").addEventListener("click", resetAll);
  document.getElementById("btnExport").addEventListener("click", exportPng);
  document.getElementById("btnClearCat").addEventListener("click", (e) => {
    e.preventDefault();
    selectItem(state.currentCat, "");
  });
  document.getElementById("btnPrev").addEventListener("click", () => {
    const c = state.currentCat;
    state.pageByCat[c] = Math.max(0, (state.pageByCat[c] || 0) - 1);
    renderGrid(manifest);
  });
  document.getElementById("btnNext").addEventListener("click", () => {
    const c = state.currentCat;
    const list = getItemsForCategory(manifest, c);
    const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.pageByCat[c] = Math.min(total - 1, (state.pageByCat[c] || 0) + 1);
    renderGrid(manifest);
  });
  document.querySelectorAll("#hairFilter button").forEach((b) => {
    b.addEventListener("click", () => {
      state.hairGender = b.dataset.gender;
      if (state.hairGender !== "both") state.selection.Hair2 = "";
      updateHairFilterVisibility("Hair");
      if (state.currentCat === "Hair") {
        state.pageByCat["Hair"] = 0;
        renderGrid(manifest);
      }
      // Re-apply hair layers
      const main = document.getElementById("layer-hair");
      const alt = document.getElementById("layer-hair2");
      if (main)
        main.src = state.selection.Hair ? encodeURI(state.selection.Hair) : "";
      if (alt)
        alt.src = state.selection.Hair2 ? encodeURI(state.selection.Hair2) : "";
    });
  });

  randomize(manifest);
})();
