// Part A public entry. Other parts import only from here (or from @/lib/contracts).
export { createCanvasApi, VISUAL_H, VISUAL_W } from "./canvasApi";
export type { CanvasOptions, CanvasHandle, CanvasEquation, SafeArea } from "./canvasApi";
export type { InkRecognizer } from "./readInk";
export { LESSON_CARD_ID } from "./visualStore";
export type { LessonColumn, LessonItem, LessonState, VisualStore } from "./visualStore";
