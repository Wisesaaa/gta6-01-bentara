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

- **WASD** walk / drive, **Shift** run, **Space** handbrake
- **F** enter / steal a car (walk up to one and press F)
- **E** interact — talk to Pak Wira, Sari or Dedi; buy a shotgun at the Ruko;
  use the Safehouse Timur to repair, heal and save; pick up taxi passengers;
  start the checkpoint race at Plaza Menara
- **Click** shoot, **1 / 2 / 3** switch pistol / shotgun / SMG (SMG locked,
  $450), **R** radio, **P** pause
- Side work pays: **taxi fares** (pick up a passenger, deliver, paid by the
  meter), **24 collectibles** (golden wayang idols and radio tapes, cash +
  REP), **checkpoint race** (5 gold gates, beat par for double pay), and
  **stunts** — drifting pays $60/s, a near miss $250.
- Wanted level: 5 stars, one star decays per 11 seconds out of sight.
  Cruisers ram you, foot cops shoot from 2 stars, the GARUDA-1 helicopter
  and roadblocks arrive from 4 and 3 stars.
- Everything you smash is itemised on the damage bill — and the bill is
  really deducted from your cash when a mission ends.

## The city

5x5 blocks, 56 m blocks, 18 m roads, 388 m across. Twenty-two traffic cars
(angkot, ojek, bajaj, sedans, trucks) that brake for you and flee gunfire,
thirty-two pedestrians who cross at zebras and scatter when shots ring out,
64 breakable props (crates, stalls, warung kopi, hydrants, signs), a marina
with a pier, a tower over Plaza Menara, and a wayang mural on the tallest
building. Golden-hour light: low warm sun, long shadows, haze, dust in the
air, amber windows at 4pm.

## Systems

- **Missions** — 8 jobs in 3 acts with a gold beacon, stage progress and a
  NEXT line. Steps: goto, talk, collect, deliver, survive (attackers spawn),
  destroy (a marked car), steal (enter a marked car).
- **Police** — named units (BAYU, ANGIN, SAMBAR, KIJANG, ELANG, MERAK,
  CENDRAWASIH, GARUDA-1) with distance and status in the response list.
  Cruisers wear POLISI livery with a split red/blue lightbar; roadblocks
  are real barriers + spike strips; the helicopter is 60% bigger with a
  narrow spotlight cone and a pool of light on the ground.
- **Side work** — taxi fares (6 stands, paid by the meter), 24 collectibles
  (wayang idols $60, radio tapes $25, cash + REP), a 5-gate checkpoint race
  (par 75 s, double pay under par), drift and near-miss stunt payouts.
- **Characters** — Pak Wira, Sari the fence, Bang Ijal the mechanic, Letkol
  Rahmat (taunts you at 3+ stars) and Bang Ocid on Radio Kemarau 92.4, all
  with painted portraits in the dialogue box; every mission opens with an
  intro line from its contact.
- **HUD** — circular dark-radar minimap (road graph, objective marker, police
  blips, search ring, N compass), circular speed gauge (needle, gear,
  condition arc), 3-slot weapon strip, floating score popups, "DI PANDANG"
  flash when a unit has eyes on you.
- **Progression** — REP levels (Anak Baru to Dewa Marina), cash, a shop, a
  safehouse/garage, two weapons (SMG locked), and Radio Kemarau 92.4.
- **Save** — localStorage autosave every 20 seconds and at the safehouse.
- **Audio** — fully procedural: engine hum, two-tone siren, gunshots, radio
  melody. No audio files.

## Screenshots (deterministic)

Each shot seeds a real state, steps a fixed number of simulated seconds at
1/60, renders one frame and freezes — the same seed always gives the same
frame. `?shot=heat&at=6`, `?shot=drive&at=2.5`, `?shot=foot&at=2`,
`?shot=story&at=1.5`, all at 1280x720.

1. **1-heat.jpg** (cover) — the chase: 4.2 stars, 3 cruisers, helicopter with
   a narrow spotlight, 6 props broken, bill reading $235, Pak Wira's portrait
   + dialogue, a taxi passenger waiting, a gold collectible, and a real DRIFT
   popup earned by a handbrake slide.
2. **2-drive.jpg** — the arterial at 26 m/s, 22 traffic cars, 1 star, taxi
   passenger + collectible on the sidewalks.
3. **3-foot.jpg** — on foot at Plaza Menara, pistol out, peds fleeing, an
   idol really collected (KOLEKSI 1/24 + popup).
4. **4-story.jpg** — the marina, Pak Wira + portrait, his line, the job
   beacon, a taxi passenger by the pier.

## Structure

```
game/index.html        import map (local three.js), HUD, screens
game/vendor/           three.module.min.js r160 (vendored, unchanged)
game/src/config.js     tuning, palette, weapons, heat rules, taxi/race/stunts
game/src/rng.js        mulberry32 + helpers (seeded, deterministic)
game/src/mathx.js      clamp / lerp / damp / dist2 / smoothstep
game/src/city.js       grid, blocks, LOCATIONS + loc() that throws
game/src/world.js      renderer, golden-hour sun, sky dome, roads, instanced buildings, signs, mural
game/src/lighting.js   sky dome, sun disc + halo, dust motes, dust devils
game/src/props.js      breakable props, debris, bill hookup
game/src/bill.js       itemised damage bill, settle() really pays
game/src/player.js     on-foot + car control, enter/exit, camera, drift detection
game/src/actors/       human.js, car.js, traffic.js, peds.js, police.js
game/src/combat.js     ray vs building AABBs, humans, cars; muzzle flash + sparks
game/src/missions.js   8 missions, 3 acts, beacon, attackers, intro lines
game/src/collectibles.js  24 wayang idols + radio tapes, cash + REP
game/src/taxi.js       fares: stands, pickup, meter, payout
game/src/race.js       5 checkpoint gates, par timer, double pay
game/src/dialogue.js   portraits, mission intros, taunts, DJ lines
game/src/popups.js     floating score popups (drift / near miss / collect / fare)
game/src/hud.js        mission panel, police list, circular radar, gauge, weapon strip
game/src/audio.js      procedural engine / siren / gunshot / radio / cash blips
game/src/save.js       localStorage save/load, 20 s autosave
game/src/game.js       the one fixed step wiring every system
game/src/shots.js      deterministic screenshot scenes
game/src/main.js       boot, title / pause screens, live loop
```

## Run it

```sh
node serve.ts            # http://localhost:8080
```

## Verification (v2 ALL-IN, this session, headless Chromium, software GL)

- All four `?shot=` scenes render at 1280x720 with zero console errors and
  zero requests leaving localhost (three.js loads from game/vendor/).
  Final sizes: 1-heat.jpg 147,340 B, 2-drive.jpg 134,119 B,
  3-foot.jpg 127,076 B, 4-story.jpg 123,611 B — all under the 256 KiB cap.
  Triangle audit per shot: 39,376 / 39,470 / 34,954 / 31,580 — well inside
  the 150k budget.
- All 8 missions complete end to end in headless CDP tests (real key events
  E/F via CDP, teleports used as a test shortcut): missions 1–7 in the first
  run (cash $2,795, rep 1,710 on reaching mission 8), mission 8 in a second
  run (survive 30 s + deliver, final cash $3,830, rep 2,315). The second run
  resumed mission 8 from the first run's autosave — save/load works
  (the v1.6 save bug, saves loading as null, is fixed).
- Destroy step verified with real fire: pistol held on the mission-3 target
  car drops it 100 → 66 → 32 → destroyed in ~3 s of sim, step advances
  with no test poke. (An earlier 10 s wall-clock attempt needed a poke only
  because the headless tab runs the sim at 0.4x wall speed and police kept
  knocking the player down — the mechanic itself is sound.)
- Drift pays for real: the handbrake slide (damp 1.0, not a hard stop) holds
  14–22 m/s, and the cover shot shows DRIFT +$45 for a 0.8 s slide.
- `main.ts` runs clean: preflight ok (cover 1-heat.jpg, 4 screenshots),
  dossier written, game 940K.
- Live play verified: title → Space/click start → walk → F enters the
  CEMPAKA GT → drive (79 km/h on the marina road) → F exits → click shoots →
  P pauses and resumes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=q8w73xd6&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
