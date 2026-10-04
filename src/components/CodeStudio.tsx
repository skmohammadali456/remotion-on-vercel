"use client";

import {useEffect, useRef, useState} from "react";
import {Player} from "@remotion/player";
import {createBrowserBundler, type BrowserBundler} from "@remotion/browser-bundler";
import {getBrowserComposition, loadBrowserBundle} from "@remotion/browser-bundler/runtime";
import {buildUserProject, DEFAULT_CODE} from "../lib/user-project";

export const CodeStudio = () => {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [composition, setComposition] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready");
  const [rendering, setRendering] = useState(false);
  const bundlerRef = useRef<BrowserBundler | null>(null);

  useEffect(() => () => bundlerRef.current?.dispose(), []);

  const compile = async () => {
    setError(null);
    setStatus("Compiling Remotion project...");
    try {
      if (!window.crossOriginIsolated) throw new Error("Browser isolation is not enabled. Open the deployed HTTPS site or localhost with the required COOP and COEP headers.");
      if (!bundlerRef.current) bundlerRef.current = createBrowserBundler({workerUrl: new URL("/compiler/browser-bundler-worker.js", window.location.origin)});
      const project = buildUserProject(code, {fps: 30, width: 1920, height: 1080, durationInFrames: 180});
      const bundle = await bundlerRef.current.bundle({project});
      const root = loadBrowserBundle({bundle});
      const resolved = await getBrowserComposition({root, compositionId: project.compositionId, inputProps: {}});
      setComposition(resolved);
      setStatus(bundle.warnings.length ? `Preview ready with ${bundle.warnings.length} warning(s)` : "Preview ready");
    } catch (e) {
      setComposition(null);
      setError(e instanceof Error ? e.message : String(e));
      setStatus("Compilation failed");
    }
  };

  const renderVideo = async () => {
    setRendering(true);
    setError(null);
    try {
      const response = await fetch("/api/render", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({code, fps: 30, width: 1920, height: 1080, durationInFrames: 180})});
      if (!response.ok || !response.body) throw new Error(await response.text());
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const message = JSON.parse(chunk.slice(6));
          if (message.type === "phase") setStatus(`${message.phase} ${Math.round(message.progress * 100)}%`);
          if (message.type === "error") throw new Error(message.message);
          if (message.type === "done") {
            setStatus("Render complete");
            window.open(message.url, "_blank", "noopener,noreferrer");
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("Render failed");
    } finally {
      setRendering(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <div className="mx-auto max-w-[1600px] p-6">
        <header className="mb-6 flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold">Remotion Video Studio</h1><p className="text-sm text-white/50">Write Remotion TSX, preview it, then render the same source on Vercel Sandbox.</p></div>
          <div className="text-sm text-white/50">{status}</div>
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="text-sm font-medium">Remotion TSX</span><button onClick={() => setCode(DEFAULT_CODE)} className="text-xs text-white/50 hover:text-white">Reset</button></div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} className="h-[620px] w-full resize-none bg-[#0c0c0c] p-5 font-mono text-sm leading-6 text-white outline-none" />
          </section>
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="text-sm font-medium">Preview</span><div className="flex gap-2"><button onClick={compile} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Run Preview</button><button disabled={!composition || rendering} onClick={renderVideo} className="rounded-lg bg-white/10 px-4 py-2 text-sm disabled:opacity-40">{rendering ? "Rendering..." : "Render MP4"}</button></div></div>
            <div className="p-4"><div className="aspect-video overflow-hidden rounded-xl bg-black">
              {composition ? <Player component={composition.component} inputProps={composition.props} durationInFrames={composition.durationInFrames} fps={composition.fps} compositionWidth={composition.width} compositionHeight={composition.height} controls autoPlay loop style={{width: "100%", height: "100%"}} /> : <div className="flex h-full items-center justify-center text-sm text-white/40">Paste Remotion code and click Run Preview.</div>}
            </div></div>
            {error ? <pre className="m-4 max-h-48 overflow-auto rounded-lg bg-red-500/10 p-4 text-xs text-red-300">{error}</pre> : null}
          </section>
        </div>
        <p className="mt-5 text-xs text-white/35">Preview executes the code in the browser. Only use source you trust. MP4 rendering happens inside Vercel Sandbox.</p>
      </div>
    </main>
  );
};