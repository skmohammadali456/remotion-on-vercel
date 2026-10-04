import {addBundleToSandbox, createSandbox, renderMediaOnVercel, uploadToVercelBlob} from "@remotion/vercel";
import {waitUntil} from "@vercel/functions";
import {RenderRequest} from "../../../../types/schema";
import {formatSSE, type RenderProgress} from "./helpers";
import {restoreSnapshot} from "./restore-snapshot";
import {bundleUserProject} from "./bundle-user-project";

export const maxDuration = 800;

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  const body = RenderRequest.parse(await req.json());
  const send = async (message: RenderProgress) => writer.write(encoder.encode(formatSSE(message)));
  const runRender = async () => {
    let sandbox: Awaited<ReturnType<typeof createSandbox>> | undefined;
    let cleanup = () => {};
    try {
      await send({type: "phase", phase: "Bundling your Remotion code...", progress: 0.05});
      const dynamic = bundleUserProject(body.code, {fps: body.fps, width: body.width, height: body.height, durationInFrames: body.durationInFrames});
      cleanup = dynamic.cleanup;
      await send({type: "phase", phase: "Creating render sandbox...", progress: 0.12});
      sandbox = process.env.VERCEL ? await restoreSnapshot() : await createSandbox({onProgress: async ({progress, message}) => send({type: "phase", phase: message, progress: 0.12 + progress * 0.18, subtitle: "Preparing the rendering environment."})});
      await send({type: "phase", phase: "Uploading project bundle...", progress: 0.32});
      await addBundleToSandbox({sandbox, bundleDir: dynamic.bundleDir});
      const {sandboxFilePath, contentType} = await renderMediaOnVercel({
        sandbox,
        compositionId: dynamic.compositionId,
        inputProps: {},
        onProgress: async (update) => {
          await send({type: "phase", phase: update.stage === "opening-browser" ? "Opening browser..." : update.stage === "selecting-composition" ? "Selecting composition..." : update.stage === "render-progress" ? "Rendering video..." : "Rendering...", progress: 0.35 + update.overallProgress * 0.6});
        },
      });
      await send({type: "phase", phase: "Uploading MP4...", progress: 0.97});
      const {url, size} = await uploadToVercelBlob({sandbox, sandboxFilePath, contentType, blobToken, access: "public"});
      await send({type: "done", url, size});
    } catch (err) {
      console.error(err);
      await send({type: "error", message: err instanceof Error ? err.message : String(err)});
    } finally {
      cleanup();
      await sandbox?.stop().catch(() => {});
      await writer.close();
    }
  };
  waitUntil(runRender());
  return new Response(stream.readable, {headers: {"Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive"}});
}