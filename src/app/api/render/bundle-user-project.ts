import {execFileSync} from "node:child_process";
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {buildUserProject} from "../../../../lib/user-project";

export function bundleUserProject(code: string, options: {fps: number; width: number; height: number; durationInFrames: number}) {
  const project = buildUserProject(code, options);
  const dir = mkdtempSync(path.join(os.tmpdir(), "remotion-user-"));
  const outDir = path.join(dir, "bundle");
  mkdirSync(path.join(dir, "src"), {recursive: true});
  for (const [file, content] of Object.entries(project.files)) {
    const target = path.join(dir, file);
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, content, "utf8");
  }
  const cli = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "remotion.cmd" : "remotion");
  execFileSync(cli, ["bundle", project.entryPoint, "--out-dir", outDir], {cwd: dir, stdio: "pipe", timeout: 120_000});
  return {bundleDir: outDir, compositionId: project.compositionId, cleanup: () => rmSync(dir, {recursive: true, force: true})};
}