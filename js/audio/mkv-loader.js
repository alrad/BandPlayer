// BandPlayer: local, same-origin FFmpeg worker and core. No uploads.
import { FFmpeg } from '../../vendor/ffmpeg/index.js';

let ffmpeg;

async function blobFromLocal(path, mime) {
  const url = new URL(path, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Missing audio engine file ${url.pathname} (HTTP ${response.status})`);
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], {type:mime}));
}

async function getEngine(progress) {
  if (ffmpeg) return ffmpeg;
  const attempts = [
    {label:'ES module core', js:'../../vendor/core-esm/ffmpeg-core.js', wasm:'../../vendor/core-esm/ffmpeg-core.wasm'},
    {label:'classic core', js:'../../vendor/core/ffmpeg-core.js', wasm:'../../vendor/core/ffmpeg-core.wasm'}
  ];
  const errors = [];
  for (const attempt of attempts) {
    progress(`Initializing audio engine (${attempt.label})...`);
    let coreURL, wasmURL;
    const instance = new FFmpeg();
    try {
      coreURL = await blobFromLocal(attempt.js, 'text/javascript');
      wasmURL = await blobFromLocal(attempt.wasm, 'application/wasm');
      await instance.load({coreURL, wasmURL});
      ffmpeg = instance;
      return instance;
    } catch (error) {
      const message = error?.message || String(error);
      errors.push(`${attempt.label}: ${message}`);
      console.error(`BandPlayer ${attempt.label} failed`, error);
      try { instance.terminate(); } catch {}
    } finally {
      // Do not revoke until the engine has had a chance to load its WASM.
      if (coreURL) URL.revokeObjectURL(coreURL);
      if (wasmURL) URL.revokeObjectURL(wasmURL);
    }
  }
  throw new Error(`Audio engine initialization failed. ${errors.join(' | ')}. Check browser Console for details.`);
}

export async function loadMkv(file, progress = () => {}) {
  const engine = await getEngine(progress);
  const input = 'bandplayer-input.mkv';
  const logs = [];
  const logger = ({ message }) => logs.push(message);
  engine.on('log', logger);
  const results = [];
  try {
    progress('Reading MKV...');
    await engine.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    // FFmpeg prints stream metadata even though no output was specified.
    await engine.exec(['-hide_banner', '-i', input]);
    const lines = logs.join('\n').split('\n');
    const streams = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/Stream #0:(\d+)(?:\([^)]*\))?: Audio: mp3\b/i);
      if (!match) continue;
      let title = `Instrument ${streams.length + 1}`;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (/Stream #|^\s*Chapter #/.test(lines[j])) break;
        const found = lines[j].match(/^\s*title\s*:\s*(.+)$/i);
        if (found) { title = found[1].trim(); break; }
      }
      streams.push({ index: Number(match[1]), title });
    }
    if (!streams.length) throw new Error('No MP3 streams found in this MKV.');
    progress(`Found ${streams.length} instruments.`);
    for (let i = 0; i < streams.length; i++) {
      const stream = streams[i];
      const output = `bandplayer-stem-${i}.mp3`;
      progress(`Extracting ${i + 1}/${streams.length}: ${stream.title}...`);
      const exit = await engine.exec(['-y', '-v', 'error', '-i', input, '-map', `0:${stream.index}`, '-c:a', 'copy', output]);
      if (exit !== 0) throw new Error(`Failed extracting ${stream.title} (code ${exit}).`);
      const bytes = await engine.readFile(output);
      results.push({ name: stream.title, bytes: new Uint8Array(bytes) });
      await engine.deleteFile(output);
    }
    return results;
  } finally {
    engine.off('log', logger);
    try { await engine.deleteFile(input); } catch {}
  }
}
