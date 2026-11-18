# BENTARA: DRY SEASON — build notes

Game: open-world crime game, original sun-soaked dry-season city. Character: Pak Wira.
Deadline: Tue Nov 24, 2026 15:00 UTC (22:00 WIB). Entry: gta6-01.

## Gap study (from the live top-10 pitch lines, 18 Nov 2026)

1. **Missions are thin everywhere.** Most entries show 2–4 loose jobs or none at
   all. Gap: 8 missions in 3 acts with a named story (Pak Wira) and a visible
   objective chain. → Step 7 (missions.js, 8 missions / 3 acts).
2. **No police helicopter in the field.** Wanted levels top out at cruisers on
   foot. Gap: helicopter with spotlight from 4 stars, plus foot cops from 2
   stars and an 11 s line-of-sight cooldown. → Step 6 (actors/police.js).
3. **Radio and saves are baseline, not a differentiator.** Entries that have
   them bury them. Gap: procedural radio jingles + engine/siren/gunshot audio
   and a localStorage autosave every 20 s, both visible on the HUD.
   → Step 7 (audio.js, save.js).
4. **~30 of ~50 entries are "sunset coast".** Same orange bay, same palms.
   Gap: bleached concrete at 4 pm, no palms in frame, low sun ahead on the
   arterial — a dry-season city that reads differently at thumbnail size.
   → Step 3 (world.js lighting / palette).
5. **Damage has no consequence.** You can smash the city for free. Gap:
   breakable props with an itemised bill that is actually deducted from cash
   at mission end. → Step 8 (props.js, bill.js).

## Numbers held
- City 5x5 blocks, 56 m blocks, 18 m roads, 388 m across.
- Sun: one directional light at 70, 120, 40 relative to the player, PCFSoft shadows.
- Person 1.8 m, car 4.3 m, door 2.2 m. Heat: 5 stars, decay 1 star / 11 s,
  cruisers = stars capped at 3, foot cops from 2 stars, helicopter from 4.
- Budget: < 150k triangles on screen, < 12 MB assets, one draw call per
  instanced building batch. Bill panel throttled to 10 Hz.

## Shots (1280x720, deterministic: seed + fixed 1/60 steps, render one frame)
- 1-drive.jpg  ?shot=drive&at=2.5 — arterial chase, 26 m/s, 14 traffic cars, 1 star.
- 2-heat.jpg   ?shot=heat&at=6   — 4.2 stars, 3 cruisers, helicopter, 6 broken props.
- 3-foot.jpg   ?shot=foot&at=2   — on foot, pistol out, crosshair, peds fleeing.
- 4-story.jpg  ?shot=story&at=1.5 — marina, Pak Wira, toast line, job beacon, parked car.

## Bugs fixed during this build (from the plan's re-read)
1. Mission 2 dead coordinate → LOCATIONS table + loc() that throws; missions
   reference locations by name only.
2. Bill never reduced cash → settle() return value subtracted in complete().
3. Player car double-stepped → skipTraffic flag, skipped in updateTraffic.
4. Bullets through buildings → City.solids AABBs added to ray targets.
5. Autosave never fired → saveTimer accumulates, save() every 20 s.
6. Survive steps spawned nothing → survive steps carry a spawn count + timer.
7. Respawn used setTimeout → respawnTimer counted down in step().
- Dead code stripped: no-op assignments, empty loops, no-op heat clamps.

---

# v2 — ALL-IN build pass (19 Nov 2026, recorded session)

Driven by the GLM mock-judge study vs top 10 (`TOP10-GLM-STUDY.md`):
BENTARA lost vs HALCYON #1 (0.15 vs 0.85) and Isla Dorada #4 (0.20 vs 0.80);
criterion 2 (depth) decided both. This pass closes all five consensus gaps
plus the 22 + 24 Nov items in one pass (Yiro: ALL IN, single pass).

## What changed
- **Golden-hour lighting** (config.js palette, lighting.js, world.js): low warm
  sun (230, 46, 95), orange→blue sky-dome gradient, haze fog, ACES tone
  mapping, amber emissive windows, dust motes + dust devils, mural on the
  tallest building (west face) — kemarau identity kept, no sunset/coastal
  imitation.
- **Chase cam** (player.js): car 6.2 m back / 2.1 m up (was 9 / 3.4); the car
  fills 25–35% of the frame, bottom-centre.
- **Density** (traffic.js 22 cars: angkot/ojek/bajaj/sedan/truck, lane-following,
  intersection pauses, flee on gunfire; peds.js 32 peds, zebra crossings,
  flee; car.js kinds + POLISI livery + split red/blue lightbar; police.js
  heli 60% bigger + narrow spotlight cone + ground pool, real roadblock
  barriers + spike strips; props.js 64 props incl. warung kopi clusters).
- **Depth** (new collectibles.js: 24 idols/tapes, cash + REP, HUD counter;
  new taxi.js: fares at 6 stands, teal beacon, paid by distance; new race.js:
  5 checkpoint gates, par 75 s, double payout under par).
- **Characters** (new dialogue.js: procedural portraits for Pak Wira, Sari,
  Bang Ijal, Letkol Rahmat, Bang Ocid; mission intros per mission, Rahmat
  taunts at 3+ stars, DJ lines for Radio Kemarau 92.4).
- **HUD** (hud.js + index.html): circular dark radar minimap (road graph,
  objective diamond, police blips, collectible dots, taxi blip, search ring,
  N compass), circular speed gauge (needle, gear, condition arc), 3-slot
  weapon strip (Pistol ∞ / Shotgun shells / SMG locked $450), score popups
  (new popups.js: DRIFT / NEAR MISS / collect / fare / gate), "DI PANDANG"
  flash, collectible + taxi lines, DJ rotation in the radio line.
- **Combat feedback** (combat.js: muzzle flash + impact sparks; player.js:
  real drift detection paying $60/s; game.js: near-miss detection $250).
- **Missions** (missions.js: dispatch-table step handlers, intro hook per
  mission; the 8 missions, titles, rewards and step data are unchanged).
- **Shots** (shots.js): cover now shows Pak Wira's portrait + dialogue, a
  waiting taxi passenger, a gold collectible and a REAL drift popup (earned
  by a handbrake slide in the last 1.3 s); drive shows taxi + collectible;
  foot really collects an idol (counter 1/24 + popup); story shows Wira's
  portrait + a taxi passenger by the pier.
- **Save fixed** (save.js): v1.6 saved `state.missionIndex` /
  `state.player.hasShotgun`, neither of which existed, so every save loaded
  as null. Saves now carry an explicit snapshot (cash, rep, mission, shotgun,
  collectibles, taxi trips, race best).

## Shots v2 (1280x720, deterministic)
- 1-heat.jpg  ?shot=heat&at=2   — cover: 4.2 stars, 3 cruisers, heli + narrow
  spotlight, 6 broken props ($235 bill), Wira portrait + dialogue, taxi passenger,
  collectible, real DRIFT popup, mural in frame.
- 2-drive.jpg  ?shot=drive&at=2.5 — arterial 26 m/s, 22 traffic cars, 1 star,
  taxi passenger + collectible on the sidewalks.
- 3-foot.jpg   ?shot=foot&at=2   — on foot at Plaza, pistol, peds fleeing,
  idol really collected (KOLEKSI 1/24 + popup).
- 4-story.jpg  ?shot=story&at=1.5 — marina, Pak Wira + portrait, taxi
  passenger by the pier, foreground props + peds.

## Verification (this session)
- Syntax-check every game/src module as ES modules.
- Headless Chromium run: 4 `?shot=` scenes at 1280x720, zero console errors.
- 8 missions end-to-end in a headless test (teleport + real key events).
- `main.ts` → /output + dossier.json, preflight (3–4 screenshots ≤256 KiB).
- Triangle audit vs the <150k budget.
