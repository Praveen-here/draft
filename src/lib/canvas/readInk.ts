import type { Editor } from "tldraw";
import { cropImage } from "./context";
import { padded } from "./geometry";
import type { InkLine } from "./lines";
import { validateInk } from "./inkResult";

/** Use the server reader, or inject the explicit fixture reader used in the canvas lab. */
export type InkRecognizer = (image: string, signal: AbortSignal) => Promise<string[]>;
export type RecognisedLine = InkLine & { latex: string };

export const requestInk: InkRecognizer = async (image, signal) => {
  signal.throwIfAborted();
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch("/app/read-ink", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }), signal: request.signal,
    });
    if (response.status === 429) throw new Error("Handwriting reading has reached its limit. Try again later; your writing is still on the page.");
    if (response.status === 503) throw new Error("Handwriting reading is unavailable. Your writing is still on the page.");
    if (response.status === 422) throw new Error("Couldn't read that line clearly. Please try again.", { cause: 422 });
    if (!response.ok) throw new Error("Couldn't read your writing. Please try again.");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("lines" in body)) throw new Error("The handwriting reader returned an invalid response.");
    return validateInk(body.lines);
  } catch (error) {
    if (request.signal.aborted && !signal.aborted) throw new Error("Reading took too long. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
};

/** Read one settled line, never one API call per pointer movement. */
export async function readInk(
  editor: Editor, line: InkLine, recognise: InkRecognizer, signal: AbortSignal,
): Promise<RecognisedLine> {
  const shapes = line.shapeIds.flatMap((id) => {
    const shape = editor.getShape(id as Parameters<Editor["getShape"]>[0]);
    return shape && shape.meta.author !== "tutor" && shape.meta.kind !== "circle" ? [shape] : [];
  });
  if (shapes.length !== line.shapeIds.length) throw new DOMException("Writing changed", "AbortError");
  const image = await cropImage(editor, shapes, padded(line.bbox));
  signal.throwIfAborted();
  const result = validateInk(await recognise(image, signal));
  signal.throwIfAborted();
  return { ...line, latex: result[0] };
}
