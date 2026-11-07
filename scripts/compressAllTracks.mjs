import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { Mp3Encoder } from '@breezystack/lamejs';

const outDir = 'public/audios/victoirek';
fs.mkdirSync(outDir, { recursive: true });

const inRoot = 'C:\\Users\\SYGMA-TECH\\Desktop\\CHANTRE VICTOIRE K';

function getAllAudioFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (!file.toLowerCase().includes('video')) {
        results = results.concat(getAllAudioFiles(full));
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.mp3' || ext === '.wav') {
        results.push(full);
      }
    }
  });
  return results;
}

const files = getAllAudioFiles(inRoot);
console.log(`Found ${files.length} audio files to compress...`);

function encodePcmToMp3(samples, channels, sampleRate, outPath, bitrate = 80) {
  const encoder = new Mp3Encoder(channels, sampleRate, bitrate);
  const mp3Data = [];
  const sampleBlockSize = 1152;

  if (channels === 1) {
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const chunk = samples.subarray(i, i + sampleBlockSize);
      const buf = encoder.encodeBuffer(chunk);
      if (buf.length > 0) mp3Data.push(Buffer.from(buf));
    }
  } else {
    const numPairs = Math.floor(samples.length / 2);
    const left = new Int16Array(numPairs);
    const right = new Int16Array(numPairs);
    for (let i = 0; i < numPairs; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
    for (let i = 0; i < numPairs; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      const buf = encoder.encodeBuffer(leftChunk, rightChunk);
      if (buf.length > 0) mp3Data.push(Buffer.from(buf));
    }
  }

  const flushBuf = encoder.flush();
  if (flushBuf.length > 0) mp3Data.push(Buffer.from(flushBuf));

  const finalMp3 = Buffer.concat(mp3Data);
  fs.writeFileSync(outPath, finalMp3);
  return finalMp3.length;
}

const tmpPcm = path.join(outDir, 'tmp.pcm');

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const base = path.basename(f);
  const cleanName = base
    .replace(/\.(mp3|wav)$/i, '.mp3')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/['’]/g, '')
    .replace(/[éèê]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[ùû]/g, 'u');

  const targetPath = path.join(outDir, cleanName);

  if (fs.existsSync(targetPath)) {
    const size = fs.statSync(targetPath).size;
    if (size < 5 * 1024 * 1024) {
      console.log(`[${i + 1}/${files.length}] Already compressed: ${cleanName} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      continue;
    }
  }

  console.log(`[${i + 1}/${files.length}] Compressing: ${base}...`);
  const origSizeMb = (fs.statSync(f).size / 1024 / 1024).toFixed(2);

  try {
    execFileSync('python', ['scripts/decode_to_pcm.py', f, tmpPcm]);

    const pcmBuffer = fs.readFileSync(tmpPcm);
    const sampleRate = pcmBuffer.readInt32LE(0);
    const channels = pcmBuffer.readInt32LE(4);
    const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset + 8, (pcmBuffer.length - 8) / 2);

    const newSizeBytes = encodePcmToMp3(samples, channels, sampleRate, targetPath, 80);
    const newSizeMb = (newSizeBytes / 1024 / 1024).toFixed(2);
    if (fs.existsSync(tmpPcm)) fs.unlinkSync(tmpPcm);

    console.log(`✓ Saved: ${cleanName} (${newSizeMb} MB, was ${origSizeMb} MB)`);
  } catch (err) {
    console.error(`Error on ${base}:`, err.message);
  }
}

console.log('\nAll tracks successfully compressed!');
