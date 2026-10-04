import {z} from "zod";

export const RenderRequest = z.object({
  code: z.string().min(1).max(300_000),
  fps: z.number().int().min(1).max(120),
  width: z.number().int().min(16).max(7680),
  height: z.number().int().min(16).max(7680),
  durationInFrames: z.number().int().min(1).max(60_000),
});

export type RenderResponse =
  | {type: "error"; message: string}
  | {type: "done"; url: string; size: number};

export type SSEMessage =
  | {type: "phase"; phase: string; progress: number; subtitle?: string}
  | {type: "done"; url: string; size: number}
  | {type: "error"; message: string};
