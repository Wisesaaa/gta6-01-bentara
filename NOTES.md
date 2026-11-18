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
