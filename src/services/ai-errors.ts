export type AIErrorKind =
  "configuration" | "network" | "timeout" | "service" | "output" | "model";
export class AIRequestError extends Error {
  constructor(
    message: string,
    public readonly kind: AIErrorKind,
  ) {
    super(message);
    this.name = "AIRequestError";
  }
}
