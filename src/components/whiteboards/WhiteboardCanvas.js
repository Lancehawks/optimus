"use client";

import "@excalidraw/excalidraw/index.css";
import { ArrowLeft, Download } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button, Spinner } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { deleteWhiteboardDraft, saveWhiteboardDraft } from "@/lib/whiteboardDraftStore";

const Excalidraw = dynamic(
  async () => {
    const mod = await import("@excalidraw/excalidraw");
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-surface-secondary">
        <Spinner />
      </div>
    ),
  }
);

// Keys to persist from appState (strip transient UI state)
const PERSIST_APP_STATE_KEYS = [
  "viewBackgroundColor",
  "gridSize",
  "gridStep",
  "gridModeEnabled",
  "theme",
  "zenModeEnabled",
  "scrollX",
  "scrollY",
  "zoom",
];

function cleanAppState(appState) {
  const cleaned = {};
  for (const key of PERSIST_APP_STATE_KEYS) {
    if (appState[key] !== undefined) {
      cleaned[key] = appState[key];
    }
  }
  return cleaned;
}

export default function WhiteboardCanvas({ whiteboardId, initialData, onSave, onBack, title, onRename, readOnly = false }) {
  const { mode } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const titleInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const latestDataRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const savePromiseRef = useRef(Promise.resolve(true));
  const draftTimeoutRef = useRef(null);
  const draftPendingRef = useRef(null);
  const draftWriteRef = useRef(Promise.resolve());
  const isMountedRef = useRef(true);
  const thumbnailTimeoutRef = useRef(null);
  const pendingTitleRef = useRef(null);
  const titleSavePromiseRef = useRef(Promise.resolve(true));
  const titleSaveInFlightRef = useRef(false);

  useEffect(() => { setTitleValue(title); }, [title]);

  const handleTitleClick = () => {
    if (readOnly) return;
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  };

  const savePendingTitle = useCallback(() => {
    if (!pendingTitleRef.current || !onRename) return titleSavePromiseRef.current;
    if (titleSaveInFlightRef.current) return titleSavePromiseRef.current;
    const nextTitle = pendingTitleRef.current;
    titleSaveInFlightRef.current = true;
    setSaveStatus("saving");
    titleSavePromiseRef.current = Promise.resolve(onRename(nextTitle))
      .then(() => {
        if (pendingTitleRef.current === nextTitle) pendingTitleRef.current = null;
        setSaveStatus("saved");
        return true;
      })
      .catch(() => {
        setSaveStatus("error");
        return false;
      })
      .finally(() => {
        titleSaveInFlightRef.current = false;
      });
    return titleSavePromiseRef.current;
  }, [onRename]);

  const handleTitleSave = useCallback(() => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      setTitleValue(title);
    } else if (trimmed !== title && onRename) {
      pendingTitleRef.current = trimmed;
      void savePendingTitle();
    }
    setIsEditingTitle(false);
  }, [onRename, savePendingTitle, title, titleValue]);

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") { setTitleValue(title); setIsEditingTitle(false); }
  };

  // Generate a thumbnail as a data URL
  const generateThumbnail = useCallback(async (api) => {
    if (!api) return null;
    try {
      const elements = api.getSceneElements();
      if (!elements || elements.filter((e) => !e.isDeleted).length === 0) return null;

      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements,
        appState: {
          ...api.getAppState(),
          exportWithDarkMode: true,
          exportBackground: true,
        },
        files: api.getFiles(),
        maxWidthOrHeight: 320,
      });

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }, []);

  const persistDraft = useCallback((snapshot) => {
    if (!whiteboardId || !snapshot) return Promise.resolve();
    const data = {
      elements: snapshot.elements,
      appState: cleanAppState(snapshot.appState),
      files: snapshot.files,
    };
    draftWriteRef.current = draftWriteRef.current
      .catch(() => undefined)
      .then(() => saveWhiteboardDraft(whiteboardId, data))
      .catch(() => undefined);
    return draftWriteRef.current;
  }, [whiteboardId]);

  const flushDraft = useCallback(() => {
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    draftTimeoutRef.current = null;
    const snapshot = draftPendingRef.current;
    draftPendingRef.current = null;
    return snapshot ? persistDraft(snapshot) : draftWriteRef.current;
  }, [persistDraft]);

  const scheduleDraft = useCallback((snapshot) => {
    draftPendingRef.current = snapshot;
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    draftTimeoutRef.current = setTimeout(() => {
      void flushDraft();
    }, 150);
  }, [flushDraft]);

  const drainPendingSaves = useCallback(() => {
    if (saveInFlightRef.current) return savePromiseRef.current;
    if (!latestDataRef.current) return Promise.resolve(true);

    saveInFlightRef.current = true;
    savePromiseRef.current = (async () => {
      await flushDraft();
      while (latestDataRef.current) {
        const snapshot = latestDataRef.current;
        latestDataRef.current = null;
        if (isMountedRef.current) setSaveStatus("saving");
        try {
          await onSave({
            elements: snapshot.elements,
            appState: cleanAppState(snapshot.appState),
            files: snapshot.files,
          });
        } catch {
          // A newer snapshot already contains the failed snapshot's scene.
          // Restore only when no newer edit is waiting.
          if (!latestDataRef.current) latestDataRef.current = snapshot;
          if (isMountedRef.current) setSaveStatus("error");
          return false;
        }
      }

      await draftWriteRef.current.catch(() => undefined);
      await deleteWhiteboardDraft(whiteboardId).catch(() => undefined);
      if (isMountedRef.current) setSaveStatus("saved");
      return true;
    })().finally(() => {
      saveInFlightRef.current = false;
    });
    return savePromiseRef.current;
  }, [flushDraft, onSave, whiteboardId]);

  // Flush pending save and return whether the server accepted every snapshot.
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    return drainPendingSaves();
  }, [drainPendingSaves]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void flushDraft();
      void flushSave();
      if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
    };
  }, [flushDraft, flushSave]);

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!latestDataRef.current && !saveInFlightRef.current) return;
      event.preventDefault();
      event.returnValue = "";
      void flushDraft();
      void flushSave();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [flushDraft, flushSave]);

  const handleChange = useCallback(
    (elements, appState, files) => {
      if (readOnly) return;

      latestDataRef.current = { elements, appState, files };
      scheduleDraft(latestDataRef.current);
      setSaveStatus("unsaved");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        saveTimeoutRef.current = null;
        if (!isMountedRef.current) return;
        const saved = await drainPendingSaves();
        if (saved) {
          if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
          thumbnailTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;
            const thumbDataUrl = await generateThumbnail(excalidrawAPI);
            if (thumbDataUrl && isMountedRef.current) {
              void onSave({ thumbnailUrl: thumbDataUrl }).catch(() => undefined);
            }
          }, 5000);
        }
      }, 2500);
    },
    [onSave, readOnly, generateThumbnail, excalidrawAPI, drainPendingSaves, scheduleDraft]
  );

  const handleBack = useCallback(async () => {
    if (isEditingTitle) handleTitleSave();
    const titleSaved = await savePendingTitle();
    if (!titleSaved) return;
    const saved = await flushSave();
    if (saved) onBack?.();
  }, [flushSave, handleTitleSave, isEditingTitle, onBack, savePendingTitle]);

  const retrySave = useCallback(async () => {
    const titleSaved = await savePendingTitle();
    if (titleSaved) await flushSave();
  }, [flushSave, savePendingTitle]);

  const handleExportPng = async () => {
    if (!excalidrawAPI) return;
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: {
          ...excalidrawAPI.getAppState(),
          exportWithDarkMode: true,
          exportBackground: true,
        },
        files: excalidrawAPI.getFiles(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "whiteboard"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PNG export failed:", error);
    }
  };

  const handleExportSvg = async () => {
    if (!excalidrawAPI) return;
    try {
      const { exportToSvg } = await import("@excalidraw/excalidraw");
      const svg = await exportToSvg({
        elements: excalidrawAPI.getSceneElements(),
        appState: {
          ...excalidrawAPI.getAppState(),
          exportWithDarkMode: true,
          exportBackground: true,
        },
        files: excalidrawAPI.getFiles(),
      });
      const svgString = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "whiteboard"}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("SVG export failed:", error);
    }
  };

  // Prepare initial data for Excalidraw
  const excalidrawInitialData = {
    elements: initialData?.elements || [],
    appState: {
      viewBackgroundColor: "#ffffff",
      ...(initialData?.appState || {}),
      // The app's light or dark mode decides the canvas theme.
      theme: mode === "dark" ? "dark" : "light",
    },
    files: initialData?.files || {},
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs text-muted transition-colors hover:bg-surface-tertiary hover:text-heading"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Boards
          </button>
          <span className="h-4 w-px bg-border" />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              aria-label="Board title"
              className="input-base focus:input-focus min-h-7! w-64 py-1! font-serif text-lg!"
            />
          ) : (
            <span
              className={`max-w-80 truncate rounded px-1.5 py-0.5 font-serif text-lg leading-6 text-heading transition-colors ${readOnly ? "cursor-default" : "cursor-text hover:bg-surface-tertiary"}`}
              onClick={handleTitleClick}
              title={readOnly ? "View only" : "Click to rename"}
            >
              {titleValue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs text-muted" aria-live="polite">
            {saveStatus === "saving" && "Saving"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "unsaved" && "Unsaved changes"}
            {saveStatus === "error" && (
              <button type="button" className="cursor-pointer text-danger hover:underline" onClick={() => void retrySave()}>
                Not saved · Retry
              </button>
            )}
          </span>
          <Button variant="ghost" size="sm" leftIcon={<Download />} onClick={handleExportPng} title="Export as PNG">PNG</Button>
          <Button variant="ghost" size="sm" leftIcon={<Download />} onClick={handleExportSvg} title="Export as SVG">SVG</Button>
        </div>
      </div>

      <div className="excalidraw-wrapper flex-1 overflow-hidden">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={excalidrawInitialData}
          onChange={handleChange}
          viewModeEnabled={readOnly}
          theme={mode === "dark" ? "dark" : "light"}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
              saveToActiveFile: false,
            },
          }}
        />
      </div>
    </div>
  );
}
