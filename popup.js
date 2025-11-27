const LANG_SELECT = document.getElementById("langChoose");

// Lấy giá trị đã lưu
const savedLang = localStorage.getItem("languageChoose") || "Vietnamese";

// Gán lại vào UI khi mở popup
LANG_SELECT.value = savedLang;

// Lắng nghe thay đổi và lưu lại
LANG_SELECT.addEventListener("change", () => {
    localStorage.setItem("languageChoose", LANG_SELECT.value);
});


let toggleDownload = document.getElementById("btncheck1");

const KEY_SELECT = document.getElementById("keyChoose");
const savedKey = localStorage.getItem("selectedKey") || "Key 1";
const KEY_USING = document.getElementById("keyUsing");
 KEY_USING.textContent = `Key Using: ${savedKey}`;
  KEY_SELECT.addEventListener("change", () => {
    const selectedKey = KEY_SELECT.value;
    localStorage.setItem("selectedKey", selectedKey);
    KEY_USING.textContent = `Key Using: ${selectedKey}`;
  });
let GEMINI_API_KEY = savedKey;


const MODEL_SELECT = document.getElementById("modelChoose");
 const savedModel = localStorage.getItem("selectedModel") || "gemini-2.0-flash";
 const MODEL_USING = document.getElementById("modelUsing");
  MODEL_USING.textContent = `Model Using: ${savedModel}`;
  MODEL_SELECT.addEventListener("change", () => {
    const selectedModel = MODEL_SELECT.value;
    localStorage.setItem("selectedModel", selectedModel);
    MODEL_USING.textContent = `Model Using: ${selectedModel}`;
  });

let GEMINI_MODEL = savedModel;

MODEL_SELECT.addEventListener("change", () => {
  const selectedModel = MODEL_SELECT.value;
  localStorage.setItem("selectedModel", selectedModel);
  MODEL_USING.textContent = `Model Using: ${selectedModel}`;
  GEMINI_MODEL = selectedModel;
});

const SITE_CHOOSE = document.getElementById("siteChoose");
const savedSite = localStorage.getItem("selectedSite") || "novelbin";
const SITE_USING = document.getElementById("siteUsing");
 SITE_USING.textContent = `Site Using: ${savedSite}`;
  SITE_CHOOSE.addEventListener("change", () => {
    const selectedSite = SITE_CHOOSE.value;
    localStorage.setItem("selectedSite", selectedSite);
    SITE_USING.textContent = `Site Using: ${selectedSite}`;
  });

let SITE_CHOOSE_VALUE = savedSite;

SITE_CHOOSE.addEventListener("change", () => {
  const selectedSite = SITE_CHOOSE.value;
  localStorage.setItem("selectedSite", selectedSite);
  SITE_USING.textContent = `Site Using: ${selectedSite}`;
  SITE_CHOOSE_VALUE = selectedSite;
});



const TOKEN_LIMIT = 8000;
const MAX_CHARS_PER_BATCH = 2000;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

const btn = document.getElementById("scrapeBtn");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const barEl = document.getElementById("bar");
const logEl = document.getElementById("log");

btn.addEventListener("click", function () {
  btn.classList.remove("enabled");
  btn.classList.add("active");
  btn.disabled = true;
});

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent += `[${ts}] ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
function showStatus(text, color = "#fff") {
  statusEl.textContent = text;
  statusEl.style.color = color;
}
function showProgress(percent, subtext = "") {
  progressEl.style.display = "block";
  barEl.style.width = Math.min(100, Math.max(0, percent)) + "%";
  if (subtext) showStatus(subtext);
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function approxTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
function chunkArrayBySize(arr, maxLen) {
  let chunks = [],
    temp = [],
    len = 0;
  arr.forEach((item) => {
    const l = item.text.length;
    if (len + l > maxLen && temp.length > 0) {
      chunks.push(temp);
      temp = [];
      len = 0;
    }
    temp.push(item);
    len += l;
  });
  if (temp.length > 0) chunks.push(temp);
  return chunks;
}

async function callGemini(promptText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = { contents: [{ parts: [{ text: promptText }] }] };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      log(`HTTP request attempt ${attempt}...`);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        let txt = await resp.text();
        log(`Error ${resp.status}: ${txt}`);
        if (
          (resp.status === 429 || resp.status === 503) &&
          attempt < MAX_RETRIES
        ) {
          const wait = BASE_DELAY_MS * attempt;
          log(`Retry after ${wait}ms...`);
          await delay(wait);
          continue;
        }
        return null;
      }
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
      log("Fetch error: " + err);
      await delay(BASE_DELAY_MS * attempt);
    }
  }
  return null;
}

btn.addEventListener("click", async () => {
  showStatus("Getting the article");
  showProgress(10, "On it...");
  log("=== Start ===");
  log("Model using: " + GEMINI_MODEL);
  log("Site using: " + SITE_CHOOSE_VALUE);
  log("KEY using: " + GEMINI_API_KEY);
  
  

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const selectors = {
  lightnovelworld: [
    "#chapter-text",
    ".chapter-content",
    "div[class*='chapter']"
  ],
  novelbin: [
    "#chr-content",
    ".chapter-content"
  ],
  daozoid:[
    ".text-left",
  ],
  kakao: [
    "div.DC2CN",
    ".DC2CN",
    ".min-h-full" 
  ],
  booktoki: [
    "#novel_content",
    ".panel-body",
    ".content-center",
    "div#novel_content"
  ],
  default: [
    ".chapter-content",
    "#chapter-content",
    "article"
  ]
};

let results;

if(SITE_CHOOSE_VALUE === "kakao"){
  results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        function deepQuerySelectorAll(root, selector) {
          let elements = [];
          if (!root) return elements;

          elements.push(...root.querySelectorAll(selector));

          const traverse = (node) => {
            node.childNodes.forEach((child) => {
              if (child.shadowRoot) {
                elements.push(...deepQuerySelectorAll(child.shadowRoot, selector));
              }
              traverse(child);
            });
          };
          traverse(root);
          return elements;
        }

        const containers = deepQuerySelectorAll(document, "div.DC2CN");
        if (!containers || containers.length === 0) return [];
        let collected = [];

        containers.forEach((container, idx) => {
          const elements = Array.from(container.querySelectorAll("*"));
          elements.forEach((el) => {
            const text = el.innerText?.trim();
            if (text && text.length > 0) collected.push({ block: idx, text });
          });
        });

        if (collected.length === 0) {
          containers.forEach((container, idx) => {
            const text = container.innerText?.trim();
            if (text && text.length > 0) collected.push({ block: idx, text });
          });
        }

        return collected;
      },
    });
}else{
  results = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  args: [SITE_CHOOSE_VALUE, selectors],
  func: (siteValue, selectorsMap) => {
    function findContainer(selectors) {
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found && found.length > 0) return found;
      }
      return null;
    }

    const siteSelectors =
      selectorsMap[siteValue] || selectorsMap.default;

    let containers = findContainer(siteSelectors);
    if (!containers) return [];

    const collected = [];

    containers.forEach((container, idx) => {
      const els = container.querySelectorAll(
        "p, span, div, h1, h2, h3, h4, h5, h6, center"
      );

      els.forEach((el) => {
        const text = el.innerText?.trim();
        if (text && text.length > 0) {
          collected.push({
            block: idx,
            text: text
          });
        }
      });
    });

    return collected;
  }
});
}


    const textItems = results[0]?.result;
    if (!textItems || textItems.length === 0) {
      showStatus("Couldn't find the article.", "red");
      return;
    }

    const fullText = textItems.map((x) => x.text).join("\n\n");
    const tokenCount = approxTokenCount(fullText);
    log(`Total count: ${textItems.length}, ~${tokenCount} tokens.`);

    const stored = await chrome.storage.local.get([
      "appliedConfigs",
      "configs",
    ]);
    const notes =
      stored.appliedConfigs?.length > 0
        ? stored.appliedConfigs
        : stored.configs || [];

    let noteText = "There aren't any configs yet";
    if (notes.length > 0) {
      noteText = notes
        .map(
          (n, i) => `${i + 1}. [${n.type.toUpperCase()}] ${n.name}: ${n.value}`
        )
        .join("\n");
    }

    let translatedItems = [];
    
    log("Language: " + LANG_SELECT.value);
    if (tokenCount <= TOKEN_LIMIT) {
      showStatus("Translating...");
      //change this as you wish. I highly recommend to just translate this into your language and put it in here.
      const prompt = `Bạn là dịch giả chuyên nghiệp, chỉ dịch sang ${LANG_SELECT.value} tự nhiên hiện đại.
Giữ nguyên cách ngắt dòng. Không thêm ghi chú.

Ghi chú người dùng (Nếu ghi chú không có trong đoạn truyện, có thể bỏ qua):
${noteText}

Văn bản gốc:
${fullText}`;

      const rawTranslated = await callGemini(prompt);
      if (!rawTranslated) {
        showStatus("Uncaught error", "red");
        return;
      }

      translatedItems = rawTranslated
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (translatedItems.length < textItems.length)
        translatedItems = [rawTranslated];
    } else {
      showStatus("Chunking it down rn...");
      const chunks = chunkArrayBySize(textItems, MAX_CHARS_PER_BATCH);
      log(`Divided into ${chunks.length} batch.`);

      for (let i = 0; i < chunks.length; i++) {
        const texts = chunks[i].map((x) => x.text);
        showStatus(`Dịch batch ${i + 1}/${chunks.length}...`);
        //and this too, change it.
        const prompt = `Dịch từng đoạn trong mảng JSON sang ${LANG_SELECT.value}, giữ nguyên thứ tự. Trả về JSON array.\n${JSON.stringify(
          texts
        )}`;
        let result;
        if(SITE_CHOOSE_VALUE === "kakao"){
          
        }
        result = await callGemini(prompt);
        if (!result) {
          showStatus(`Batch ${i + 1} failed`, "red");
          return;
        }
        try {
          const arr = JSON.parse(result);
          translatedItems.push(...arr);
        } catch {
          translatedItems.push(...result.split(/\n/).filter(Boolean));
        }
        showProgress(
          40 + Math.floor(((i + 1) / chunks.length) * 40),
          `Translated ${i + 1}/${chunks.length}`
        );
      }
    }

  await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  args: [SITE_CHOOSE_VALUE, selectors, textItems, translatedItems],
  func: (siteValue, selectorsMap, originalItems, translatedItems) => {
    function deepQuerySelectorAll(root, selector) {
      let elements = [];
      if (!root) return elements;
      elements.push(...root.querySelectorAll(selector));
      const traverse = (node) => {
        node.childNodes.forEach((child) => {
          try {
            if (child.shadowRoot) {
              elements.push(...deepQuerySelectorAll(child.shadowRoot, selector));
            }
            traverse(child);
          } catch (e) {
          }
        });
      };
      traverse(root);
      return elements;
    }

    function findContainer(selectors) {
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found && found.length > 0) return found;
      }
      return null;
    }

    let containers;
    if (siteValue === "kakao") {
      containers = deepQuerySelectorAll(document, "div.DC2CN");
      if (!containers || containers.length === 0) {
        containers = findContainer(selectorsMap[kakao] || selectorsMap.default);
      }
    } else {
      const siteSelectors = selectorsMap[siteValue] || selectorsMap.default;
      containers = findContainer(siteSelectors);
    }

    if (!containers || containers.length === 0) return;

    let pointer = 0;

    containers.forEach((container) => {
    const els = Array.from(
      container.querySelectorAll("p, span, div, h1, h2, h3, h4, h5, h6, center")
    );

      els.forEach((el) => {
        if (!el || !el.innerText) return;
        const txt = el.innerText.trim();
        if (!txt) return;

        const newText = translatedItems[pointer];
        if (newText !== undefined) {
          try {
            el.innerText = newText;
            if(SITE_CHOOSE_VALUE === "kakao"){
            el.style.fontFamily = "Noto Sans, Noto Sans KR, Noto Sans JP, Noto Sans SC, Arial, sans-serif";

            el.style.lineHeight = "1.6";
            }
            
          } catch (e) {
            try { el.setAttribute("data-translate", newText); } catch (err) {}
          }
        }
        pointer++;
      });
    });
  }
});


  if (toggleDownload && toggleDownload.checked) {
    const outputName = "translated_" + Date.now() + ".txt";
    const outputContent = translatedItems.join("\n\n");
    saveToFile(outputName, outputContent);
    log("Downloading: " + outputName);
  }



    showProgress(100, "Done!");
    showStatus("Translation complete!", "lime");
    log("=== Completed ===");
  } catch (err) {
    console.error(err);
    showStatus("Uncaught error.", "red");
    log("Error: " + err);
  }
});

const btnSaveFile = document.getElementById("btnSaveFile");
btnSaveFile.addEventListener("click", async () => {
  const name = document.getElementById("saveName").value.trim();
  const type = document.getElementById("saveType").value;
  const value = document.getElementById("saveValue").value.trim();

  if (!name || !value) {
    alert("Something is missing rn...");
    return;
  }

  const stored = await chrome.storage.local.get("configs");
  let configs = stored?.configs || [];
  configs.push({ name, type, value, time: Date.now() });
  await chrome.storage.local.set({ configs });

  alert("Config Saved");
  document.getElementById("saveName").value = "";
  document.getElementById("saveValue").value = "";
  await loadSavedConfigs();
});

async function loadSavedConfigs() {
  const stored = await chrome.storage.local.get("configs");
  const configs = stored?.configs || [];
  const box = document.querySelector(".boxNew");

  const oldList = box.querySelector("ul");
  if (oldList) oldList.remove();

  const list = document.createElement("ul");
  list.style.fontSize = "12px";
  list.style.marginTop = "10px";
  list.style.listStyle = "none";
  list.style.padding = "0";

  if (configs.length) {
    configs.forEach((c, idx) => {
      const li = document.createElement("li");
      li.style.marginBottom = "6px";
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";

      if (`${c.type}` == "character") {
        li.classList.add("reddened");
      } else {
        li.classList.add("greened");
      }

      const textSpan = document.createElement("span");
      textSpan.textContent = `[${c.type}] ${c.name}: ${c.value}`;
      textSpan.style.flex = "1";
      textSpan.style.marginRight = "6px";

      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.style.fontSize = "11px";
      editBtn.style.transition = "0.3s";
      editBtn.style.padding = "50px 6px";
      editBtn.style.marginRight = "4px";
      editBtn.style.background = "#4e8ef7";
      editBtn.style.color = "#fff";
      editBtn.style.border = "none";
      editBtn.style.borderRadius = "3px";
      editBtn.style.cursor = "pointer";
      editBtn.classList.add("hell");

      editBtn.addEventListener("click", async () => {
        const newName = prompt("New name:", c.name) ?? c.name;
        const newType = prompt("Type (concept / character):", c.type) ?? c.type;
        const newValue = prompt("New value:", c.value) ?? c.value;
        configs[idx] = {
          ...c,
          name: newName.trim(),
          type: newType.trim(),
          value: newValue.trim(),
        };
        await chrome.storage.local.set({ configs });
        alert("Updated");
        loadSavedConfigs();
      });

      const delBtn = document.createElement("button");
      delBtn.textContent = "❌";
      delBtn.style.fontSize = "11px";
      delBtn.style.padding = "50px 6px";
      delBtn.style.background = "#d9534f";
      delBtn.style.color = "#fff";
      delBtn.style.border = "none";
      delBtn.style.borderRadius = "3px";
      delBtn.style.cursor = "pointer";
      delBtn.classList.add("hell");

      delBtn.addEventListener("click", async () => {
        if (confirm(`Delete "${c.name}"?`)) {
          configs.splice(idx, 1);
          await chrome.storage.local.set({ configs });
          alert("Deleted");
          loadSavedConfigs();
        }
      });

      li.appendChild(textSpan);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      list.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "There are no config yet.";
    list.appendChild(li);
  }

  box.appendChild(list);
}

const applyBtn = document.getElementById("applyChange");
const appliedInfo = document.getElementById("appliedInfo");
let cancelBtn;

async function loadChangeList() {
  const stored = await chrome.storage.local.get(["configs", "appliedConfigs"]);
  const configs = stored?.configs || [];
  const applied = stored?.appliedConfigs || [];
  const box = document.querySelector(".boxChange");

  const oldList = box.querySelector("ul");
  if (oldList) oldList.remove();

  const list = document.createElement("ul");
  list.style.fontSize = "12px";
  list.style.listStyle = "none";
  list.style.padding = "0";
  list.style.marginTop = "10px";

  if (configs.length) {
    configs.forEach((c, idx) => {
      const li = document.createElement("li");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = idx;
      cb.style.marginRight = "6px";

      if (applied.some((a) => a.name === c.name && a.value === c.value))
        cb.checked = true;

      const label = document.createElement("label");
      label.textContent = `[${c.type}] ${c.name}: ${c.value}`;

      li.appendChild(cb);
      li.appendChild(label);
      list.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "There are no configs available.";
    list.appendChild(li);
  }

  box.insertBefore(list, applyBtn);
}

applyBtn.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(
    ".boxChange input[type='checkbox']:checked"
  );
  const stored = await chrome.storage.local.get("configs");
  const configs = stored?.configs || [];
  if (!checkboxes.length) {
    alert("Haven't chose any config");
    return;
  }
  const selected = Array.from(checkboxes).map((cb) => configs[cb.value]);

  // Lưu config đã chọn
  await chrome.storage.local.set({ appliedConfigs: selected });

  appliedInfo.textContent =
    "Đã áp dụng:\n" + selected.map((c) => `[${c.type}] ${c.name}, `).join("\n");
  statusEl.textContent = `Using: ${selected.length} config`;

  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.id = "cancelApply";
    cancelBtn.textContent = "Cancel all configs";
    cancelBtn.style.marginTop = "8px";
    cancelBtn.style.background = "#555";
    cancelBtn.style.color = "#fff";
    cancelBtn.style.border = "none";
    cancelBtn.style.padding = "5px 10px";
    cancelBtn.style.borderRadius = "4px";
    cancelBtn.style.cursor = "pointer";
    appliedInfo.insertAdjacentElement("afterend", cancelBtn);

    cancelBtn.addEventListener("click", async () => {
      await chrome.storage.local.set({ appliedConfigs: [] });
      appliedInfo.textContent = "All configs cancelled";
      statusEl.textContent = "Ready | Current config: None";
      const cbs = document.querySelectorAll(
        ".boxChange input[type='checkbox']"
      );
      cbs.forEach((cb) => (cb.checked = false));
    });
  }

  alert(`Using: ${selected.length} config!`);
});

// ===== TAB HANDLER =====
const btnTranslate = document.getElementById("btnTranslate");
const btnNew = document.getElementById("btnNew");
const btnChange = document.getElementById("btnChange");

const boxTranslate = document.querySelector(".boxTranslate");
const boxNew = document.querySelector(".boxNew");
const boxChange = document.querySelector(".boxChange");

function showBox(targetBox) {
  const boxes = [boxTranslate, boxNew, boxChange];
  boxes.forEach((box) => {
    box.classList.remove("show");
    box.classList.add("hidden");
  });
  targetBox.classList.remove("hidden");
  targetBox.classList.add("show");
}

function setActiveButton(activeBtn) {
  [btnTranslate, btnNew, btnChange].forEach((btn) => {
    btn.classList.remove("active");
  });
  activeBtn.classList.add("active");
}

btnTranslate.addEventListener("click", () => {
  setActiveButton(btnTranslate);
  showBox(boxTranslate);
});

btnNew.addEventListener("click", () => {
  setActiveButton(btnNew);
  showBox(boxNew);
  loadSavedConfigs();
});

btnChange.addEventListener("click", () => {
  setActiveButton(btnChange);
  showBox(boxChange);
  loadChangeList();
});

const btnReset = document.querySelector(".reset_btn");
btnReset.addEventListener("click", () => {
  localStorage.removeItem("selectedModel");
  MODEL_SELECT.value = "gemini-2.0-flash";
  MODEL_USING.textContent = `Model Using: gemini-2.0-flash`;
  GEMINI_MODEL = "gemini-2.0-flash";

  localStorage.removeItem("selectedSite");
  SITE_CHOOSE.value = "novelbin";
  SITE_USING.textContent = `Site Using: novelbin`;
  SITE_CHOOSE_VALUE = "novelbin";
});

setActiveButton(btnTranslate);
showBox(boxTranslate);

document.addEventListener("DOMContentLoaded", () => {
  KEY_SELECT.value = localStorage.getItem("selectedKey") || "Key";
  MODEL_SELECT.value = localStorage.getItem("selectedModel") || "gemini-2.0-flash";
  SITE_CHOOSE.value = localStorage.getItem("selectedSite") || "novelbin";

  const savedLang = localStorage.getItem("languageChoose") || "Vietnamese";
  document.getElementById("langChoose").value = savedLang;
});

function saveToFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}




