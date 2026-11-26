// Genera chat.svg a partire da template.svg.
// Parti da qui per cambiare testi, link e posizione del meteo.
import { readFile, writeFile } from "node:fs/promises";

const CONFIG = {
  place: "Vercelli, Italy", // testo mostrato nel secondo messaggio
  // Coordinate usate SOLO per il meteo del secondo messaggio.
  lat: 45.32,
  lon: 8.42,
  timezone: "Europe/Rome",
  linkedin: "https://www.linkedin.com/in/loris-sagristano-b31237397",
  github: "https://github.com/builtbyloris",
};

// ---------- dati dinamici ----------

function weatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code === 85 || code === 86) return "❄️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

async function getWeather() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}` +
      `&daily=weather_code,temperature_2m_max&timezone=${encodeURIComponent(CONFIG.timezone)}&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { daily } = await res.json();
    const c = Math.round(daily.temperature_2m_max[0]);
    return { c, f: Math.round((c * 9) / 5 + 32), emoji: weatherEmoji(daily.weather_code[0]) };
  } catch (err) {
    console.error("Meteo non disponibile, uso il messaggio di riserva:", err.message);
    return null;
  }
}

function weekday() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: CONFIG.timezone });
}

// ---------- messaggi ----------

async function getMessages() {
  const w = await getWeather();
  return [
    { text: "Hi, I'm Loris" },
    {
      text: w
        ? `I live in ${CONFIG.place} where it's supposed to be ${w.c}° C (${w.f}° F) and ${w.emoji} today.`
        : `I live in ${CONFIG.place}.`,
    },
    { text: "I'm a Project & Innovation Management student, getting into Data Analytics." },
    {
      text: "You can find me on LinkedIn at",
      link: { label: "linkedin.com/in/loris-sagristano", href: CONFIG.linkedin },
    },
    {
      text: "And my GitHub repositories are here:",
      link: { label: "github.com/builtbyloris", href: CONFIG.github },
    },
    { text: `Have a great ${weekday()}! ✌️` },
  ];
}

// ---------- layout ----------

const CHAR = 9.2, PAD = 34, LINE_H = 24, GAP = 12, TOP = 8, MAX_UNITS = 44;

const units = (s) =>
  [...s].reduce((n, ch) => {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f) return n; // selettore emoji, larghezza zero
    return n + (cp > 0x2500 ? 1.9 : 1);
  }, 0);

function wrap(text) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (line && units(test) > MAX_UNITS) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const DOTS =
  '<circle class="typing-dot" cx="27" cy="21" r="4"/><circle class="typing-dot" cx="39" cy="21" r="4"/><circle class="typing-dot" cx="51" cy="21" r="4"/>';

function render(messages) {
  const css = [], out = [];
  let y = TOP;

  messages.forEach((m, idx) => {
    const i = idx + 1;
    const lines = wrap(m.text);
    const rows = lines.length + (m.link ? 1 : 0);
    const widest = Math.max(...lines.map(units), m.link ? units(m.link.label) : 0);
    const w = Math.round(widest * CHAR + PAD);
    const h = 22 + LINE_H * rows;

    const typingAt = 0.15 + idx * 1.9;
    css.push(`    .t${i} { animation-delay: ${typingAt.toFixed(2)}s; }`);
    css.push(`    .m${i} { animation-delay: ${(typingAt + 1.15).toFixed(2)}s; }`);

    const texts = lines.map(
      (l, k) => `<text class="message" x="17" y="${29 + LINE_H * k}">${esc(l)}</text>`
    );
    if (m.link) {
      texts.push(
        `<a href="${esc(m.link.href)}" target="_blank">\n      <text class="message link" x="17" y="${29 + LINE_H * lines.length}">${esc(m.link.label)}</text>\n    </a>`
      );
    }

    out.push(`  <!-- Message ${i} -->`);
    out.push(
      `  <g transform="translate(18 ${y})">\n    <g class="typing t${i}">\n      <rect class="bubble" width="76" height="42" rx="20"/>\n      ${DOTS}\n    </g>\n  </g>`
    );
    out.push(
      `  <g transform="translate(18 ${y})">\n    <g class="msg m${i}">\n      <rect class="bubble" width="${w}" height="${h}" rx="18"/>\n      ${texts.join("\n      ")}\n    </g>\n  </g>\n`
    );
    y += h + GAP;
  });

  return { css: css.join("\n"), body: out.join("\n"), height: y - GAP + 12 };
}

// ---------- build ----------

const template = await readFile(new URL("./template.svg", import.meta.url), "utf8");
const { css, body, height } = render(await getMessages());

await writeFile(
  new URL("./chat.svg", import.meta.url),
  template
    .replaceAll("{{HEIGHT}}", String(height))
    .replace("{{DELAYS}}", css)
    .replace("{{MESSAGES}}", body)
);
console.log(`chat.svg generato (${height}px)`);
