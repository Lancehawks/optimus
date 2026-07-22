"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui";

const Excalidraw = dynamic(
  async () => {
    const mod = await import("@excalidraw/excalidraw");
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-neutral-900">
        <Spinner size="lg" />
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

export default function WhiteboardCanvas({ initialData, onSave, onBack, title, onRename, readOnly = false }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const titleInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const latestDataRef = useRef(null);
  const isMountedRef = useRef(true);
  const thumbnailTimeoutRef = useRef(null);

  useEffect(() => { setTitleValue(title); }, [title]);

  const handleTitleClick = () => {
    if (readOnly) return;
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  };

  const handleTitleSave = () => {
    const trimmed = titleValue.trim();
    if (!trimmed) {
      setTitleValue(title);
    } else if (trimmed !== title && onRename) {
      onRename(trimmed);
    }
    setIsEditingTitle(false);
  };

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

  // Flush pending save
  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (latestDataRef.current) {
      const data = latestDataRef.current;
      latestDataRef.current = null;
      onSave({
        elements: data.elements,
        appState: cleanAppState(data.appState),
        files: data.files,
      });
    }
  }, [onSave]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      flushSave();
      if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
    };
  }, [flushSave]);

  const handleChange = useCallback(
    (elements, appState, files) => {
      if (readOnly) return;

      latestDataRef.current = { elements, appState, files };
      setSaveStatus("unsaved");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        saveTimeoutRef.current = null;
        if (!isMountedRef.current) return;

        setSaveStatus("saving");
        try {
          await onSave({
            elements,
            appState: cleanAppState(appState),
            files,
          });
          latestDataRef.current = null;
          if (isMountedRef.current) setSaveStatus("saved");

          // Generate thumbnail after a successful save (debounced separately)
          if (thumbnailTimeoutRef.current) clearTimeout(thumbnailTimeoutRef.current);
          thumbnailTimeoutRef.current = setTimeout(async () => {
            if (!isMountedRef.current) return;
            const thumbDataUrl = await generateThumbnail(excalidrawAPI);
            if (thumbDataUrl && isMountedRef.current) {
              onSave({ thumbnailUrl: thumbDataUrl });
            }
          }, 5000);
        } catch {
          if (isMountedRef.current) setSaveStatus("unsaved");
        }
      }, 2500);
    },
    [onSave, readOnly, generateThumbnail, excalidrawAPI]
  );

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
      viewBackgroundColor: "#151923",
      theme: "dark",
      ...(initialData?.appState || {}),
    },
    files: initialData?.files || {},
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-ghost rounded-lg p-1.5 cursor-pointer flex items-center gap-1.5 text-body-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="text-body-sm font-medium bg-surface-secondary border border-border rounded px-2 py-0.5 w-64 outline-none focus:border-brand-400 text-heading"
            />
          ) : (
            <span
              className={`text-body-sm text-heading! font-medium truncate max-w-64 px-1 py-0.5 rounded transition-colors ${readOnly ? "cursor-default" : "cursor-text hover:bg-surface-secondary"}`}
              onClick={handleTitleClick}
              title={readOnly ? "View only" : "Click to rename"}
            >
              {titleValue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-caption mr-2">
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "unsaved" && "Unsaved changes"}
          </span>

          <button
            onClick={handleExportPng}
            className="btn-ghost rounded-lg px-2.5 py-1.5 text-caption cursor-pointer"
            title="Export as PNG"
          >
            <svg className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            PNG
          </button>

          <button
            onClick={handleExportSvg}
            className="btn-ghost rounded-lg px-2.5 py-1.5 text-caption cursor-pointer"
            title="Export as SVG"
          >
            <svg className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            SVG
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas */}
      <div className="flex-1 overflow-hidden excalidraw-wrapper">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={excalidrawInitialData}
          onChange={handleChange}
          viewModeEnabled={readOnly}
          theme="dark"
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
