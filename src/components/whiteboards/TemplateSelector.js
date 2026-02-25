"use client";

const uid = () => Math.random().toString(36).slice(2, 10);

export const WHITEBOARD_TEMPLATES = [
  {
    name: "blank",
    label: "Blank Canvas",
    description: "Start from scratch",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    data: {
      elements: [],
      appState: { viewBackgroundColor: "#151923" },
      files: {},
    },
  },
  {
    name: "flowchart",
    label: "Flowchart",
    description: "Process flow with shapes and arrows",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    data: {
      elements: [
        {
          id: uid(),
          type: "rectangle",
          x: 300,
          y: 80,
          width: 180,
          height: 60,
          strokeColor: "#2dd4bf",
          backgroundColor: "#1c2130",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 0,
          roundness: { type: 3, value: 8 },
          angle: 0,
          opacity: 100,
          locked: false,
          isDeleted: false,
          boundElements: [],
          groupIds: [],
          frameId: null,
          link: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          updated: Date.now(),
        },
        {
          id: uid(),
          type: "text",
          x: 355,
          y: 98,
          width: 70,
          height: 25,
          text: "Start",
          fontSize: 20,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#2dd4bf",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          angle: 0,
          opacity: 100,
          locked: false,
          isDeleted: false,
          boundElements: [],
          groupIds: [],
          frameId: null,
          link: null,
          seed: 2,
          version: 1,
          versionNonce: 2,
          updated: Date.now(),
        },
        {
          id: uid(),
          type: "diamond",
          x: 300,
          y: 220,
          width: 180,
          height: 120,
          strokeColor: "#2dd4bf",
          backgroundColor: "#1c2130",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 0,
          angle: 0,
          opacity: 100,
          locked: false,
          isDeleted: false,
          boundElements: [],
          groupIds: [],
          frameId: null,
          link: null,
          seed: 3,
          version: 1,
          versionNonce: 3,
          updated: Date.now(),
        },
        {
          id: uid(),
          type: "text",
          x: 340,
          y: 267,
          width: 100,
          height: 25,
          text: "Decision?",
          fontSize: 18,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#2dd4bf",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          angle: 0,
          opacity: 100,
          locked: false,
          isDeleted: false,
          boundElements: [],
          groupIds: [],
          frameId: null,
          link: null,
          seed: 4,
          version: 1,
          versionNonce: 4,
          updated: Date.now(),
        },
        {
          id: uid(),
          type: "rectangle",
          x: 300,
          y: 420,
          width: 180,
          height: 60,
          strokeColor: "#2dd4bf",
          backgroundColor: "#1c2130",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 0,
          roundness: { type: 3, value: 8 },
          angle: 0,
          opacity: 100,
          locked: false,
          isDeleted: false,
          boundElements: [],
          groupIds: [],
          frameId: null,
          link: null,
          seed: 5,
          version: 1,
          versionNonce: 5,
          updated: Date.now(),
        },
        {
          id: uid(),
          type: "text",
          x: 365,
          y: 438,
          width: 50,
          height: 25,
          text: "End",
          fontSize: 20,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          strokeColor: "#2dd4bf",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          angle: 0,
          opacity: 100,
          locked: false,
          isDeleted: false,
          boundElements: [],
          groupIds: [],
          frameId: null,
          link: null,
          seed: 6,
          version: 1,
          versionNonce: 6,
          updated: Date.now(),
        },
      ],
      appState: { viewBackgroundColor: "#151923" },
      files: {},
    },
  },
  {
    name: "wireframe",
    label: "Wireframe",
    description: "UI layout skeleton",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
    data: {
      elements: [
        // Header
        {
          id: uid(), type: "rectangle", x: 100, y: 60, width: 600, height: 50,
          strokeColor: "#2dd4bf", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 10, version: 1, versionNonce: 10, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 120, y: 73, width: 60, height: 25,
          text: "Header", fontSize: 18, fontFamily: 1, textAlign: "left", verticalAlign: "middle",
          strokeColor: "#5eead4", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 11, version: 1, versionNonce: 11, updated: Date.now(),
        },
        // Sidebar
        {
          id: uid(), type: "rectangle", x: 100, y: 120, width: 160, height: 340,
          strokeColor: "#2dd4bf", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 12, version: 1, versionNonce: 12, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 120, y: 140, width: 70, height: 25,
          text: "Sidebar", fontSize: 16, fontFamily: 1, textAlign: "left", verticalAlign: "middle",
          strokeColor: "#5eead4", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 13, version: 1, versionNonce: 13, updated: Date.now(),
        },
        // Content
        {
          id: uid(), type: "rectangle", x: 270, y: 120, width: 430, height: 340,
          strokeColor: "#2dd4bf", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 14, version: 1, versionNonce: 14, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 290, y: 140, width: 80, height: 25,
          text: "Content", fontSize: 16, fontFamily: 1, textAlign: "left", verticalAlign: "middle",
          strokeColor: "#5eead4", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 15, version: 1, versionNonce: 15, updated: Date.now(),
        },
      ],
      appState: { viewBackgroundColor: "#151923" },
      files: {},
    },
  },
  {
    name: "system_design",
    label: "System Design",
    description: "Architecture diagram",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
    data: {
      elements: [
        // Client
        {
          id: uid(), type: "rectangle", x: 80, y: 180, width: 140, height: 80,
          strokeColor: "#2dd4bf", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 20, version: 1, versionNonce: 20, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 115, y: 208, width: 70, height: 25,
          text: "Client", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#2dd4bf", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 21, version: 1, versionNonce: 21, updated: Date.now(),
        },
        // API / Load Balancer
        {
          id: uid(), type: "rectangle", x: 320, y: 180, width: 160, height: 80,
          strokeColor: "#2dd4bf", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 22, version: 1, versionNonce: 22, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 340, y: 195, width: 120, height: 50,
          text: "API\nGateway", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#2dd4bf", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 23, version: 1, versionNonce: 23, updated: Date.now(),
        },
        // Server
        {
          id: uid(), type: "rectangle", x: 580, y: 120, width: 140, height: 80,
          strokeColor: "#2dd4bf", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 24, version: 1, versionNonce: 24, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 610, y: 148, width: 80, height: 25,
          text: "Server", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#2dd4bf", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 25, version: 1, versionNonce: 25, updated: Date.now(),
        },
        // Database
        {
          id: uid(), type: "rectangle", x: 580, y: 250, width: 140, height: 80,
          strokeColor: "#fbbf24", backgroundColor: "#1c2130", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 26, version: 1, versionNonce: 26, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 600, y: 278, width: 100, height: 25,
          text: "Database", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#fbbf24", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 27, version: 1, versionNonce: 27, updated: Date.now(),
        },
      ],
      appState: { viewBackgroundColor: "#151923" },
      files: {},
    },
  },
];

export default function TemplateSelector({ onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {WHITEBOARD_TEMPLATES.map((template) => (
        <button
          key={template.name}
          onClick={() => onSelect(template)}
          className="card card-hover p-5 text-left cursor-pointer flex flex-col items-center gap-3 transition-colors"
        >
          <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400">
            {template.icon}
          </div>
          <h4 className="text-body-sm text-heading! font-medium">{template.label}</h4>
          <p className="text-caption text-center">{template.description}</p>
        </button>
      ))}
    </div>
  );
}
