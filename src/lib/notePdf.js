// Notes become PDFs through the browser's print dialog ("Save as PDF"), which
// keeps text selectable and links live without a rendering dependency.
//
// The frame prints a copy of the editor as rendered, under the app's own
// stylesheets, so the PDF matches the note on screen. It always uses the light
// theme, since it's going on paper. Shared notes hold other members' content,
// so the sandbox leaves out allow-scripts: nothing in a note can run.
// allow-modals permits print(), and allow-same-origin lets this page fill the
// frame and load the stylesheets, fonts and private attachments.

const ASSET_WAIT_MS = 10_000;
const CLEANUP_DELAY_MS = 1_000;

// Only what paper needs differently. Everything else comes from the app's CSS.
const PRINT_STYLES = `
  @page { margin: 18mm 16mm; }
  * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  html, body { height: auto; min-height: 0; overflow: visible; background: #fff; }
  .note-print-title { margin: 0 0 1rem; overflow-wrap: anywhere; }
  .optimus-note .bn-editor { padding-inline: 0; }
  .bn-block-content:is([data-content-type="image"], [data-content-type="codeBlock"], [data-content-type="table"]) { break-inside: avoid; }
  .bn-block-outer:has(> .bn-block > .bn-block-content[data-content-type="heading"]) { break-after: avoid; }
  .bn-inline-content { orphans: 2; widows: 2; }
  .bn-inline-content::before { content: none !important; }
  .bn-block-content[data-content-type="codeBlock"] select,
  .bn-block-content[data-content-type="codeBlock"] > div:has(select) { display: none; }
  .bn-resize-handle, .bn-table-handle, .bn-side-menu, .bn-add-file-button { display: none !important; }
`;

const PRINT_DOCUMENT = '<!doctype html><html><head><meta charset="utf-8"></head><body><h1 class="note-print-title text-title"></h1><main></main></body></html>';

let activeFrame = null;

function removeActiveFrame() {
  activeFrame?.remove();
  activeFrame = null;
}

function loadEvent(element) {
  return new Promise((resolve) => {
    element.addEventListener("load", resolve, { once: true });
    element.addEventListener("error", resolve, { once: true });
  });
}

function withTimeout(promise) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ASSET_WAIT_MS))]);
}

function copyAppStyles(doc) {
  doc.documentElement.className = document.documentElement.className;
  doc.documentElement.setAttribute("data-theme", "light");
  doc.body.className = document.body.className;

  const sheets = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((sheet) => doc.importNode(sheet, true));
  const overrides = doc.createElement("style");
  overrides.textContent = PRINT_STYLES;
  const loaded = sheets.filter((sheet) => sheet.tagName === "LINK").map(loadEvent);
  doc.head.append(...sheets, overrides);
  return Promise.all(loaded);
}

// A still copy of the editor: only the text, none of its floating menus.
function copyEditor(doc, editorElement) {
  const container = doc.importNode(editorElement.closest(".bn-container"), false);
  const editor = doc.importNode(editorElement, true);
  container.append(editor);

  [container, ...container.querySelectorAll("[data-color-scheme], [data-mantine-color-scheme]")].forEach((element) => {
    element.classList.remove("dark");
    if (element.hasAttribute("data-color-scheme")) element.setAttribute("data-color-scheme", "light");
    if (element.hasAttribute("data-mantine-color-scheme")) element.setAttribute("data-mantine-color-scheme", "light");
  });
  container.querySelectorAll("[contenteditable]").forEach((element) => element.removeAttribute("contenteditable"));
  container.querySelectorAll(".ProseMirror-selectednode").forEach((element) => element.classList.remove("ProseMirror-selectednode"));

  // Paper can't play audio or video, so they print as links to the file.
  container.querySelectorAll("video, audio").forEach((media) => {
    const link = doc.createElement("a");
    link.href = media.currentSrc || media.src;
    link.textContent = link.href;
    media.replaceWith(link);
  });

  return container;
}

function waitForContent(doc) {
  const images = [...doc.images].filter((image) => !image.complete).map(loadEvent);
  // Fonts only start loading once text has been laid out.
  doc.body.getBoundingClientRect();
  return Promise.all([...images, doc.fonts.ready]);
}

export async function printNoteAsPdf({ title, editorElement }) {
  removeActiveFrame();

  const frame = document.createElement("iframe");
  activeFrame = frame;
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = PRINT_DOCUMENT;

  const loaded = loadEvent(frame);
  document.body.append(frame);
  await loaded;

  const name = title?.trim() || "Untitled";
  const doc = frame.contentDocument;
  doc.title = name;
  doc.querySelector(".note-print-title").textContent = name;
  doc.querySelector("main").append(copyEditor(doc, editorElement));

  await withTimeout(copyAppStyles(doc));
  await withTimeout(waitForContent(doc));
  // Another export started while this one loaded, and took over.
  if (activeFrame !== frame) return;

  // Browsers name the saved file after the page, which may be this one.
  const pageTitle = document.title;
  document.title = name;
  frame.contentWindow.addEventListener("afterprint", () => {
    document.title = pageTitle;
    setTimeout(() => {
      if (activeFrame === frame) removeActiveFrame();
    }, CLEANUP_DELAY_MS);
  }, { once: true });
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
