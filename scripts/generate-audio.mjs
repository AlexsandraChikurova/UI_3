/**
 * Original offline soundtrack for «Мопс: После полуночи».
 * All melodies, arrangements and instrument synthesis are authored here.
 * No recordings, copyrighted music, external soundfonts or services are used.
 * Run: node scripts/generate-audio.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'audio');
const RATE = 22050;
const TAU = Math.PI * 2;
fs.mkdirSync(OUT, { recursive: true });

const THEMES = [
  { name: 'menu', bpm: 88, lead: 'piano', comp: 'guitar', night: false, intensity: .72, subtitle: 'Дело на столе', seed: 110 },
  { name: 'park-day', bpm: 100, lead: 'flute', comp: 'guitar', night: false, intensity: .82, subtitle: 'Солнечные тропы', seed: 220 },
  { name: 'park-night', bpm: 82, lead: 'celesta', comp: 'piano', night: true, intensity: .63, subtitle: 'Лунная пыльца', seed: 330 },
  { name: 'shop-day', bpm: 108, lead: 'piano', comp: 'guitar', night: false, intensity: .76, subtitle: 'Лавка часовщика', seed: 440 },
  { name: 'shop-night', bpm: 84, lead: 'celesta', comp: 'piano', night: true, intensity: .56, subtitle: 'Закрытая дверь', seed: 550 },
  { name: 'square-day', bpm: 104, lead: 'flute', comp: 'piano', night: false, intensity: .80, subtitle: 'Площадь и фонари', seed: 660 },
  { name: 'square-night', bpm: 80, lead: 'piano', comp: 'celesta', night: true, intensity: .60, subtitle: 'Улица между улицами', seed: 770 },
  { name: 'house', bpm: 84, lead: 'piano', comp: 'celesta', night: true, intensity: .64, subtitle: 'Дом №0', seed: 880 },
];

// Eight-bar harmonic sentence, in D minor; A7 gently introduces the mystery.
const HARMONY = [
  { bass: 38, notes: [50, 57, 60, 65, 69] }, // Dm7 / added ninth in passing melody
  { bass: 34, notes: [50, 53, 57, 62, 65] }, // Bbmaj7
  { bass: 41, notes: [53, 57, 60, 64, 69] }, // Fmaj7
  { bass: 36, notes: [48, 55, 60, 62, 67] }, // Cadd9
  { bass: 31, notes: [50, 53, 57, 62, 67] }, // Gm9
  { bass: 38, notes: [50, 57, 60, 65, 69] }, // Dm7
  { bass: 34, notes: [50, 53, 57, 62, 65] }, // Bbmaj7
  { bass: 33, notes: [49, 55, 57, 61, 64] }, // A7
];

// Original singable phrases: [beat, MIDI pitch, length in beats].
// Breath between gestures matters more than a continuous stream of notes.
const PHRASE_A = [
  [[.5, 74, .8], [1.5, 69, .8], [2.5, 77, 1.2]],
  [[0, 76, .8], [1, 74, 1.0], [2.5, 69, 1.0]],
  [[.5, 72, .8], [1.5, 77, .8], [2.5, 76, 1.2]],
  [[0, 74, .7], [1, 72, .7], [2, 67, 1.5]],
  [[.5, 70, .9], [1.75, 74, .9], [3, 77, .7]],
  [[0, 76, .8], [1, 74, 1.2], [3, 69, .7]],
  [[.5, 65, .8], [1.5, 69, .8], [2.5, 74, 1.2]],
  [[0, 73, .8], [1, 71, .8], [2, 69, 1.25]],
];
const PHRASE_B = [
  [[0, 81, 1.2], [1.75, 79, .7], [2.75, 77, .9]],
  [[.5, 77, .8], [1.5, 74, 1.8]],
  [[0, 76, .9], [1.25, 77, .6], [2.25, 81, 1.3]],
  [[.5, 79, .8], [1.5, 76, .9], [2.75, 72, .9]],
  [[0, 77, .8], [1, 74, 1.0], [2.5, 70, 1.1]],
  [[.5, 69, 1.0], [2, 74, 1.5]],
  [[0, 74, .7], [1, 77, .8], [2.5, 69, 1.1]],
  [[.5, 73, .9], [1.75, 76, .8], [3, 69, .7]],
];

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function oscillator(frequency, phase = 0) {
  const step = TAU * frequency / RATE;
  const a = Math.cos(step), b = Math.sin(step);
  let sine = Math.sin(phase), cosine = Math.cos(phase), count = 0;
  return () => {
    const value = sine;
    const next = sine * a + cosine * b;
    cosine = cosine * a - sine * b; sine = next;
    // Avoid long-run recurrence drift without expensive per-sample trig.
    if ((++count & 4095) === 0) {
      const norm = 1 / Math.hypot(sine, cosine); sine *= norm; cosine *= norm;
    }
    return value;
  };
}

function envelope(t, duration, attack, release) {
  const rise = Math.min(1, t / attack);
  const fall = Math.min(1, Math.max(0, (duration - t) / release));
  return Math.sin(rise * Math.PI / 2) ** 2 * Math.sin(fall * Math.PI / 2) ** 2;
}

function synth(instrument, midi, duration, seed) {
  const f = 440 * 2 ** ((midi - 69) / 12);
  const length = Math.ceil(duration * RATE);
  const samples = new Float32Array(length);
  const random = rng(seed);

  if (instrument === 'guitar') {
    // Karplus-Strong: filtered plucked-string excitation, fractional delay.
    const period = RATE / f - .28;
    const bufferLength = Math.ceil(period) + 2;
    const buffer = new Float32Array(bufferLength);
    let lastNoise = 0;
    for (let i = 0; i < bufferLength; i++) {
      const noise = random() * 2 - 1;
      lastNoise = .58 * lastNoise + .42 * noise;
      buffer[i] = lastNoise * Math.sin(Math.PI * i / bufferLength);
    }
    let previous = 0, cursor = 0;
    const feedback = Math.exp(-1 / (f * (duration * .9 + .3)));
    for (let i = 0; i < length; i++) {
      let read = (cursor - period + bufferLength) % bufferLength;
      const j = Math.floor(read), frac = read - j;
      const delayed = buffer[j] * (1 - frac) + buffer[(j + 1) % bufferLength] * frac;
      const filtered = .72 * delayed + .28 * previous;
      previous = delayed;
      buffer[cursor] = filtered * feedback;
      cursor = (cursor + 1) % bufferLength;
      samples[i] = filtered * 2.4 * envelope(i / RATE, duration, .008, .22);
    }
    return samples;
  }

  const isPiano = instrument === 'piano';
  const isCelesta = instrument === 'celesta';
  const isFlute = instrument === 'flute';
  const isBass = instrument === 'bass';
  let harmonics;
  if (isPiano) harmonics = [[1, 1], [2, .38], [3, .21], [4, .10], [5, .065], [7, .032]];
  else if (isCelesta) harmonics = [[1, 1], [2, .13], [3, .045], [4.02, .13], [5.43, .045]];
  else if (isFlute) harmonics = [[1, 1], [2, .105], [3, .047], [4, .012]];
  else if (isBass) harmonics = [[1, 1], [2, .25], [3, .085]];
  else harmonics = [[1, .66], [2, .32], [3, .18], [4, .12], [5, .055], [6, .025]];

  const modes = harmonics.map(([ratio, gain], index) => {
    const inharmonicity = isPiano ? Math.sqrt(1 + .00009 * ratio * ratio) : 1;
    const decay = isPiano ? 1.5 / (1 + index * .3)
      : isCelesta ? 1.3 / (1 + index * .25) : isBass ? 2.4 : 30;
    return { osc: oscillator(f * ratio * inharmonicity), gain, loss: Math.exp(-1 / (RATE * decay)), amplitude: 1 };
  });
  const vibrato = oscillator(isFlute ? 4.9 : 4.2);
  const slow = oscillator(.8, seed % 7);
  let noiseLow = 0;
  const attack = isFlute ? .12 : instrument === 'strings' ? .65 : isBass ? .04 : .012;
  const release = isFlute ? .22 : instrument === 'strings' ? .9 : .26;
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    let value = 0;
    for (const mode of modes) {
      value += mode.osc() * mode.gain * mode.amplitude;
      mode.amplitude *= mode.loss;
    }
    const noise = random() * 2 - 1;
    noiseLow = noiseLow * .72 + noise * .28;
    if (isPiano) value += noiseLow * .075 * Math.exp(-t * 55);
    if (isCelesta) value += noiseLow * .035 * Math.exp(-t * 70);
    if (isFlute) value = value * (1 + vibrato() * .027 * Math.min(1, t * 3)) + noiseLow * .025;
    if (instrument === 'strings') value = value * (1 + vibrato() * .032 + slow() * .025) + noiseLow * .007;
    samples[i] = value * envelope(t, duration, attack, release) * (instrument === 'strings' ? .5 : .65);
  }
  return samples;
}

function soundtrack(config) {
  const beat = 60 / config.bpm;
  const duration = 128 * beat;
  const n = Math.round(duration * RATE);
  const left = new Float32Array(n), right = new Float32Array(n);
  const cache = new Map();
  const random = rng(config.seed);
  let eventCount = 0;

  function note(instrument, midi, atBeat, lengthBeats, volume, pan = 0) {
    const seconds = lengthBeats * beat;
    const cacheKey = `${instrument}/${midi}/${seconds.toFixed(3)}`;
    let mono = cache.get(cacheKey);
    if (!mono) {
      mono = synth(instrument, midi, seconds, config.seed + midi * 93 + Math.round(seconds * 100));
      cache.set(cacheKey, mono);
    }
    const start = Math.round(atBeat * beat * RATE);
    const l = Math.cos((pan + 1) * Math.PI / 4) * volume;
    const r = Math.sin((pan + 1) * Math.PI / 4) * volume;
    for (let i = 0; i < mono.length; i++) {
      const j = (start + i + n) % n;
      left[j] += mono[i] * l; right[j] += mono[i] * r;
    }
    eventCount++;
  }

  for (let bar = 0; bar < 32; bar++) {
    const chord = HARMONY[bar % 8];
    const b = bar * 4;
    const section = Math.floor(bar / 8);
    const phrase = section === 2 ? PHRASE_B : PHRASE_A;
    const quiet = config.night;
    const dynamics = config.intensity * (section === 2 ? .88 : section === 3 ? .91 : 1);

    // Warm bowed bass and a slow harmonic bed, with overlapping releases.
    note('bass', chord.bass, b, quiet ? 4.5 : 2.7, .12 * dynamics, -.08);
    if (!quiet) note('bass', chord.bass + 12, b + 2, 1.8, .055 * dynamics, .08);
    for (const [i, pitch] of chord.notes.slice(0, 4).entries()) {
      note('strings', pitch, b + i * .035, 5.0, (quiet ? .048 : .029) * dynamics, (i - 1.5) * .28);
    }

    // Fingerpicked broken chords; no percussion and no relentless note stream.
    const picking = quiet ? [0, 1.5, 3] : [0, .75, 1.5, 2.25, 3, 3.5];
    const order = quiet ? [0, 3, 2] : [0, 2, 3, 1, 4, 2];
    picking.forEach((offset, index) => {
      const pitch = chord.notes[order[index] % chord.notes.length] + (quiet && config.comp === 'celesta' ? 12 : 0);
      note(config.comp, pitch, b + offset + .02, quiet ? 2.3 : 1.7,
        (quiet ? .082 : .13) * dynamics * (index === 0 ? 1 : .72), -.35);
    });

    // At night alternate complete melody gestures and reflective rests.
    const silentBar = quiet && (bar % 8 === 3 || bar % 8 === 7);
    if (!silentBar) {
      const melody = phrase[bar % 8];
      melody.forEach(([offset, pitch, length], i) => {
        const octave = config.name === 'house' || config.name === 'square-night' ? -12 : 0;
        const human = (random() - .5) * .025;
        const strength = i === 0 ? 1 : .86;
        note(config.lead, pitch + octave, b + offset + human,
          length + (quiet ? .28 : .12), .18 * dynamics * strength, .12);
      });
    }

    // A restrained answering voice appears at phrase ends, not all the time.
    if ((bar % 8 === 1 || bar % 8 === 5) && section !== 0) {
      const pitch = chord.notes[3] + 12;
      note(quiet ? 'flute' : 'celesta', pitch, b + 2.5, 1.8, .065 * dynamics, .45);
    }
    if (config.name === 'menu' && bar % 8 === 6) {
      note('celesta', 81, b + 2, 2, .043, .52);
    }
  }

  // Stereo circular room convolution: late tails wrap naturally into the loop.
  const dryL = left.slice(), dryR = right.slice();
  const echoes = [[.113, .13], [.179, .10], [.293, .08], [.431, .055], [.619, .035], [.887, .02]];
  for (const [seconds, gain] of echoes) {
    const delay = Math.round(seconds * RATE);
    const oppositeDelay = delay + Math.round(.009 * RATE);
    for (let i = 0; i < n; i++) {
      left[i] += dryR[(i - delay + n) % n] * gain;
      right[i] += dryL[(i - oppositeDelay + n) % n] * gain;
    }
  }

  // Soft low-pass air and gentle saturation; coefficients are periodic-friendly.
  let l = left[n - 1], r = right[n - 1];
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < n; i++) {
      l += .57 * (left[i] - l); r += .57 * (right[i] - r);
      if (round === 1) { left[i] = Math.tanh(l * 1.08); right[i] = Math.tanh(r * 1.08); }
    }
  }
  return { left, right, duration, eventCount };
}

function writeWav(name, sound, targetRMS = .083, maxPeak = .78) {
  const { left, right } = sound;
  const n = left.length;
  let meanL = 0, meanR = 0;
  for (let i = 0; i < n; i++) { meanL += left[i]; meanR += right[i]; }
  meanL /= n; meanR /= n;
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    left[i] -= meanL; right[i] -= meanR;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    sum += left[i] ** 2 + right[i] ** 2;
  }
  const rms = Math.sqrt(sum / (2 * n));
  const gain = Math.min(targetRMS / rms, maxPeak / peak);
  const bytes = Buffer.alloc(44 + n * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
  bytes.writeUInt32LE(n * 4, 40);
  let clipped = 0, pcmPeak = 0, pcmSquares = 0, difference = 0;
  for (let i = 0; i < n; i++) {
    for (let channel = 0; channel < 2; channel++) {
      const value = (channel === 0 ? left[i] : right[i]) * gain;
      if (Math.abs(value) >= 1) clipped++;
      const pcm = Math.max(-32767, Math.min(32767, Math.round(value * 32767)));
      bytes.writeInt16LE(pcm, 44 + i * 4 + channel * 2);
      pcmPeak = Math.max(pcmPeak, Math.abs(pcm) / 32767);
      pcmSquares += (pcm / 32767) ** 2;
      if (i > 0) difference = Math.max(difference, Math.abs(value - (channel === 0 ? left[i - 1] : right[i - 1]) * gain));
    }
  }
  fs.writeFileSync(path.join(OUT, `${name}.wav`), bytes);
  // Read the actual saved asset, then validate format, length and finite metrics.
  const check = fs.readFileSync(path.join(OUT, `${name}.wav`));
  if (check.toString('ascii', 0, 4) !== 'RIFF' || check.toString('ascii', 8, 12) !== 'WAVE'
    || check.readUInt16LE(20) !== 1 || check.readUInt16LE(22) !== 2
    || check.readUInt32LE(24) !== RATE || check.readUInt16LE(34) !== 16
    || check.readUInt32LE(40) !== check.length - 44 || clipped !== 0) {
    throw new Error(`Invalid PCM asset: ${name}`);
  }
  const loopStep = Math.max(Math.abs(left[0] - left[n - 1]), Math.abs(right[0] - right[n - 1])) * gain;
  const result = { name, seconds: +(n / RATE).toFixed(3), bytes: check.length,
    rms: +Math.sqrt(pcmSquares / (n * 2)).toFixed(5), peak: +pcmPeak.toFixed(5),
    clipped, loopStep: +loopStep.toFixed(6), maxSampleStep: +difference.toFixed(6), events: sound.eventCount };
  if (!Number.isFinite(result.rms) || result.rms < .025 || result.peak > .9) throw new Error(`Bad levels: ${name}`);
  console.log(JSON.stringify(result));
  return result;
}

const results = [];
for (const theme of THEMES) results.push(writeWav(theme.name, soundtrack(theme), theme.night ? .074 : .083));
// The bark is trimmed from the user's recording. Never overwrite it.
console.log('bark.wav: пользовательская запись сохраняется без изменений');

const table = results.map(result => {
  const theme = THEMES.find(item => item.name === result.name);
  return `| ${result.name}.wav | ${theme?.subtitle ?? 'Мягкое двойное «гав»'} | ${result.seconds} | ${theme?.bpm ?? '—'} | ${result.rms} | ${result.peak} | ${result.clipped} |`;
}).join('\n');

fs.writeFileSync(path.join(ROOT, 'docs', 'AUDIO-MUSIC-METRICS.md'), '# Проверка музыкальных дорожек\n\nТолько восемь музыкальных тем; пользовательская запись bark.wav не меняется.\n\n| Файл | Тема | Секунд | BPM | RMS | Peak | Клиппинг |\n|---|---|---:|---:|---:|---:|---:|\n'+table+'\n', 'utf8');
