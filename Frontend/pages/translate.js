// ============== GLOBAL LANGUAGE ENGINE ============== //

let selectedLang = localStorage.getItem("lang") || "en";

// For home page language dropdown
document.addEventListener("DOMContentLoaded", () => {
  const dropdown = document.getElementById("languageSelector");

  if (dropdown) {
    dropdown.value = selectedLang;

    dropdown.addEventListener("change", () => {
      selectedLang = dropdown.value;
      localStorage.setItem("lang", selectedLang);
      translatePage(); // Apply immediately
    });
  }

  translatePage(); // Auto apply on every page
});

// API Translate Function
async function translateText(text, lang) {
  if (!text) return text;
  if (lang === "en") return text;
  if (lang === "bho") lang = "hi"; // bhojpuri fallback

  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
    lang + "&dt=t&q=" + encodeURIComponent(text);

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data[0][0][0];
  } catch {
    return text;
  }
}

// Translate all elements marked with attributes
async function translatePage() {
  const elements = document.querySelectorAll("[data-translate]");
  const placeholders = document.querySelectorAll("[data-translate-placeholder]");

  for (const el of elements) {
    const t = el.getAttribute("data-translate");
    el.innerText = await translateText(t, selectedLang);
  }

  for (const input of placeholders) {
    const t = input.getAttribute("data-translate-placeholder");
    input.placeholder = await translateText(t, selectedLang);
  }
}
