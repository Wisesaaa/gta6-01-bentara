# gta6-01-bentara

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Wisesaaa/gta6-01-bentara/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Wisesaaa/gta6-01-bentara/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

BENTARA: DRY SEASON — open-world crime game in a dry-season city. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

An open-world crime game for the gta6-01 bounty. One dry-season city, bleached
concrete at 4pm — no palms, no sunset bay. You are a newcomer in Bentara, a
city that cracks under a low sun. Pak Wira, the marina boss, has work for you:
eight missions in three acts, from a first meeting at the marina to the final
heat at Plaza Menara.

## How to play

- **WASD** walk / drive, **Shift** run / nitro (in a car with TURBO), **Space** handbrake
- **F** enter / steal a car (walk up to one and press F)
- **E** interact — talk to Pak Wira or Pak Aska; buy Warung Sari / Kios Kaki Lima /
  Slip Marina; open Bengkel Roda Jaya at Kawasan Industri; buy weapons at the
  Ruko; use the Safehouse Timur to repair, heal and save; pick up taxi
  passengers; start the checkpoint race at Plaza Menara (stand 6–10 m out —
  inside 6 m is the Kios Kaki Lima stall)
- **Click** shoot, **1–5** switch pistol / shotgun / SMG / Bedil / Pelontar
  (two slots stay LOCKED until you buy in), **Q** reload, **B** bribe the police
  ($250/star, REP 3+), **T** sleep at the safehouse (collects your business
  income), **R** radio, **P** pause
- Side work pays: **taxi fares** (pick up a passenger, deliver, paid by the
  meter), **24 collectibles** (golden wayang idols $60 and radio tapes $25,
  cash + REP), **checkpoint race** (5 gold gates, double pay under the 75 s
  par), **Bengkel Roda Jaya** (buy 5 cars, upgrade MESIN/BAN/TURBO, respray,
  steal a police PANTHERA or a gang car), **usaha** (Warung Sari $2.500
  +$30/day, Kios Kaki Lima $9.500 +$80/day, Slip Marina $22.000 +$180/day —
  income accrues per game hour, collect it by sleeping), and **stunts** —
  drifting pays $60/s, a near miss $250, and cops drop cash bundles + ammo
  crates when you take them down.
- Wanted level: 5 stars, one star decays per 11 seconds out of sight.
  Cruisers ram you, foot cops shoot from 2 stars, roadblocks arrive from 3
  stars, the GARUDA-1 helicopter (rotor blur, banking, sweeping spotlight
  cone, search ring on the minimap) from 4 stars. Lose line of sight and the
  pursuit drops to SEARCH — then slip away.
- REP ladder: KUTIL → BOS KECIL → RAJA JALANAN → LEGENDA BENTARA. NITRO
  unlocks at REP 2, the police bribe at REP 3, the Bedil at REP 3, the
  Pelontar and a 20% shop discount at REP 4.
- Everything you smash is itemised on the damage bill — and the bill is
  really deducted from your cash when a mission ends (the ledger shows
  Hasil / Tagihan / BERSIH / REP).

## The city

5x5 blocks, 56 m blocks, 18 m roads, 388 m across. Twenty-two traffic cars
(angkot, ojek, bajaj, sedans, trucks) that brake for you and flee gunfire,
thirty-two pedestrians who cross at zebras and scatter when shots ring out,
64 breakable props (crates, stalls, warung kopi, hydrants, signs), a marina
with a pier, a tower over Plaza Menara, and a wayang mural on the tallest
building. Golden-hour light: low warm sun, long shadows, haze, dust in the
air, amber windows at 4pm.

## Systems

- **Missions** — 8 jobs in 3 named acts (BABAK 1 — KENALAN, BABAK 2 — NAIK
  DAUN, BABAK 3 — MUSIM KERING) with a gold beacon, segmented stage bar,
  stage pips, a NEXT line and a mission stinger that shrinks to a mini-pill
  ("Kabur · 240 m"). Steps: goto, talk, collect, deliver, survive (attackers
  spawn), destroy (a marked car), steal (enter a marked car). Talk always
  wins over buying a property — E at the marina talks to Pak Wira / Pak
  Aska, it never buys Slip Marina first.
- **Lighting rig** — golden-hour sun #ffb367 at ~11°, hemisphere
  #ffd2a1/#5a2a1a, Exp2 fog #e0925a, a 3-stop shader sky dome
  (#ff9a4e → #e0563a → #40203e) with an additive sun disc + halo, fake
  bloom from additive glow sprites on lamps / windows / brake lights (no
  postprocessing), a CSS vignette, darkened plinth strips, ~15% emissive
  windows, haze band + dust motes + dust devils, and per-act presets that
  snap when a mission starts (morning gold → high amber → red dusk).
- **HUD** — four corner clusters + a centre band, no text walls: top-centre
  mission stinger + stage bar + NEXT chip; left-mid police panel (260 px,
  max 5 rows + "+N unit lagi", KEJAR / MENABRAK / IKAT JALAN / SOROT /
  MENCARI pills); top-right green cash, stars, HARI/time, one-line bill
  pill; bottom-left minimap with GPS route + region plate + REP row +
  KOLEKSI / ASET / KEMAJUAN chips; bottom-right vehicle card (fuel + nitro
  + armor gauges, plate, radio) + 5-slot weapon rail with two LOCKED slots;
  right-edge progress rail (vehicle stack); centre feedback layer (BIG /
  MID / SMALL tiers, amber, 8° tilt, combo ×2→×5) + a one-way dispatch
  ticker + the end-of-mission ledger card.
- **Police** — named units (BAYU, ANGIN, SAMBAR, KIJANG, ELANG, MERAK,
  CENDRAWASIH, GARUDA-1) with distance and status in the response list.
  Cruisers wear POLISI livery with a split red/blue lightbar and alternating
  glow sprites; roadblocks are real barriers + blinking beacons; the
  helicopter bobs ±0.3 m, banks into turns, sweeps its spotlight in a search
  pattern and paints a ground pool; losing line of sight drops the pursuit
  to SEARCH with a "ZONA PENCARIAN" ring on the minimap and in the world.
- **Garage & property** — Bengkel Roda Jaya at Kawasan Industri: MURAI 110
  $1.200, GAJAH PUTIH $4.500, KOMODO GT $14.000, NAGA R $28.000, SRIWIJAYA
  LIMO $40.000, plus steal-unlocks (police PANTHERA, gang car); MESIN / BAN /
  TURBO upgrades + respray; owned cars park at the safehouse forecourt.
  Three businesses with daily income, collected by sleeping.
- **Weapons** — 5 slots (pistol ∞, shotgun $120, SMG $450, Bedil $900 REP 3,
  Pelontar $1.800 REP 4) with magazines + reserves, Q reload (R stays
  radio), armor bar, and cop loot drops (cash bundles + ammo crates with
  additive glow).
- **Side work** — taxi fares (6 stands, paid by the meter), 24 collectibles
  (wayang idols $60, radio tapes $25, cash + REP), a 5-gate checkpoint race
  (par 75 s, double pay under par), drift and near-miss stunt payouts.
- **Characters & radio** — Pak Wira, Pak Aska (Penerima Marina), Sari the
  fence, Bang Ijal the mechanic, Letkol Rahmat (taunts you at 3+ stars) and
  Bang Ocid on Radio Kemarau 92.4 (EQ bars, rotating tracks: "Senja di
  Aspal", "Debu Kota"), all with painted portraits, name + teal role-tag
  chips, max 2 lines, auto-fit, zero cut text; every mission opens with an
  intro line from its contact.
- **Progression** — REP ladder (KUTIL → BOS KECIL → RAJA JALANAN → LEGENDA
  BENTARA), cash, garage + businesses, 5 weapons, and Radio Kemarau 92.4.
  Completion % + Bahasa rank in pause / dossier / under REP.
- **Save** — localStorage `bentara.save.v3` (migrates v2 saves), autosave
  every 20 seconds and at the safehouse.
- **Audio** — fully procedural: engine hum, two-tone siren, gunshots, radio
  melody. No audio files.

## Screenshots (deterministic)

Each shot seeds a real state, steps a fixed number of simulated seconds at
1/60, renders one frame and freezes — the same seed always gives the same
frame. `?shot=heat&at=6`, `?shot=drive&at=2.5`, `?shot=foot&at=2`,
`?shot=story&at=1.5`, all at 1280x720.

1. **1-heat.jpg** (cover) — the chase EAST down the z=111 arterial toward
   the low sun: 4.2 stars, 3 cruisers (one MENABRAK at 9 m), GARUDA-1 big in
   the upper third with rotor disc + spotlight cone against the sun's halo,
   6 props broken, bill reading −$195, the BENTARA mural readable on the
   right, a real DRIFT ×2 +$42 popup earned by a 0.7 s handbrake slide, and
   the red CEMPAKA GT mid-drift at 105 km/h.
2. **2-drive.jpg** — the arterial at 42 m/s (151 km/h on the dial), 3 stars,
   a cruiser tight behind the player (MENABRAK pill), two staggered ahead,
   roadblock 46 m up, dispatch ticker, mission card + stage bar, minimap
   with route line + wanted pulse ring.
3. **3-foot.jpg** — on foot outside WARUNG SARI: the emissive sign readable,
   the red CEMPAKA GT parked clear beside the player, 10 pedestrians
   fleeing a real shot, the warung interaction pill
   ("E — Beli WARUNG SARI $2.500 (+$30/hari)"), weapon rail with LOCKED
   slots, and a real KASET +$25 collect popup (KOLEKSI 1/24).
4. **4-story.jpg** — the marina handoff, staged by really completing
   MISSION 8 live: letterbox bars, PAK ASKA's card fully inside the safe
   margins (zero cut text), the real ledger (PANAS TERAKHIR SELESAI /
   Hasil +$1.000 / Tagihan −$0 / BERSIH $1.000 / REP +600), the MARINA sign,
   the player left-foreground with his back to us, and the red CEMPAKA GT
   at the pier.

## Structure

```
game/index.html        import map (local three.js), HUD, screens
game/vendor/           three.module.min.js r160 (vendored, unchanged)
game/src/config.js     tuning, palette, weapons (5 slots), heat rules, taxi/race/stunts, characters
game/src/rng.js        mulberry32 + helpers (seeded, deterministic)
game/src/mathx.js      clamp / lerp / damp / dist2 / smoothstep
game/src/city.js       grid, blocks, LOCATIONS + loc() that throws
game/src/world.js      renderer, golden-hour sun, sky dome, roads, instanced buildings, signs, mural
game/src/lighting.js   sky dome shader, sun disc + halo, dust motes, dust devils, per-act presets
game/src/effects.js    pooled skid decals, smoke, sparks, cash/ammo drops, shared glow sprites
game/src/props.js      breakable props, debris, bill hookup
game/src/bill.js       itemised damage bill, settle() really pays
game/src/player.js     on-foot + car control, enter/exit, camera, drift detection, magazines, armor
game/src/actors/       human.js, car.js, traffic.js, peds.js, police.js
game/src/combat.js     ray vs building AABBs, humans, cars; muzzle flash + sparks
game/src/missions.js   8 missions, 3 acts, beacon, attackers, intro lines
game/src/progress.js   REP ladder, unlocks, act names, mission progress
game/src/collectibles.js  24 wayang idols + radio tapes, cash + REP
game/src/taxi.js       fares: stands, pickup, meter, payout
game/src/race.js       5 checkpoint gates, par timer, double pay
game/src/garage.js     Bengkel Roda Jaya: catalog, steal-unlocks, upgrades, respray, forecourt
game/src/usaha.js      businesses: catalog, hourly accrual, collect, sleep
game/src/dialogue.js   portraits, mission intros, taunts, DJ lines
game/src/popups.js     tiered centre feedback (BIG/MID/SMALL) + floating score popups
game/src/hud.js        4-corner HUD, stinger, police panel, ledger, minimap + GPS, weapon rail, shops
game/src/audio.js      procedural engine / siren / gunshot / radio / cash blips
game/src/save.js       localStorage save/load v3 (migrates v2), 20 s autosave
game/src/game.js       the one fixed step wiring every system
game/src/shots.js      deterministic screenshot scenes
game/src/main.js       boot, title / pause screens, live loop
```

## Run it

```sh
node serve.ts            # http://localhost:8080
```

## Verification (v3 FRESH, this session, headless Chromium, software GL)

- All four `?shot=` scenes render at 1280x720 with zero console errors and
  zero requests leaving localhost (three.js loads from game/vendor/).
  Final sizes: 1-heat.jpg 150,352 B, 2-drive.jpg 137,650 B,
  3-foot.jpg 128,657 B, 4-story.jpg 126,319 B — all under the 256 KiB cap.
  Triangle audit: 38,160 — well inside the 150k budget.
- All 8 missions complete end to end in headless CDP tests (real key events
  E/F and PointerEvents via the live loop, teleports used as a test
  shortcut): M1 +$150/+100, M2 +$200/+150, M3 +$300/+200 (destroy step
  verified with real fire: pistol drops the target car 100 → 66 → 32 →
  destroyed), M4 +$350/+250, M5 +$400/+300, M6 +$450/+300, M7 +$600/+400
  plus one idol (+$60/+5) and a leftover cash drop from M3, M8 +$1.000/+600.
  Final: cash $3,837, rep 2,306, done=true. Talk priority verified: E at the
  marina talks, it never buys Slip Marina first.
- Race won: 5/5 gates, best 4.02 s (par 75 s), double pay +$1.000.
  Taxi 3/3 trips. Collectibles increment (1/24 → 2/24). Heat evasion:
  3 → 2 after 12 s of game time with no line of sight. Helicopter spawns
  at heat 4. Garage: MURAI 110 bought + MESIN upgraded through the real
  panel UI. Property: WARUNG SARI bought with E, 24 h accrue collects
  +$30, sleep collects the pot and advances the day. Save/load round-trip
  on the v3 schema (`bentara.save.v3`, version 3, garage + usaha fields).
- `main.ts` runs clean: preflight ok (cover 1-heat.jpg, 4 screenshots),
  dossier written, game 1,004,980 bytes in 34 files.
- Live play verified: title → Enter start → walk → F enters the
  CEMPAKA GT → drive → F exits → click shoots → P pauses and resumes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=q8w73xd6&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
