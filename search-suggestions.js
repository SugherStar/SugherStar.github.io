(() => {
  "use strict";

  const SUGGESTION_ENDPOINT = "https://api.bing.com/osjson.aspx";
  const DEBOUNCE_MS = 220;
  const REQUEST_TIMEOUT_MS = 5000;
  const MAX_SUGGESTIONS = 8;
  const MAX_SHORTCUTS = 20;
  const STORAGE_KEY = "luojing-shortcuts-v2";

  const DEFAULT_SHORTCUTS = [
    { nameZh: "YouTube", nameEn: "YouTube", label: "YT", url: "https://www.youtube.com/", color: "#ff0033" },
    { nameZh: "GitHub", nameEn: "GitHub", label: "GH", url: "https://github.com/", color: "#7c8799" },
    { nameZh: "维基百科", nameEn: "Wikipedia", label: "W", url: "https://www.wikipedia.org/", color: "#65758b" },
    { nameZh: "Gmail", nameEn: "Gmail", label: "G", url: "https://mail.google.com/", color: "#ea4335" },
    { nameZh: "Reddit", nameEn: "Reddit", label: "R", url: "https://www.reddit.com/", color: "#ff4500" },
    { nameZh: "X", nameEn: "X", label: "X", url: "https://x.com/", color: "#64748b" },
    { nameZh: "领英", nameEn: "LinkedIn", label: "in", url: "https://www.linkedin.com/", color: "#0a66c2" },
    { nameZh: "Netflix", nameEn: "Netflix", label: "N", url: "https://www.netflix.com/", color: "#e50914" }
  ];

  const I18N = {
    zh: {
      searchLabel: "使用 Bing 搜索", searchButton: "搜索", searchPlaceholder: "使用 Bing 搜索网页、知识与灵感",
      quickAccess: "QUICK ACCESS", favoritesTitle: "常用网站", customize: "自定义", footer: "保持简单，专注此刻。",
      personalize: "PERSONALIZE", manageTitle: "管理常用网站", manageDescription: "添加你常用的网站，设置只保存在当前浏览器中。",
      siteName: "网站名称", siteUrl: "网站地址", addSite: "添加网站", restoreDefaults: "恢复默认", done: "完成",
      siteNamePlaceholder: "例如：Notion",
      close: "关闭", deleteSite: "删除", openNew: "在新窗口打开", switchLanguage: "Switch to English",
      darkTheme: "切换为深色主题", lightTheme: "切换为浅色主题", noSuggestions: "没有搜索建议",
      suggestionCount: (count) => `找到 ${count} 条搜索建议`, suggestionUnavailable: "搜索建议暂时不可用，仍可直接搜索",
      confirmReset: "恢复国际常用网站并删除当前自定义设置？", maxSites: `最多可以添加 ${MAX_SHORTCUTS} 个网站。`,
      invalidUrl: "请输入以 http:// 或 https:// 开头的网址。",
      greetings: ["夜深了，慢慢来", "早上好，今天想找点什么？", "下午好，今天想找点什么？", "晚上好，今天想找点什么？"]
    },
    en: {
      searchLabel: "Search with Bing", searchButton: "Search", searchPlaceholder: "Search the web, knowledge and ideas with Bing",
      quickAccess: "QUICK ACCESS", favoritesTitle: "Favorites", customize: "Customize", footer: "Keep it simple. Stay focused.",
      personalize: "PERSONALIZE", manageTitle: "Manage favorites", manageDescription: "Add the sites you use most. Settings stay in this browser.",
      siteName: "Site name", siteUrl: "Website URL", addSite: "Add site", restoreDefaults: "Restore defaults", done: "Done",
      siteNamePlaceholder: "e.g. Notion",
      close: "Close", deleteSite: "Delete", openNew: "opens in a new window", switchLanguage: "切换到中文",
      darkTheme: "Switch to dark theme", lightTheme: "Switch to light theme", noSuggestions: "No search suggestions",
      suggestionCount: (count) => `${count} search suggestions available`, suggestionUnavailable: "Suggestions are unavailable. You can still search.",
      confirmReset: "Restore the international defaults and remove your custom settings?", maxSites: `You can add up to ${MAX_SHORTCUTS} sites.`,
      invalidUrl: "Enter a URL beginning with http:// or https://.",
      greetings: ["Take it easy, it’s late", "Good morning. What are you looking for?", "Good afternoon. What are you looking for?", "Good evening. What are you looking for?"]
    }
  };

  const form = document.querySelector("#search-form");
  const input = document.querySelector("#search-input");
  const list = document.querySelector("#suggestions");
  const status = document.querySelector("#search-status");
  const clearButton = document.querySelector("#clear-search");
  const themeButton = document.querySelector("#theme-toggle");
  const languageButton = document.querySelector("#language-toggle");
  const shortcutGrid = document.querySelector("#shortcut-grid");
  const manageButton = document.querySelector("#manage-shortcuts");
  const dialog = document.querySelector("#shortcut-dialog");
  const editableList = document.querySelector("#editable-shortcuts");
  const addForm = document.querySelector("#add-shortcut-form");
  const nameInput = document.querySelector("#shortcut-name");
  const urlInput = document.querySelector("#shortcut-url");

  let language = getSavedLanguage();
  let shortcuts = loadShortcuts();
  let suggestions = [];
  let activeIndex = -1;
  let debounceTimer = 0;
  let requestTimer = 0;
  let requestSequence = 0;
  let activeScript = null;
  let activeCallbackName = "";
  let composing = false;

  function t(key) { return I18N[language][key]; }

  function getSavedLanguage() {
    try {
      const saved = localStorage.getItem("luojing-language");
      if (saved === "zh" || saved === "en") return saved;
    } catch (_) { /* 使用浏览器语言 */ }
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_) { return false; }
  }

  function normalizeShortcut(item) {
    if (!item || !validHttpUrl(item.url)) return null;
    const name = String(item.nameZh || item.nameEn || "Website").trim().slice(0, 24);
    if (!name) return null;
    return {
      nameZh: String(item.nameZh || name).trim().slice(0, 24),
      nameEn: String(item.nameEn || name).trim().slice(0, 24),
      label: String(item.label || name.slice(0, 2)).trim().slice(0, 4).toUpperCase(),
      url: new URL(item.url).href,
      color: /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#1479ff"
    };
  }

  function loadShortcuts() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) {
        const clean = saved.slice(0, MAX_SHORTCUTS).map(normalizeShortcut).filter(Boolean);
        return clean;
      }
    } catch (_) { /* 使用默认网站 */ }
    return DEFAULT_SHORTCUTS.map((item) => ({ ...item }));
  }

  function saveShortcuts() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts)); } catch (_) { /* 当前会话仍然有效 */ }
  }

  function displayName(item) { return language === "zh" ? item.nameZh : item.nameEn; }

  function renderShortcuts() {
    const fragment = document.createDocumentFragment();
    shortcuts.forEach((item) => {
      const name = displayName(item);
      const link = document.createElement("a");
      link.className = "shortcut-card";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.setProperty("--card-color", item.color);
      link.setAttribute("aria-label", language === "zh" ? `${name}（${t("openNew")}）` : `${name}, ${t("openNew")}`);

      const icon = document.createElement("span");
      icon.className = "shortcut-icon";
      icon.textContent = item.label;
      icon.setAttribute("aria-hidden", "true");
      const meta = document.createElement("span");
      meta.className = "shortcut-meta";
      const title = document.createElement("span");
      title.className = "shortcut-name";
      title.textContent = name;
      const arrow = document.createElement("span");
      arrow.className = "shortcut-arrow";
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      meta.append(title, arrow);
      link.append(icon, meta);
      fragment.append(link);
    });
    shortcutGrid.replaceChildren(fragment);
  }

  function renderEditableShortcuts() {
    const fragment = document.createDocumentFragment();
    shortcuts.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "editable-row";
      const icon = document.createElement("span");
      icon.className = "editable-icon";
      icon.textContent = item.label;
      const info = document.createElement("span");
      info.className = "editable-info";
      const name = document.createElement("span");
      name.className = "editable-name";
      name.textContent = displayName(item);
      const url = document.createElement("span");
      url.className = "editable-url";
      url.textContent = item.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      const remove = document.createElement("button");
      remove.className = "delete-shortcut";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${t("deleteSite")} ${displayName(item)}`);
      remove.addEventListener("click", () => {
        shortcuts.splice(index, 1);
        saveShortcuts();
        renderShortcuts();
        renderEditableShortcuts();
      });
      info.append(name, url);
      row.append(icon, info, remove);
      fragment.append(row);
    });
    editableList.replaceChildren(fragment);
  }

  function updateDateTime() {
    const now = new Date();
    const hour = now.getHours();
    const greetingIndex = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
    document.querySelector("#greeting").textContent = t("greetings")[greetingIndex];
    document.querySelector("#date-text").textContent = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "long", day: "numeric", weekday: "long"
    }).format(now);
    document.querySelector("#clock").textContent = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(now);
  }

  function applyLanguage() {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = t(element.dataset.i18n);
      if (typeof value === "string") element.textContent = value;
    });
    input.placeholder = t("searchPlaceholder");
    nameInput.placeholder = t("siteNamePlaceholder");
    languageButton.textContent = language === "zh" ? "EN" : "中";
    languageButton.setAttribute("aria-label", t("switchLanguage"));
    document.querySelector("#dialog-close").setAttribute("aria-label", t("close"));
    updateThemeButton();
    updateDateTime();
    renderShortcuts();
    if (dialog.open) renderEditableShortcuts();
  }

  function toggleLanguage() {
    language = language === "zh" ? "en" : "zh";
    try { localStorage.setItem("luojing-language", language); } catch (_) { /* 当前会话仍然有效 */ }
    applyLanguage();
  }

  function systemIsDark() { return window.matchMedia("(prefers-color-scheme: dark)").matches; }
  function effectiveTheme() { return document.documentElement.dataset.theme || (systemIsDark() ? "dark" : "light"); }
  function updateThemeButton() {
    const label = effectiveTheme() === "dark" ? t("lightTheme") : t("darkTheme");
    themeButton.setAttribute("aria-label", label);
    themeButton.title = label;
  }
  function initializeTheme() {
    try {
      const saved = localStorage.getItem("luojing-theme");
      if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
    } catch (_) { /* 继续跟随系统 */ }
    updateThemeButton();
  }
  function toggleTheme() {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("luojing-theme", next); } catch (_) { /* 当前会话仍然有效 */ }
    updateThemeButton();
  }

  function cleanupRequest() {
    window.clearTimeout(requestTimer);
    if (activeScript) activeScript.remove();
    if (activeCallbackName) delete window[activeCallbackName];
    activeScript = null;
    activeCallbackName = "";
  }
  function closeSuggestions() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }
  function setActive(index) {
    if (!suggestions.length) return;
    activeIndex = (index + suggestions.length) % suggestions.length;
    [...list.children].forEach((item, itemIndex) => {
      const selected = itemIndex === activeIndex;
      item.setAttribute("aria-selected", String(selected));
      if (selected) {
        input.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ block: "nearest" });
      }
    });
  }
  function chooseSuggestion(value) {
    input.value = value;
    clearButton.hidden = false;
    closeSuggestions();
    form.requestSubmit();
  }
  function renderSuggestions(items) {
    suggestions = items.filter((item) => typeof item === "string" && item.trim()).slice(0, MAX_SUGGESTIONS);
    const fragment = document.createDocumentFragment();
    suggestions.forEach((value, index) => {
      const item = document.createElement("li");
      item.className = "suggestion-item";
      item.id = `suggestion-${index}`;
      item.role = "option";
      item.setAttribute("aria-selected", "false");
      const button = document.createElement("button");
      button.className = "suggestion-button";
      button.type = "button";
      button.textContent = value;
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => chooseSuggestion(value));
      item.append(button);
      fragment.append(item);
    });
    list.replaceChildren(fragment);
    activeIndex = -1;
    list.hidden = suggestions.length === 0;
    input.setAttribute("aria-expanded", String(suggestions.length > 0));
    input.removeAttribute("aria-activedescendant");
    status.textContent = suggestions.length ? t("suggestionCount")(suggestions.length) : t("noSuggestions");
  }
  function fetchSuggestions(keyword) {
    cleanupRequest();
    const sequence = ++requestSequence;
    const callbackName = `__luojingBingSuggest${sequence}`;
    const script = document.createElement("script");
    activeScript = script;
    activeCallbackName = callbackName;
    window[callbackName] = (payload) => {
      if (sequence !== requestSequence) return;
      cleanupRequest();
      const items = Array.isArray(payload?.[1]) ? payload[1] : Array.isArray(payload?.s) ? payload.s : [];
      if (input.value.trim() === keyword) renderSuggestions(items);
    };
    const finishWithError = () => {
      if (sequence !== requestSequence) return;
      cleanupRequest();
      suggestions = [];
      closeSuggestions();
      status.textContent = t("suggestionUnavailable");
    };
    const params = new URLSearchParams({ query: keyword, JsonType: "callback", JsonCallback: callbackName });
    script.src = `${SUGGESTION_ENDPOINT}?${params}`;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.onerror = finishWithError;
    requestTimer = window.setTimeout(finishWithError, REQUEST_TIMEOUT_MS);
    document.head.append(script);
  }
  function scheduleSuggestions() {
    window.clearTimeout(debounceTimer);
    const keyword = input.value.trim();
    clearButton.hidden = !input.value;
    if (!keyword) {
      requestSequence += 1;
      cleanupRequest();
      suggestions = [];
      closeSuggestions();
      status.textContent = "";
      return;
    }
    debounceTimer = window.setTimeout(() => fetchSuggestions(keyword), DEBOUNCE_MS);
  }

  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; scheduleSuggestions(); });
  input.addEventListener("input", () => { if (!composing) scheduleSuggestions(); });
  input.addEventListener("focus", () => { if (suggestions.length) { list.hidden = false; input.setAttribute("aria-expanded", "true"); } });
  input.addEventListener("keydown", (event) => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      if (list.hidden) { list.hidden = false; input.setAttribute("aria-expanded", "true"); }
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      if (list.hidden) { list.hidden = false; input.setAttribute("aria-expanded", "true"); }
      setActive(activeIndex - 1);
    } else if (event.key === "Enter" && activeIndex >= 0 && !list.hidden) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
    }
  });
  clearButton.addEventListener("click", () => { input.value = ""; scheduleSuggestions(); input.focus(); });
  form.addEventListener("submit", (event) => {
    if (!input.value.trim()) { event.preventDefault(); input.focus(); }
  });
  document.addEventListener("pointerdown", (event) => { if (!form.contains(event.target)) closeSuggestions(); });

  manageButton.addEventListener("click", () => { renderEditableShortcuts(); dialog.showModal(); dialog.scrollTop = 0; });
  document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
  document.querySelector("#dialog-done").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (shortcuts.length >= MAX_SHORTCUTS) { window.alert(t("maxSites")); return; }
    const rawUrl = urlInput.value.trim();
    if (!validHttpUrl(rawUrl)) { urlInput.setCustomValidity(t("invalidUrl")); urlInput.reportValidity(); return; }
    urlInput.setCustomValidity("");
    const name = nameInput.value.trim();
    shortcuts.push({ nameZh: name, nameEn: name, label: name.slice(0, 2).toUpperCase(), url: new URL(rawUrl).href, color: "#1479ff" });
    saveShortcuts();
    renderShortcuts();
    renderEditableShortcuts();
    addForm.reset();
    nameInput.focus();
  });
  urlInput.addEventListener("input", () => urlInput.setCustomValidity(""));
  document.querySelector("#reset-shortcuts").addEventListener("click", () => {
    if (!window.confirm(t("confirmReset"))) return;
    shortcuts = DEFAULT_SHORTCUTS.map((item) => ({ ...item }));
    saveShortcuts();
    renderShortcuts();
    renderEditableShortcuts();
  });

  themeButton.addEventListener("click", toggleTheme);
  languageButton.addEventListener("click", toggleLanguage);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (!document.documentElement.dataset.theme) updateThemeButton();
  });
  window.addEventListener("pagehide", cleanupRequest);

  initializeTheme();
  applyLanguage();
  window.setInterval(updateDateTime, 30_000);
})();
