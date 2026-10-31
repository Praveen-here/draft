/** A reader receives one grouped line; ambiguous or malformed replies must not reach the brain. */
export function validateInk(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 1 ||
    value.some((line) => typeof line !== "string" || !line.trim() || line.length > 4096)) {
    throw new Error("Couldn't read that line clearly. Please try again.", { cause: 422 });
  }
  return value.map((line: string) => line.trim());
}
