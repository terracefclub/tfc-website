// The only module that talks to the OCR engine. The engine comes from the repo devenv (devenv.nix).
import { OCR_LANGUAGE, OCR_OEM, OCR_PSM, parseEngineVersion, parseTsv, type Reading } from './lib';

export async function engineVersion(): Promise<string> {
  let proc;
  try { proc = Bun.spawnSync(['tesseract', '--version'], { stdout: 'pipe', stderr: 'pipe' }); }
  catch { throw new Error('tesseract not found on PATH. Run this through the repo devenv: direnv exec . bun run ocr:newsletters'); }
  const output = proc.stdout.toString() + proc.stderr.toString();
  const version = parseEngineVersion(output);
  const langs = Bun.spawnSync(['tesseract', '--list-langs'], { stdout: 'pipe', stderr: 'pipe' }).stdout.toString();
  if (!langs.split('\n').map((line) => line.trim()).includes(OCR_LANGUAGE)) throw new Error(`tesseract has no "${OCR_LANGUAGE}" language data`);
  return version;
}

export async function recognise(path: string, method: number): Promise<Reading> {
  const proc = Bun.spawn(['tesseract', path, 'stdout', '-l', OCR_LANGUAGE, '--oem', String(OCR_OEM), '--psm', String(OCR_PSM), '-c', `thresholding_method=${method}`, 'tsv'], {
    // One thread per process keeps results reproducible; parallelism comes from running several processes.
    env: { ...process.env, OMP_THREAD_LIMIT: '1' }, stdout: 'pipe', stderr: 'pipe'
  });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`tesseract exited ${code}: ${stderr.trim().split('\n').slice(-2).join(' ')}`);
  return { method, ...parseTsv(stdout) };
}
