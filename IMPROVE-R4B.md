# SOLUNA BAY — Round 4 re-witness (IMPROVE-R4B.md)

Re-witness pass under recording 01a20bc9-77bb-71cb-b558-4b86656d4ee9.
The previous recording (01a20bb3) died 11:11 WIB, before the R4 agent's
last shots.js edit (11:15) and screenshot regeneration (11:16-11:17), so
those were unwitnessed. This pass re-authors a genuine change in
shots.js and regenerates all four screenshots under the new recording.

## 1. The polish (mine, in game/src/shots.js)

Reading the mission staging I found a timing bug the R4 report missed:
`world.talk('Dario Voss: "Keep it smooth. The Docks, and no heroes."', 6)`
is timed from `world.time` (world.js `talk()` sets
`subtitleUntil = this.time + seconds`, and `step()` clears the subtitle
once `this.time > subtitleUntil`). The mission staging then runs a 5 s
autopilot drive, and the browser waits another ~1.8 s while the game
keeps stepping — ~6.8 s total, past the 6 s line. I confirmed it on the
old screenshot: 2-mission.jpg showed the JOB banner and
"Passenger: Dario Voss" but NO dialogue line — the subtitle element
(bottom-centre, #subtitle in style.css) was empty.

Fix (1 line + comment): duration 6 -> 12 s, so the line is still on
screen at shutter time with margin. Verified on the new screenshot: the
italic line `Dario Voss: "Keep it smooth. The Docks, and no heroes."`
now reads under "Passenger: Dario Voss". This is the dialogue-box
element the top-10 leaders all show; ours was silently missing.

Nothing else changed: no module structure, no file renames, no new
dependencies/network; city.js and hud.js untouched.

## 2. Regeneration

`node take-shots.mjs` re-ran under this recording, no console errors:
- 1-chase.jpg 70,078 B (was 67,296)
- 2-mission.jpg 76,597 B (was 72,062) — larger, the dialogue text
- 3-night.jpg 55,784 B (was 55,729)
- 4-map.jpg 80,889 B (was 80,441)

All 1280x720. The 1-chase/3-night/4-map deltas are just SwiftShader
frame-timing variance in the 1.8 s coast; the staging is unchanged.

## 3. Verification

- **test-game.mjs: 21 passed, 0 failed.**
- **main.ts twice: byte-identical** (`diff -r /tmp/out1 /tmp/out2`
  empty, including dossier.json).
- **Gates:** game/ 130,237 B (127 KiB, cap 48 MiB), 17 files/dirs
  (cap 993); dossier.json 513,468 B (501 KiB, cap 1.5 MiB);
  screenshots 55.8-80.9 KiB each (cap 256 KiB), 1280x720
  (long side <= 1280, short side >= 480).

## 4. Honest assessment: do the new screenshots show a busy city?

Yes — all four, viewed directly:

- **1-chase.jpg (dusk):** orange sunset, colourful buildings, heli
  visible top-centre with its searchlight beam on the player's red car,
  a white cruiser with flashing light bar plus several civilian cars
  bunched at the intersection ahead, pedestrians on both sidewalks,
  minimap full of dots. Reads as a police chase at sunset.
- **2-mission.jpg:** line of cars ahead (purple, green, black, orange),
  pedestrians on both sidewalks, JOB banner, "Passenger: Dario Voss",
  and now the Dario dialogue line. The street reads busy and the
  mission active.
- **3-night.jpg:** pedestrians on both sidewalks, cars ahead with
  headlights, street lamp on, player walking up the street. Night city
  alive (dark by nature, as a night shot should be).
- **4-map.jpg:** map full of white (traffic), orange (ped) and blue
  (police) dots over a readable street grid, beach strip on the left,
  mission diamond, player arrow.

Remaining gaps vs the top 10 (unchanged from R4): HUD still thin (no
police dispatch list, no crew abilities, no car name/condition, no
rank/RP, no dialogue portrait); cars ahead form a bunched cluster
rather than flowing traffic flanking the player; no beach/coastal shot;
the chase cover still shows the generic "Next job: First Day on the
Bay" banner rather than a chase-specific objective.
