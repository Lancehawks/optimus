"use client";

import { LayoutTemplate, Network, Plus, Workflow } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);

export const WHITEBOARD_TEMPLATES = [
  {
    name: "blank",
    label: "Blank canvas",
    description: "Start from scratch",
    icon: Plus,
    data: {
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    },
  },
  {
    name: "flowchart",
    label: "Flowchart",
    description: "Process flow with shapes and arrows",
    icon: Workflow,
    data: {
      elements: [
        {
          id: uid(),
          type: "rectangle",
          x: 300,
          y: 80,
          width: 180,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "#f4f3f0",
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
          strokeColor: "#1e1e1e",
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
          strokeColor: "#1e1e1e",
          backgroundColor: "#f4f3f0",
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
          strokeColor: "#1e1e1e",
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
          strokeColor: "#1e1e1e",
          backgroundColor: "#f4f3f0",
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
          strokeColor: "#1e1e1e",
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
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    },
  },
  {
    name: "wireframe",
    label: "Wireframe",
    description: "UI layout skeleton",
    icon: LayoutTemplate,
    data: {
      elements: [
        // Header
        {
          id: uid(), type: "rectangle", x: 100, y: 60, width: 600, height: 50,
          strokeColor: "#1e1e1e", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 10, version: 1, versionNonce: 10, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 120, y: 73, width: 60, height: 25,
          text: "Header", fontSize: 18, fontFamily: 1, textAlign: "left", verticalAlign: "middle",
          strokeColor: "#3346d3", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 11, version: 1, versionNonce: 11, updated: Date.now(),
        },
        // Sidebar
        {
          id: uid(), type: "rectangle", x: 100, y: 120, width: 160, height: 340,
          strokeColor: "#1e1e1e", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 12, version: 1, versionNonce: 12, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 120, y: 140, width: 70, height: 25,
          text: "Sidebar", fontSize: 16, fontFamily: 1, textAlign: "left", verticalAlign: "middle",
          strokeColor: "#3346d3", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 13, version: 1, versionNonce: 13, updated: Date.now(),
        },
        // Content
        {
          id: uid(), type: "rectangle", x: 270, y: 120, width: 430, height: 340,
          strokeColor: "#1e1e1e", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 4 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 14, version: 1, versionNonce: 14, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 290, y: 140, width: 80, height: 25,
          text: "Content", fontSize: 16, fontFamily: 1, textAlign: "left", verticalAlign: "middle",
          strokeColor: "#3346d3", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 15, version: 1, versionNonce: 15, updated: Date.now(),
        },
      ],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    },
  },
  {
    name: "system_design",
    label: "System design",
    description: "Architecture diagram",
    icon: Network,
    data: {
      elements: [
        // Client
        {
          id: uid(), type: "rectangle", x: 80, y: 180, width: 140, height: 80,
          strokeColor: "#1e1e1e", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 20, version: 1, versionNonce: 20, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 115, y: 208, width: 70, height: 25,
          text: "Client", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 21, version: 1, versionNonce: 21, updated: Date.now(),
        },
        // API / Load Balancer
        {
          id: uid(), type: "rectangle", x: 320, y: 180, width: 160, height: 80,
          strokeColor: "#1e1e1e", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 22, version: 1, versionNonce: 22, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 340, y: 195, width: 120, height: 50,
          text: "API\nGateway", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 23, version: 1, versionNonce: 23, updated: Date.now(),
        },
        // Server
        {
          id: uid(), type: "rectangle", x: 580, y: 120, width: 140, height: 80,
          strokeColor: "#1e1e1e", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 24, version: 1, versionNonce: 24, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 610, y: 148, width: 80, height: 25,
          text: "Server", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 25, version: 1, versionNonce: 25, updated: Date.now(),
        },
        // Database
        {
          id: uid(), type: "rectangle", x: 580, y: 250, width: 140, height: 80,
          strokeColor: "#c47f17", backgroundColor: "#f4f3f0", fillStyle: "solid",
          strokeWidth: 2, roughness: 0, roundness: { type: 3, value: 8 },
          angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 26, version: 1, versionNonce: 26, updated: Date.now(),
        },
        {
          id: uid(), type: "text", x: 600, y: 278, width: 100, height: 25,
          text: "Database", fontSize: 18, fontFamily: 1, textAlign: "center", verticalAlign: "middle",
          strokeColor: "#c47f17", backgroundColor: "transparent", fillStyle: "solid",
          strokeWidth: 1, roughness: 0, angle: 0, opacity: 100, locked: false, isDeleted: false,
          boundElements: [], groupIds: [], frameId: null, link: null,
          seed: 27, version: 1, versionNonce: 27, updated: Date.now(),
        },
      ],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    },
  },
];

export default function TemplateSelector({ onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {WHITEBOARD_TEMPLATES.map((template) => {
        const Icon = template.icon;
        return (
          <button
            key={template.name}
            type="button"
            onClick={() => onSelect(template)}
            className="card card-hover group flex cursor-pointer flex-col overflow-hidden text-left"
          >
            <span
              className="flex aspect-[16/9] items-center justify-center border-b border-border bg-surface-secondary text-muted transition-colors group-hover:text-heading"
              style={{ backgroundImage: "radial-gradient(var(--neutral-500) 0.75px, transparent 0.75px)", backgroundSize: "12px 12px" }}
            >
              <Icon className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <span className="px-3.5 py-3">
              <span className="block text-sm font-medium text-heading">{template.label}</span>
              <span className="block text-xs text-muted">{template.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
