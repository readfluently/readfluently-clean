// -------- Elements ----------
const crumb = document.getElementById("crumb");
const chapterTitle = document.getElementById("chapterTitle");
const chapterText = document.getElementById("chapterText");
const chapterError = document.getElementById("chapterError");
const audio = document.getElementById("audio");

const btnComplete = document.getElementById("btnComplete");
const pillStatus = document.getElementById("pillStatus");

// Recorder
const btnRecord = document.getElementById("btnRecord");
const btnStop   = document.getElementById("btnStop");
const btnPlay   = document.getElementById("btnPlay");
const btnClear  = document.getElementById("btnClear");
const btnDownload = document.getElementById("btnDownload");
const statusEl  = document.getElementById("status");
const player    = document.getElementById("player");

// Vocab
const wordInput = document.getElementById("wordInput");
const btnDefine = document.getElementById("btnDefine");
const btnSpeak  = document.getElementById("btnSpeak");
const definitionEl = document.getElementById("definition");

// -------- Helpers ----------
const PROGRESS_KEY = "rf_progress_v1";

function setStatus(msg) {
  statusEl.textContent = `Status: ${msg}`;
}

function showErr(msg) {
  if (!chapterError) return;
  chapterError.style.display = "block";
  chapterError.textContent = msg;
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }

function getParams() {
  const u = new URL(window.location.href);
  return { bookId: u.searchParams.get("book"), chapterId: u.searchParams.get("chapter") };
}

function supportsRecording() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function renderText(raw) {
  // Handles BOTH literal "\n" and real newlines.
  const normalized = (raw || "").replace(/\\n/g, "\n");
  chapterText.innerHTML = normalized
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${line}</p>`)
    .join("");
}

// -------- Recorder ----------
let mediaRecorder = null;
let chunks = [];
let audioUrl = null;
let audioBlob = null;

function resetRecording() {
  chunks = [];
  audioBlob = null;
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;

  player.hidden = true;
  player.removeAttribute("src");

  btnPlay.disabled = true;
  btnClear.disabled = true;
  btnDownload.disabled = true;
}

async function startRecording() {
  if (!supportsRecording()) {
    setStatus("Recording not supported. Try Chrome/Edge.");
    return;
  }
  try {
    resetRecording();
    setStatus("Requesting microphone permission…");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
    const options = {};
    for (const t of preferred) {
      if (MediaRecorder.isTypeSupported(t)) { options.mimeType = t; break; }
    }

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(tr => tr.stop());

      audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      audioUrl = URL.createObjectURL(audioBlob);

      player.src = audioUrl;
      player.hidden = false;

      btnPlay.disabled = false;
      btnClear.disabled = false;
      btnDownload.disabled = false;

      setStatus("Recorded ✅ ready to play");
    };

    mediaRecorder.start();

    btnRecord.disabled = true;
    btnStop.disabled = false;
    setStatus("Recording… speak now");
  } catch (err) {
    setStatus(`Mic blocked or error: ${err?.message || err}`);
  }
}

function stopRecording() {
  try {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  } catch (err) {
    setStatus(`Stop error: ${err?.message || err}`);
  } finally {
    btnStop.disabled = true;
    btnRecord.disabled = false;
    setStatus("Stopping…");
  }
}

async function playRecording() {
  if (!audioUrl) return;
  try {
    await player.play();
    setStatus("Playing ▶️");
  } catch {
    setStatus("Tap the player controls to play (autoplay blocked).");
  }
}

function downloadRecording() {
  if (!audioBlob) return;
  const a = document.createElement("a");
  const ext = (audioBlob.type || "").includes("ogg") ? "ogg" : "webm";
  a.href = audioUrl;
  a.download = `reading-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Wire buttons immediately
btnStop.disabled = true;
btnPlay.disabled = true;
btnClear.disabled = true;
btnDownload.disabled = true;
setStatus("idle");

btnRecord.addEventListener("click", startRecording);
btnStop.addEventListener("click", stopRecording);
btnPlay.addEventListener("click", playRecording);
btnClear.addEventListener("click", () => { resetRecording(); setStatus("Cleared (idle)"); });
btnDownload.addEventListener("click", downloadRecording);

// -------- Main ----------
async function main() {
  const { bookId, chapterId } = getParams();
  if (!bookId || !chapterId) {
    crumb.textContent = "Error";
    chapterTitle.textContent = "Open from Home page";
    showErr("Missing book/chapter in the link. Go back and tap a chapter button.");
    return;
  }

  try {
    const [dataRes, dictRes] = await Promise.all([
      fetch("./data.json", { cache: "no-store" }),
      fetch("./dictionary.json", { cache: "no-store" })
    ]);

    if (!dataRes.ok) throw new Error(`data.json failed (${dataRes.status})`);
    if (!dictRes.ok) throw new Error(`dictionary.json failed (${dictRes.status})`);

    const data = await dataRes.json();
    const dict = await dictRes.json();

    const book = (data.books || []).find(b => b.id === bookId);
    const ch = (book?.chapters || []).find(c => c.id === chapterId);

    if (!book) throw new Error(`Book not found: ${bookId}`);
    if (!ch) throw new Error(`Chapter not found: ${chapterId}`);

    crumb.textContent = book.title;
    chapterTitle.textContent = ch.title;

    renderText(ch.text);

    // optional audio
    if (ch.audioUrl && ch.audioUrl.trim()) {
      audio.src = ch.audioUrl.trim();
      audio.hidden = false;
    } else {
      audio.hidden = true;
    }

    // progress
    const progress = loadProgress();
    const done = !!progress?.[bookId]?.[chapterId];
    pillStatus.textContent = done ? "✅ Complete" : "Not complete";

    btnComplete.addEventListener("click", () => {
      const p = loadProgress();
      p[bookId] = p[bookId] || {};
      p[bookId][chapterId] = true;
      saveProgress(p);
      pillStatus.textContent = "✅ Complete";
    });

    // vocab
    function lookupWord(raw) {
      const w = (raw || "").trim().toLowerCase();
      if (!w) return { word: "", def: "" };
      return { word: w, def: dict[w] || "" };
    }

    btnSpeak.disabled = true;

    btnDefine.addEventListener("click", () => {
      const { word, def } = lookupWord(wordInput.value);
      if (!word) {
        definitionEl.textContent = "—";
        btnSpeak.disabled = true;
        return;
      }
      if (!def) {
        definitionEl.textContent = `No definition found for “${word}”. Add it in dictionary.json.`;
        btnSpeak.disabled = true;
        return;
      }
      definitionEl.textContent = def;
      btnSpeak.disabled = false;
    });

    btnSpeak.addEventListener("click", () => {
      const text = definitionEl.textContent?.trim();
      if (!text || text === "—") return;
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    });

  } catch (err) {
    console.error(err);
    crumb.textContent = "Error";
    chapterTitle.textContent = "Could not load chapter";
    showErr(err.message);
  }
}

main();
