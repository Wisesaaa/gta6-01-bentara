// Data stasiun radio + track BENTARA: DRY SEASON.
// Dipakai langsung oleh synth.js: tiap track membawa bpm, pola sequencer
// 16 langkah (kick / snare / bass / hat) dan akor pad per bar.
// Pola: 1 = bunyi, 0 = diam. Bass: angka = offset semitone dari root,
// 0 dengan tanda khusus — di sini null = diam, angka = nada (0 = root).
// Semua label Bahasa Indonesia, tanpa penanda versi.

export const STATIONS = [
  {
    id: 'kemarau',
    name: 'RADIO KEMARAU 92.4',
    freq: '92.4 FM',
    tagline: 'Musik jalanan kota Bentara',
    tracks: [
      {
        id: 'kemarau-aspal-panas',
        title: 'Aspal Panas',
        artist: 'Geng Kemarau',
        bpm: 112,
        root: 45, // A2
        // Akor per bar (4 bar, lalu berulang): Am – F – C – G
        chords: [
          [57, 60, 64],
          [53, 57, 60],
          [48, 52, 55],
          [55, 59, 62],
        ],
        kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat:   [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
        bass:  [0, null, null, 0, null, null, 0, null, null, null, 0, null, null, 0, null, null],
      },
      {
        id: 'kemarau-macet-sore',
        title: 'Macet Sore',
        artist: 'Lampu Merah',
        bpm: 98,
        root: 43, // G2
        // Akor per bar: Gm – Eb – Bb – F
        chords: [
          [55, 58, 62],
          [51, 55, 58],
          [53, 57, 62],
          [53, 57, 60],
        ],
        kick:  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
        hat:   [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
        bass:  [0, null, 3, null, null, 0, null, null, 10, null, null, 0, null, null, 7, null],
      },
    ],
  },
  {
    id: 'dangdut',
    name: 'DANGDUT PANTAI 88.1',
    freq: '88.1 FM',
    tagline: 'Koplo pantai, goyang terus',
    tracks: [
      {
        id: 'dangdut-ombak-koplo',
        title: 'Ombak Koplo',
        artist: 'Siti Pantura',
        bpm: 128,
        root: 41, // F2
        // Akor per bar: Fm – Db – Ab – C
        chords: [
          [53, 56, 60],
          [49, 53, 56],
          [56, 60, 63],
          [48, 52, 55],
        ],
        kick:  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        hat:   [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        bass:  [0, null, 0, null, 3, null, 0, null, 5, null, 0, null, 7, null, 5, null],
      },
      {
        id: 'dangdut-goyang-pasir',
        title: 'Goyang Pasir',
        artist: 'Dewi Ombak',
        bpm: 122,
        root: 45, // A2
        // Akor per bar: Am – Dm – E – Am
        chords: [
          [57, 60, 64],
          [57, 62, 65],
          [52, 56, 59],
          [57, 60, 64],
        ],
        kick:  [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hat:   [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
        bass:  [0, 0, null, null, 0, null, 5, null, 0, null, null, 7, null, null, 4, null],
      },
    ],
  },
  {
    id: 'kopi',
    name: 'KOPI SENJA 101.7',
    freq: '101.7 FM',
    tagline: 'Santai di warung kopi',
    tracks: [
      {
        id: 'kopi-senja-jingga',
        title: 'Senja Jingga',
        artist: 'Warung Senja',
        bpm: 76,
        root: 48, // C3
        // Akor per bar: Cmaj7 – Am7 – Fmaj7 – G
        chords: [
          [48, 52, 55, 59],
          [45, 48, 52, 55],
          [41, 45, 48, 52],
          [43, 47, 50, 55],
        ],
        kick:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        hat:   [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        bass:  [0, null, null, null, null, null, null, 7, null, null, null, null, 5, null, null, null],
      },
      {
        id: 'kopi-hujan-rintik',
        title: 'Hujan Rintik',
        artist: 'Payung Kertas',
        bpm: 84,
        root: 50, // D3
        // Akor per bar: Dm7 – Bbmaj7 – Fmaj7 – C
        chords: [
          [50, 53, 57, 60],
          [46, 50, 53, 57],
          [41, 45, 48, 52],
          [48, 52, 55, 60],
        ],
        kick:  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        hat:   [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        bass:  [0, null, null, null, 3, null, null, null, 0, null, null, null, 10, null, 7, null],
      },
    ],
  },
];

export function getStation(id) {
  return STATIONS.find((s) => s.id === id) || STATIONS[0];
}

export function getTrack(stationId, trackId) {
  const station = getStation(stationId);
  return station.tracks.find((t) => t.id === trackId) || station.tracks[0];
}
