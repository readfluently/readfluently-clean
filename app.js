const booksEl = document.getElementById("books");
const btnReset = document.getElementById("btnReset");
const homeStatus = document.getElementById("homeStatus");

const PROGRESS_KEY = "rf_progress_v1";

function showHomeError(msg) {
  if (!homeStatus) return;
  homeStatus.style.display = "block";
  homeStatus.textContent = msg;
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); }
  catch { return {}; }
}
function isComplete(progress, bookId, chapterId) {
  return !!progress?.[bookId]?.[chapterId];
}
function chapterLink(bookId, chapterId) {
  const u = new URL("./chapter.html", window.location.href);
  u.searchParams.set("book", bookId);
  u.searchParams.set("chapter", chapterId);
  return u.toString();
}

async function main() {
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`data.json failed (${res.status})`);
    const data = await res.json();

    const progress = loadProgress();
    booksEl.innerHTML = "";

    (data.books || []).forEach(book => {
      const wrap = document.createElement("div");
      wrap.className = "block";

      const h = document.createElement("h2");
      h.textContent = book.title || "Untitled book";
      wrap.appendChild(h);

      const list = document.createElement("div");
      list.className = "row";

      (book.chapters || []).forEach(ch => {
        const a = document.createElement("a");
        a.href = chapterLink(book.id, ch.id);

        const done = isComplete(progress, book.id, ch.id);

        const card = document.createElement("div");
        card.className = "chapterCard";
        card.innerHTML = `
          <div class="chapterTitle">${ch.title}</div>
          <div class="chapterMeta">${done ? "✅ Completed" : "📖 Ready to start"}</div>
        `;

        a.appendChild(card);
        list.appendChild(a);
      });

      wrap.appendChild(list);
      booksEl.appendChild(wrap);
    });

    btnReset.addEventListener("click", () => {
      localStorage.removeItem(PROGRESS_KEY);
      window.location.reload();
    });

  } catch (err) {
    console.error(err);
    showHomeError(`Could not load books. ${err.message}`);
  }
}

main();
