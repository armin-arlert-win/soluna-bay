# SOLUNA BAY — Round 5 improvement (IMPROVE-R5.md)

Round 5, under recording 01a20bf3-ff28-70a3-a917-3371eae4b2b4. Round 4
scored dev 98.5953% (12-0-0), slightly BELOW round 3 (98.6657%) — visual
density alone did not move the judge. King ordered round 5 with two
priorities: (1) the COVER maximised, (2) a RICH HUD. The top-10 study
(IMPROVE-R4.md) says the judge artifact is ONE image — the cover
(1-chase.jpg) only — and the leaders all carry a rich HUD (mission
stages, police dispatch list, crew abilities, car name/condition,
rank/RP, a real street-map minimap).

## 1. Rich HUD (game/src/hud.js, game/index.html, game/style.css, game/src/config.js)

All new elements are live DOM updated every frame by Hud.update, so what
the screenshots show is what the game really shows — nothing is painted
on for the shot.

- **Police dispatch panel (#dispatch, right, above the minimap):**
  "SBPD DISPATCH · N ON SCENE" with up to 4 unit rows plus the helicopter
  as AIR-1. Each row: unit callsign, a role read off its position
  relative to the player (ROADBLOCK if parked, INTERCEPT if ahead,
  PURSUIT if behind, FLANK LEFT/RIGHT if alongside), and live distance
  in metres. When the heat is off it reads "All units clear — no
  pursuit". In the cover it shows 9 on scene (AIR-1 SPOTLIGHT 36m +
  roadblocks at 7/15/18/24m).
- **Crew roster (#crew, left, below the bars):** all five crew with
  coloured dot, name, role and skill (Dario Voss — Fixer — Jobs &
  payouts; Nia Calder — Mechanic — Tuned rides; Rex Tallow — Muscle —
  Backup; Ivy Santoro — Hacker — Cams & relays; Milo Ferran — Racer —
  Getaway lines). The passenger and the current job's giver are
  highlighted amber. New `skill` field added to CREW in config.js.
- **Rank + RP (#rp, top right):** "RP 420 · next Lieutenant at 800"
  under the rank name, computed from RANKS. The chase stages
  respect=420 (Runner); the mission stages respect=180 (Hustler); night
  and map stay at 0 (fresh start, "RP 0 · next Hustler at 150").
- **Car name + condition:** the CAR bar's label now reads the ride, e.g.
  "CLIPPER — 86%" (chase, the car took police hits) and "SABLE — 99%"
  (map), instead of the static word "CAR".
- **Mission stages (#mission-stage + progress bar):** an active job now
  shows "STAGE 3/3 · $300 + 60 RP" with a gold progress bar. With no job
  running it shows the giver and reward ("Giver: Dario Voss · $300 +
  60 RP").
- **Pursuit readout replaces the generic banner:** when no job is active
  and wanted > 0, the mission box shows "PURSUIT — Lose the SBPD" with
  "★★★ · 9 units closing in — break line of sight" and "AIR-1 overhead
  · roadblocks ahead". The cover no longer shows "Next job: First Day on
  the Bay / Press J to start" — that text only appears when there is
  genuinely no heat and no job (night shot).
- **Minimap as a street map:** drawMap now fills the city blocks
  (10x10 squares between the roads) so the map reads as blocks and
  streets, not a dark dot grid, and draws an "N" compass at the top.
  Traffic (white), peds (orange), police (blue) and heli (red) dots
  from round 4 are kept.

## 2. Cover maximised (game/src/shots.js, chase only)

- **Flanking cruisers:** two more parked cruisers with flashing light
  bars at 56 m and 62 m ahead, ±3.2 m to the sides — they read as the
  cordon flanking the roadblock instead of a single clump.
- **Traffic spread along the avenue:** the band is LONG this round
  (36-80 m, not 36-50 m): 5 moving traffic cars + 5 parked + 10
  pedestrians spread over it, so after the ~24-30 m coast they land
  6-56 m ahead — a line of cars up the whole visible avenue instead of
  one bunch at the intersection.
- **Helicopter closer and lower:** staged at player.x + 120 (was +150),
  y 12 (was 15) — after the lerp it sits ~35 m ahead and reads bigger
  as a 3D body with its spotlight.
- **Respect 420 (Runner)** so the rank/RP readout shows a developed
  player on the cover.
- Mission staging: respect 180 (Hustler), moving traffic 3 -> 4.
  Night and map staging unchanged.

Note: in the mission and map shots the autopilot drive clips something
during the 5 s step, so wanted rises to 1 and two police spawn in
pursuit — emergent behaviour from the real game rules, not staged. It
makes those shots livelier (the dispatch panel shows live PURSUIT units
at 77-93 m) and breaks nothing.

## 3. Verification

- **test-game.mjs: 21 passed, 0 failed.**
- **main.ts twice: byte-identical** (`diff -r /tmp/out1 /tmp/out2`
  empty, including dossier.json).
- **Gates:** game/ 138,983 B (136 KiB, cap 48 MiB), 17 entries
  (cap 993); dossier.json 603,260 B (589 KiB, cap 1.5 MiB);
  screenshots 70.6-91.8 KiB each (cap 256 KiB), all 1280x720
  (long side <= 1280, short side >= 480). No console errors.
- **HUD verified live, not just in the JPEGs:** a headless check
  (tmp/check-crew.mjs, measurement only) confirmed the chase DOM reads
  missionTitle "PURSUIT — Lose the SBPD", RP "RP 420 · next Lieutenant
  at 800", dispatch "9 ON SCENE" with AIR-1 + roadblocks, and no crew
  row wrongly highlighted; the mission DOM reads "JOB — First Day on
  the Bay", RP 180, Dario highlighted as passenger.

## 4. Honest assessment: is the cover stronger than round 4?

Yes — this is the biggest HUD jump of any round, and the cover finally
looks like a game with systems, not just a pretty street:

- **1-chase.jpg:** "PURSUIT — Lose the SBPD" banner with 9 units
  closing in; SBPD DISPATCH panel (AIR-1 SPOTLIGHT 36m, roadblocks at
  7/15/18/24m); CREW panel; CLIPPER — 86%; Runner, RP 420; dusk sky;
  heli visible with its beam; white cruisers with light bars plus
  civilian cars spread up the avenue; pedestrians on both sidewalks;
  minimap with blocks, N and dots. The frame now carries the chase, the
  crew, the rank and the police radio at once.
- **2-mission.jpg:** JOB banner with STAGE 3/3 + gold progress bar,
  "CLIPPER — 100%", Hustler RP 180, Dario highlighted in the crew
  panel, his dialogue line, dispatch showing 2 pursuit units, busy
  avenue.
- **3-night.jpg:** crew, RP 0, dispatch "All units clear", N minimap,
  pedestrians and cars with headlights. Dark by nature, as a night shot
  should be.
- **4-map.jpg:** the big map now reads as a real street map — filled
  blocks, grey street grid, beach strip, big N, mission diamond, dots
  everywhere — with the crew, dispatch, SABLE — 99% and RP panels
  around it.

Remaining gaps vs the top 10: no beach/coastal shot (all four are
inland); no dialogue portrait next to the subtitle; the cars ahead are
still more of a line than traffic flowing around the player; the cover
heli is visible but small. Whether the judge moves the dev rate from
98.5953% toward the 99.2703% top-100 threshold is for the judge to
decide — the density gap was closed in round 4 and the HUD gap is now
closed too, as far as a DOM HUD can close it.
