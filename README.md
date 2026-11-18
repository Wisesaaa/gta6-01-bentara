# BENTARA: DRY SEASON

An open-world crime game for the gta6-01 bounty. One dry-season city, bleached
concrete at 4pm — no palms, no sunset bay. You are a newcomer in Bentara, a
city that cracks under a low sun. Pak Wira, the marina boss, has work for you:
eight missions in three acts, from a first meeting at the marina to the final
heat at Plaza Menara.

## How to play

- **WASD** walk / drive, **Shift** run, **Space** handbrake
- **F** enter / steal a car (walk up to one and press F)
- **E** interact — talk to Pak Wira, Sari or Dedi; buy a shotgun at the Ruko;
  use the Safehouse Timur to repair, heal and save
- **Click** shoot, **1 / 2** switch pistol / shotgun, **R** radio, **P** pause
- Wanted level: 5 stars, one star decays per 11 seconds out of sight.
  Cruisers ram you, foot cops shoot from 2 stars, the GARUDA-1 helicopter
  and roadblocks arrive from 4 and 3 stars.
- Everything you smash is itemised on the damage bill — and the bill is
  really deducted from your cash when a mission ends.

## The city

5x5 blocks, 56 m blocks, 18 m roads, 388 m across. Fourteen traffic cars
that brake for you, twenty pedestrians who flee gunfire, breakable crates,
stalls, hydrants and signs, a marina with a pier, and a tower over Plaza
Menara. One directional 4pm sun, instanced buildings (one draw call),
about 7,000 triangles on screen at tier low.

## Systems

- **Missions** — 8 jobs in 3 acts with a gold beacon, stage progress and a
  NEXT line. Steps: goto, talk, collect, deliver, survive (attackers spawn),
  destroy (a marked car), steal (enter a marked car).
- **Police** — named units (BAYU, ANGIN, SAMBAR, KIJANG, ELANG, MERAK,
  CENDRAWASIH, GARUDA-1) with distance and status in the response list.
- **Progression** — REP levels (Anak Baru to Dewa Marina), cash, a shop, a
  safehouse/garage, two weapons, and Radio Kemarau 92.4.
- **Save** — localStorage autosave every 20 seconds and at the safehouse.
- **Audio** — fully procedural: engine hum, two-tone siren, gunshots, radio
  melody. No audio files.

## Screenshots (deterministic)

Each shot seeds a real state, steps a fixed number of simulated seconds at
1/60, renders one frame and freezes — the same seed always gives the same
frame. `?shot=heat&at=6`, `?shot=drive&at=2.5`, `?shot=foot&at=2`,
`?shot=story&at=1.5`, all at 1280x720.

1. **1-heat.jpg** (cover) — the chase: 4.2 stars, 3 cruisers, helicopter with
   spotlight, 6 props broken, bill reading $240.
2. **2-drive.jpg** — the arterial at 26 m/s, 14 traffic cars, 1 star.
3. **3-foot.jpg** — on foot at Plaza Menara, pistol out, peds fleeing.
4. **4-story.jpg** — the marina, Pak Wira, his line, the job beacon.

## Structure

```
game/index.html        import map (local three.js), HUD, screens
game/vendor/           three.module.min.js r160 (vendored, unchanged)
game/src/config.js     tuning, palette, weapons, heat rules
game/src/rng.js        mulberry32 + helpers (seeded, deterministic)
game/src/mathx.js      clamp / lerp / damp / dist2
game/src/city.js       grid, blocks, LOCATIONS + loc() that throws
game/src/world.js      renderer, sun, roads, instanced buildings, signs
game/src/props.js      breakable props, debris, bill hookup
game/src/bill.js       itemised damage bill, settle() really pays
game/src/player.js     on-foot + car control, enter/exit, camera
game/src/actors/       human.js, car.js, traffic.js, peds.js, police.js
game/src/combat.js     ray vs building AABBs, humans, cars
game/src/missions.js   8 missions, 3 acts, beacon, attackers
game/src/hud.js        mission panel, police list, minimap, REP, radio
game/src/audio.js      procedural engine / siren / gunshot / radio
game/src/save.js       localStorage save/load, 20 s autosave
game/src/game.js       the one fixed step wiring every system
game/src/shots.js      deterministic screenshot scenes
game/src/main.js       boot, title / pause screens, live loop
```

## Run it

```
node serve.ts            # http://localhost:8080
```

## Verification (this session, headless Chromium, software GL)

- All four `?shot=` scenes render at 1280x720 with zero console errors and
  zero requests leaving localhost (three.js loads from game/vendor/).
- All 8 missions advance end to end in a headless test (90 simulated seconds
  per mission); mission 8 completes.
- Live play verified: title → Space/click start → walk → F enters the
  KANCIL GT → drive (79 km/h on the marina road) → F exits → click shoots →
  P pauses and resumes.
- Triangle audit: ~6,600 triangles on screen, 205 draw calls — inside budget.
