"use client";

// Part D public entry. Math stays in @/lib/math so it can also be used on the server.
export { createVisualsApi } from "./visualsApi";
export type { VisualsController, VisualsOptions } from "./visualsApi";
export { Graph, TeachingVisual } from "./Graph";
export { MathText } from "./MathText";
export { FunctionExplorer } from "./FunctionExplorer";
export type { CurveSpec, VisualSpec } from "./model";
