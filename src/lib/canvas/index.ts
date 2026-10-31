// Part A public entry. Other parts import only from here (or from @/lib/contracts).
export { createCanvasApi } from "./canvasApi";
export type { CanvasOptions, CanvasHandle, CanvasEquation } from "./canvasApi";
export type { InkRecognizer } from "./readInk";
export { LESSON_CARD_ID } from "./visualStore";
export type { LessonItem, LessonState, SafeArea, VisualStore } from "./visualStore";
