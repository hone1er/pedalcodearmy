# Ran When Parked — V2 Gameplay, Graphics, Audio & Polish Spec

> Derived from Opus 5.5's comprehensive review & headless bot probes of **Ran When Parked** on branch `feat/simulator-polish-v2`.
>
> **Golden Rule (NON-NEGOTIABLE):** `RideTelemetrySnapshot`, `RunnerHudSnapshot`, `SimAppSnapshot`, Audio, Renderers, and React Views MUST NEVER import `faults/catalog`, reference `FaultId`s, or expose a live hidden-fault answer key. Every symptom, verdict, sound, and visual must emerge strictly from observable physical telemetry and road-tested observations.

---

## 1. Frozen V2 Contract Additions (`src/lib/simulator/contract/`)

Already committed/frozen in `contract/ids.ts`, `contract/types.ts`, `contract/snapshot.ts`, `contract/fixtures.ts` — **DO NOT edit files inside `src/lib/simulator/contract/` in subagent lanes!**

- `BikeVerdict = "untested" | "ran-clean" | "acting-up"`
- `RouteMedal = "finished" | "speed" | "cool-head" | "hot-coffee"`
- `StallReason = "none" | "fuel" | "spark" | "idle" | "plug-chop" | "kill-switch"`
- `OwnedBike.wear.airFilterDirt?: number` and `OwnedBike.verdict?: BikeVerdict`
- `SimSaveState`: `version: 1 | 2`, `routeMedals?: Partial<Record<RouteId, RouteMedal[]>>`, `runnerBestDistanceM?: number`
- `SimEvent`: adds `{ type: "gear-shift"; gear: 1 | 2 }` and `"kill-switch"` stall reason
- `RideTelemetrySnapshot`: optional `airFilterVisual`, `nextStoplightM`, `nextStoplightState`, `upcomingPotholesM`, `nextPotholeM`, `seizeCooldownHot`, `currentGear`, `gearShiftPulse`
- `SimAppSnapshot`: `standTest: RideTelemetrySnapshot | null`, `runnerPlaying: boolean`, `bikeVerdict: BikeVerdict`, `bikeNeedsAttention: boolean` (derived strictly from `bikeVerdict === "acting-up"`)
- `SimStoreActions`: `startStandTest`, `stopStandTest`, `setStandInput`, `kickStandTest`, `setRunnerPlaying`
- `RideSummary`: `medalsEarned?: RouteMedal[]`, `newMedals?: RouteMedal[]`
- `RunnerRunSummary`: `engineTopSpeedMph?: number`, `cleanTuneBonus?: boolean`, `isNewBestDistance?: boolean`

---

## 2. Parallel Lane Ownership (STRICT — ZERO FILE OVERLAP)

| Wave | Lane | Model | Exclusive Owned Files |
|---|---|---|---|
| **Wave 1** | **O1 — Core Engine, Economy, Faults, Save & Store** | Opus 5.5 | `src/lib/simulator/engine/engine-sim.ts`, `src/lib/simulator/faults/catalog.ts`, `src/lib/simulator/diagnostics/tools.ts`, `src/lib/simulator/economy/catalog.ts`, `src/lib/simulator/save/storage.ts`, `src/lib/simulator/store/sim-store.ts`, `src/lib/simulator/core/rng.ts` |
| **Wave 1** | **O2 — Tuning Rides & Street Runner Sim** | Opus 5.5 | `src/lib/simulator/ride/ride-sim.ts`, `src/lib/simulator/ride/routes.ts`, `src/lib/simulator/runner/runner-sim.ts` |
| **Wave 1** | **H1-A — Audio Synth, Ride Canvas & Captions** | Hydrogen | `src/lib/simulator/audio/pulse-synth.ts`, `src/lib/simulator/render/ride-renderer.ts`, `src/components/simulator/hud/caption-layer.tsx` |
| **Wave 2** | **H1-B — Street Runner Canvas Renderer** | Hydrogen | `src/lib/simulator/runner/runner-renderer.ts` |
| **Wave 2** | **H2 — All React Simulator Views** | Hydrogen | `src/components/simulator/simulator-root.tsx`, `src/components/simulator/garage/garage-view.tsx`, `src/components/simulator/garage/moped-workbench.tsx`, `src/components/simulator/garage/plug-viewer.tsx`, `src/components/simulator/ride/ride-view.tsx`, `src/components/simulator/runner/runner-view.tsx`, `src/components/simulator/runner/runner-leaderboard.tsx`, `src/components/simulator/map/route-map.tsx`, `src/components/simulator/shop/parts-counter.tsx`, `src/components/simulator/shop/craigslist-market.tsx` |

---

## 3. Detailed Lane Specifications

### Lane O1 (Opus 5.5) — Core Engine, Economy, Faults, Save & Store

1. **G2 — Road-Tested Bike Verdict (Remove Answer-Key Leak)**:
   - Every bike tracks `verdict: BikeVerdict` (`"untested"` initially and reset to `"untested"` on ANY garage part swap, jet/needle/idle change, premix/kill-switch/carb/air-filter action).
   - ONLY completing a real ride (`outcome === "finished" | "pedaled-home" | "towed" | "seize-crash"`) or Runner run (`distanceM > 30` or `endReason === "seized" | "stalled"`) updates `bike.verdict`:
     - `"acting-up"` if breakdown/seized/stalled OR any symptom observation was recorded (`summary.notes` has mechanical symptoms, or `detonations > 0`, or engine never ran cleanly).
     - `"ran-clean"` if finished cleanly (or ran cleanly in Runner with 0 symptom notes & no breakdown).
   - `SimAppSnapshot.bikeVerdict = bike.verdict ?? "untested"`, and `bikeNeedsAttention = bikeVerdict === "acting-up"` (NEVER derived from `hasUnresolvedFaults(bike)`!).
   - Make `installPart` / `cleanCarburetor` / `toggleKillSwitch` notices neutral — e.g. `"Installed Bing/Dellorto Main Jet #60. Fire it up on the stand or take a test ride to feel the difference."` (do NOT reveal whether a hidden fault cleared!). Keep `recordFixes` awarding `first-fix` & journal entry cleanly, or delay/keep post-fix journal non-spoiler.
2. **G3 — Garage Stand Test ("Fire It Up!" on the center stand)**:
   - In `engine-sim.ts`, add `StandTestState`, `createStandTest(bike, opts)`, `stepStandTest(state, input, dt)`, `buildStandSnapshot(state)`. Reuses `stepEngine` with `speedMps: 0, clutch: true`, so:
     - Air leaks produce an audibly high, hunting idle.
     - `idleScrew` audibly shifts idle RPM and can stall if way off.
     - `choke` helps cold start (<40°C) and floods/kills a warm engine.
     - Blipping throttle reveals rich four-stroking (`blub-blub` + thick blue-grey smoke) vs lean thin rasp vs crisp braap!
     - Rebuilds profile cleanly if player adjusts idle screw/choke/kill switch while on stand.
   - In `sim-store.ts`, implement `startStandTest`, `stopStandTest`, `setStandInput`, `kickStandTest`, plus `getLatestStandSnapshot()` for 60 Hz `PulseSynth` + SVG smoke/vibration, and drive it on the store's rAF loop when `standTestState` is active (auto-stop when leaving `"GARAGE"` or starting a ride!).
3. **G6 — Authentic Make Identity (`engine-sim.ts`)**:
   - **Puch Maxi (`puch-maxi`)**: Single-speed E50 with strongest low-end launch torque (`torque: 2.45`, crisp bottom end).
   - **Honda Hobbit (`honda-hobbit`) & Derbi Variant (`derbi-variant`)**: Real CVT variator gearing — variable effective ratio that smoothly shifts from low launch ratio (`~1.38×` RPM_PER_MPS) toward high overdrive (`~0.88×`) to hold engine RPM near `powerbandRpm` under load!
   - **Tomos A35 (`tomos-a35`)**: Real 2-speed automatic gearbox! 1st gear (`1.32×` ratio, strong launch) shifts up to 2nd gear (`0.94×` ratio) around ~17–18 mph (`7.8 m/s`, hysteresis downshift at `5.6 m/s`), dropping RPM briefly, giving a crisp torque kick, setting `s.currentGear` (`1 | 2`) and `s.gearShiftPulse = true`, and emitting `{ type: "gear-shift", gear }`.
   - Also store `airFilterVisual` on `BikeProfile` (`"stock" | "performance" | "race"`).
4. **G5 — Economy Rebalance (`sim-store.ts`)**:
   - In `completeRunnerRun`:
     - Track `runnerBestDistanceM` on `SimSaveState`. Award Runner Rep ONLY when the player crosses a new 250m personal-best distance band (or first run >150m), so Rep gates stay meaningfully tied to Tuning Rides!
     - Call `injectRideFault` after Runner runs with `distanceM > 600 && result.pushedHard` (when bike was healthy, matching Tuning Rides!).
     - Award `full-send` badge on `summary.engineTopSpeedMph ?? summary.topSpeedMph` (>= 42 mph, excluding Treatland turbo!).
   - **B13**: In `completeRunnerRun`, drop the `?? getActiveBike(save)` fallback — if `summary.bikeId` is no longer in `save.bikes` (e.g. after reset), return early without applying wear/cash!
5. **G7 — Save Schema v2 & Route Medals (`storage.ts`, `sim-store.ts`)**:
   - Bump `createStarterSave()` to `version: 2` with `routeMedals: {}`, `runnerBestDistanceM: 0`, `wear.airFilterDirt: 0`, `verdict: "untested"`.
   - Migrate `version: 1` saves seamlessly in `loadSave()` (backfill `routeMedals`, `runnerBestDistanceM`, `airFilterDirt: 0`, `verdict: "untested"`).
   - In `completeRide`, merge `result.summary.medalsEarned` into `save.routeMedals[routeId]` and compute `newMedals`!
6. **B8 — Kill-Switch Stall Reason (`engine-sim.ts`)**:
   - When `input.killSwitch` is held with `thr < 0.75`, stall with `reason: "kill-switch"` (NOT `"spark"`!).
7. **B9 — Real Air Filter Dirt Maintenance (`engine-sim.ts`, `sim-store.ts`, `diagnostics/tools.ts`)**:
   - Add `airFilterDirt` (0..100) to `OwnedBike["wear"]`; dirty air filter (>45) progressively restricts airflow (richens mixture slightly, up to +12% richer at 100 dirt).
   - `cleanAirFilter()` resets `bike.wear.airFilterDirt = 0` and gives honest feedback (`"Knocked a cloud of East Bay dust out of the air filter — breathes easier now."` vs `"Tapped out the air filter — already pretty clean."`).
   - Visual inspection on `air-filter` / `carburetor` mentions dusty filter if `airFilterDirt >= 45`.
8. **Runner Playing Store Flag (`sim-store.ts`)**:
   - Add `runnerPlaying` boolean state + `setRunnerPlaying(playing: boolean)` action (auto-clears on `completeRunnerRun`, `resetSave`, or phase switch away from `"RUNNER"`).

---

### Lane O2 (Opus 5.5) — Tuning Rides & Street Runner Sim

1. **G1 — Runner Zone Grades, Headwind, Slow-Traffic Bus & Real Heat (`runner-sim.ts`)**:
   - Give each `RunnerZone` a real grade & wind profile:
     - `oakland-hills`: rolling climbs `+4%` to `+9%` over 80–150m stretches!
     - `lake-merritt`: gentle rolling `-1.5%` to `+2.5%`!
     - `telegraph-ave`: city slight climb `0%` to `+3.5%`!
     - `bay-bridge`: flat-out `+1%` with strong headwind (`windDragMult = 1.28`)!
     - `west-oakland`: fast `-3%` downhill!
   - Apply real gravity `m * G * (gradePct / 100)` and `windDragMult` to `netForce`, and pass real `gradePct` in `RunnerHudSnapshot` and `buildRunnerAudioTelemetry`!
   - Add an **AC Transit Bus** (`subKind: "bus"` or `carVariant: "bus"`, slow `3.5–4.5 m/s`, long `10.5m` obstacle) that can box traffic down and lower airflow cooling when you're stuck coasting behind it, making lean jetting genuinely heat up, ping, and demand `[Q]` clutch / `[B]` coast!
   - Verify headlessly that a `-8` or `-14` lean bike hits >195°C and pings/seizes on Oakland Hills climbs while a properly jetted bike stays healthy!
2. **G2 — Pure Sensation Runner Popups (`runner-sim.ts`)**:
   - Rewrite ALL Runner symptom popup subtexts as pure sensations (NO diagnostic answers!):
     - Rich: `"Thick blue fog — sounds wet and lazy"` (not `"Too rich — jet down"`)
     - High-RPM: `"Cuts out when you wring it"` (not `"Check spark"`)
     - Random stutter: `"Stumbling under load"` (not `"Pull the plug"`)
     - Lean: `"Running razor thin and screaming"`
     - No premix: `"No smoke — sounds bone dry!"`
3. **B2 — True Engine Top Speed (`runner-sim.ts`)**:
   - Track `engineTopSpeedMph` updated ONLY when `s.turboSec <= 0`.
   - Populate `summary.engineTopSpeedMph` AND keep `summary.topSpeedMph` (or set `engineTopSpeedMph` cleanly rounded to 0.1).
   - Add clean-tune cash bonus: `cleanTuneBonus = s.notes.length === 0 && distM >= 150`; apply `1.25×` cash bonus when `cleanTuneBonus` is true, and reduce base cash slightly (`score / 190`) so untuned runs pay modestly while dialed builds pay great!
4. **B3 / V1 / A1 — Runner Death Beat Window (`runner-sim.ts`)**:
   - Add `dying: boolean`, `deathElapsedSec: number`, `deathDurationSec: number` (`1.25`), `deathReason: RunnerEndReason | null` to `RunnerState` and `RunnerHudSnapshot`.
   - When fatal hit (`health <= 0`), `seize-crash`, or dead-stop `stalled` occurs: enter `dying = true` (`deathElapsedSec = 0`, `deathReason = ...`) instead of immediately setting `finished = true`!
   - While `dying`: step at `0.3×` slow-mo for the first `0.45s`, then hold freeze/slide until `deathElapsedSec >= 1.25s`, THEN set `finished = true` and `endReason = deathReason`! Audio & crash/seize events play out completely!
5. **A6 — Hit-Stop & Escalated Audio Events (`runner-sim.ts`)**:
   - Add `hitStopSec: number` on `RunnerState` (`0.065s` on crash hit or wheelie-clear apex — pauses motion briefly for crunchy arcade impact while keeping particles/shake alive!).
   - Include `comboCount` on `pickup` event (`{ type: "pickup"; kind; points; comboStep: number }`) for ascending pitch ladder!
   - Add `{ type: "car-horn" }` (when cutting tightly into a car's lane) and `{ type: "dog-bark" }` (when approaching a crossing dog) to `RunnerEvent`!
6. **G9 + G10 + G11 + B14 — Runner Escalation, Hold-to-Wheelie, Crossing Dogs & No Car Walls (`runner-sim.ts`)**:
   - **G11**: Dogs are NOT `groundHazard` (must be dodged, NOT wheelied over!), and dogs cross laterally (`lateralSpeed: ±0.75` lanes/sec) with a bark telegraph! Potholes, oil slicks, and cones stay `groundHazard: true` (wheelie-able).
   - **B14**: Prevent moving cars from ever overtaking into a wave ahead and creating a 3-lane wall — clamp each car's `xM` to stay at least `16m` behind any other car/bus ahead in any lane (and `22m` behind a car in the same lane), eliminating both impossible 3-lane walls and visual car clipping!
   - **G9**: Past `1400m`, spawn occasional blinking lane-changing cars (`blinkerDir: -1 | 0 | 1`, `laneChangeTimerSec`, signals 1.2s before smoothly shifting 1 lane!). Scale obstacle spacing slightly with `speedMps` so fast 70cc builds stay thrilling yet readable.
   - **G10**: Add `wheelieHeld?: boolean` to `RunnerInput`: quick tap still pops a clean arcade wheelie, AND holding Space lets you ride the wheelie longer up to a balance limit (excessive over-hold tips back gently and drops the front wheel, rewarding tuned powerband control!).
7. **G7 + G8 + B8 — Real Potholes, World Stoplights & Route Medals (`ride-sim.ts`, `routes.ts`)**:
   - Pre-generate deterministic pothole world positions (`potholes: { positionM: number; hit: boolean }[]`) in `createRideState` from route segments' `potholeDensity`!
   - Expose `nextStoplightM`, `nextStoplightState`, `upcomingPotholesM` (potholes within `-15m..+75m` of player), `nextPotholeM`, `currentGear`, `gearShiftPulse`, `airFilterVisual`, and `seizeCooldownHot` in `buildRideSnapshot()`.
   - When crossing a pothole: if `input.brake` is held OR `speedMph < 14`, cut coffee spill by 75% (skill-based pothole braking instead of RNG!).
   - Handle `"kill-switch"` stall reason cleanly: emit caption `"Not enough throttle for a clean chop — hold it wide open!"` (`"cyan"`, `"chop-low-thr"`, 4).
   - Add `airFilterDirt` wear (`km * 1.4`) in `finalizeRide` and `finalizeRunnerRun`.
   - Evaluate Route Medals in `finalizeRide()` (when `outcome === "finished"`):
     - `"finished"`: completed route
     - `"speed"`: finished under route par time (Telegraph ≤155s, Lake Merritt ≤165s, Grizzly Peak ≤160s, Midnight Tunnel ≤135s)
     - `"cool-head"`: `maxChtC < 190` AND `state.opts.hasChtGauge`
     - `"hot-coffee"`: Telegraph Coffee Run with `coffeeTempPct >= 45 && coffeeSpillPct <= 35` (or no-breakdown clean run on non-coffee routes: `notes.length === 0 && eng.detonations === 0 && eng.seizesSaved === 0`)

---

### Lane H1-A (Hydrogen) — Unified Audio Synth, Ride Canvas & Captions

1. **A2 + A3 + A4 + A5 + A7 + A8 + A9 — `pulse-synth.ts`**:
   - **A2**: Add `playArcade(kind: "lane-shift" | "wheelie" | "wheelie-clear" | "close-call" | "pickup" | "shop-arch" | "hit" | "car-horn" | "dog-bark" | "zone-change", opts?: { strong?: boolean; comboStep?: number; shop?: string })` routed cleanly through `this.sfxBus` (compressor + master gain + mute)!
   - **A7**: Add `playGarage(kind: "install" | "plug-pull" | "carb-spray" | "compression-kick" | "spark-snap" | "jet-click" | "switch-flip", opts?: { sparkQuality?: "fat-blue" | "weak-orange" | "none" })` routed through `this.sfxBus`!
   - **A3**: Add 2-stroke acoustic soul:
     - Throttle-chop overrun "ring-ding": when throttle drops sharply from >0.6 to <0.15 above 3800 RPM, emit sparse bright overrun pops for ~0.5s.
     - Intake honk: subtle ~400 Hz band-passed noise scaled by throttle, +60% louder when `snapshot.airFilterVisual === "performance" || "race"`.
     - Powerband sweep: short resonant filter sweep when `powerbandActive` rises from `false → true`.
   - **A4**: Startup sequence: on successful `kickstart`, play 2–3 quick stumbling catch pops + brief rev flare before settling! On failed kick, play metallic kickstart lever ratchet + compression whoosh.
   - **A5**: Per-make voice:
     - Pitch offset per `bikeMake`: `tomos-a35` slightly brighter (+12%), `puch-maxi` deeper (-8%), `honda-hobbit`/`derbi-variant` add subtle road-speed-tracked CVT belt hum!
     - Handle `{ type: "gear-shift" }` event with a crisp mechanical 2-speed shift clunk!
   - **A8**: When `snapshot.seizeCooldownHot` is true and `!snapshot.engineRunning`, emit subtle periodic metallic tick-tick cooling pings + soft steam hiss.
   - **A9**: On `{ type: "caption" }`, play a very subtle, non-fatiguing soft comic pop (`gain <= 0.03`).
2. **V5 + V6 + V7 + V8 — `ride-renderer.ts`**:
   - **V5 (World-Placed Stoplights, Real Potholes & Landmark Set Pieces)**:
     - Position stoplight gantry in world coordinates using `(snapshot.nextStoplightM - snapshot.distanceM) * pxPerMeter` when `snapshot.nextStoplightM != null` (fallback to existing behavior only if null), so the gantry smoothly scrolls into view as you approach!
     - Draw REAL potholes on the asphalt at `(potholeM - snapshot.distanceM) * pxPerMeter` for each entry in `snapshot.upcomingPotholesM` (with subtle yellow crack warning rim so players can brake before them!). Remove the old fake decorative potholes when `upcomingPotholesM` is provided.
     - **Landmark Set Pieces**:
       - **Caldecott Tunnel** (when `snapshot.routeId === "midnight-tunnel"` and `snapshot.landmark?.toLowerCase().includes("caldecott") || snapshot.landmark?.toLowerCase().includes("bore")`): render dramatic dark vaulted tunnel ceiling/wall with strobing warm orange sodium overhead lights & tunnel portal arches!
       - **Grizzly Peak Overlook** & **Fox Theater** roadside signs when approaching those landmarks!
   - **V6 (Pulse-Synced Smoke, Backfire Pop & Detonation Flash)**:
     - Sync exhaust smoke puff cadence to RPM + `misfirePattern`: `"alternate"` emits rhythmic double-gap puffs (`puff…puff`), `"random"` creates irregular sputter puffs.
     - Emit brief orange/blue stinger flame pop on high misfire or sudden throttle chop.
     - Render a crisp white flash ring at the cylinder head when `snapshot.detonationPulse` is true!
   - **V7 + V8**: Cache resolved CSS `--font-bangers` / `--font-russo-one` font strings via `getComputedStyle(document.documentElement)` on init; standardize rider helmet to PCA Gold (`#FFD700`) with black racing stripe across both modes!
3. **B6 — `caption-layer.tsx`**:
   - Replace fixed overlapping absolute slots with a clean centered vertical flex stack (`top-3 inset-x-0 flex flex-col items-center gap-1.5 px-4 z-[25]`) so multiple simultaneous captions NEVER overlap each other or badges!

---

### Lane H1-B (Hydrogen, Wave 2) — Street Runner Canvas Renderer (`runner-renderer.ts`)

1. **V1 (Wipeout & Seize Death Sequence)**:
   - When `state.dying` is true:
     - `"crashed"`: bike tilts onto its side sliding across asphalt throwing bright orange/yellow sparks, rider tumbles forward in a comic arc, then halftone comic banner `"WIPEOUT!"`!
     - `"seized"`: rear wheel locks with a thick black rubber skid mark stretching behind the tire, heavy blue-grey smoke + white steam burst from the cylinder, and comic banner `"SEIZED!"`!
     - `"stalled"`: engine puffs final wispy cough + comic banner `"STALLED OUT!"`.
2. **V2 (`spawnBurstAtPlayer`)**:
   - Add `spawnBurstAtPlayer(state: RunnerState, color: string, count = 10)` using exact `laneY(state.lanePos)` and `playerScreenX` so every pickup/wheelie/hit burst lands squarely on the moped in any lane!
3. **V3 (Signature Per-Zone Skylines + Smooth Crossfade)**:
   - Smoothly interpolate sky & hill colors over ~40m when crossing zone boundaries!
   - Give each of the 5 zones its own distinct East Bay skyline layer:
     - `oakland-hills`: rolling hills + redwood silhouettes + hills radio tower
     - `lake-merritt`: sparkling lakeside water strip + iconic glowing Necklace of Lights bulbs!
     - `telegraph-ave`: Fox Theater marquee + glowing neon storefronts
     - `bay-bridge`: iconic Bay Bridge suspension towers, sweeping cables & bridge lights!
     - `west-oakland`: Port of Oakland orange cranes + stacked shipping containers!
4. **V4 (Hazard Telegraphing, AC Transit Bus, Lane-Change Blinkers, Grade Tilt & Depth)**:
   - Scale lane entities `0.92 / 1.0 / 1.08` by `lanePos` for 2.5D depth.
   - Draw crisp yellow `▲ WHEELIE` ground chevrons ahead of wheelie-able hazards (`pothole`, `traffic-cone`, `oil-slick`).
   - Draw a pulsing red right-edge lane warning indicator when a car/bus is approaching fast in your lane (`relX` ~1.4s away).
   - Render the **AC Transit Bus** (white/green East Bay stripes, `"51A OAKLAND"` destination board!), car brake lights & night headlights, blinking amber turn signals on lane-changing cars, and subtle road/horizon grade indicator + hill tilt on Oakland Hills climbs & West Oakland descents!
5. **V7 + V8**: Use resolved `--font-bangers` / `--font-russo-one` canvas fonts and PCA Gold helmet with black stripe (matching `ride-renderer.ts`!).

---

### Lane H2 (Hydrogen, Wave 2) — All React Views & Garage Interactive UX

1. **B1 (`simulator-root.tsx`, `runner-view.tsx`)**:
   - Hide top phase tabs and Reset button while `runnerPlaying` is true (matching `isRiding`).
   - On `runner-view.tsx` unmount while a run is active, call `finishActiveRun("aborted")` so runs can NEVER be discarded or used to dodge a seize!
2. **B2 + B3 + B4 + B7 + B10 + V2 + V10 + A2 (`runner-view.tsx`)**:
   - Delete `sfxCtxRef` and `playArcadeTone`; route all arcade SFX through `synthRef.current?.playArcade(...)`!
   - Initialize mute with `useState(() => loadSimMutedPreference())`.
   - Call `renderer.spawnBurstAtPlayer(state, color, count)` instead of hardcoded screen Y!
   - Let the ~1.25s `dying` death beat finish naturally before calling `finishActiveRun()` (so crash/seize audio & wipeout animation play in full!).
   - Replace the road-blocking center Seize modal with an urgent **top-band bar + pulsing red screen-edge vignette** (`pointer-events-none` vignette, clickable `[Q]` button in top band) so lanes stay visible while steering!
   - Pause on `Esc` only (keep `Q` clutch & `R` kick identical to Tuning Rides) + show a clean 3-second fading key-legend overlay at run start!
   - Display `engineTopSpeedMph` in Results (plus Turbo peak note if higher), add **Grade chip** (`+6% CLIMB` / `HEADWIND` / `-3% DOWNHILL`), add **Tachometer readout/arc** in Runner HUD when `hasTach` is owned, and add subtle **"ON THE PIPE"** gold/cyan edge glow!
   - Support holding `Space` for hold-to-wheelie (`wheelieHeld`)!
3. **G2 + G3 + G4 + B5 + B12 + V9 + A7 (`garage-view.tsx`, `moped-workbench.tsx`, `simulator-root.tsx`, `route-map.tsx`)**:
   - **G2**: Replace `"Needs Wrenching"` / `"Dialed & Ready"` answer-key chips with road-tested verdict chips:
     - `"untested"` → `UNTESTED — TAKE A RIDE` (zinc/amber)
     - `"ran-clean"` → `RAN CLEAN` (emerald)
     - `"acting-up"` → `ACTING UP` (orange/red)
   - **G3 ("FIRE IT UP — STAND TEST")**: Add a dedicated interactive **Stand Test** strip in `garage-view.tsx` (`Fire It Up` toggle, `Kick [R]`, `Choke`, hold-to-blip `Blip Throttle`, live `PulseSynth` audio + gated Tach/CHT readouts) that drives live engine vibration & observable smoke puffs directly on `moped-workbench.tsx`!
   - **G4**: Add a compact 4-step dismissible **Garage Work Order** onboarding card at top of `garage-view.tsx` computed purely from save state (1. Ride Telegraph Coffee Run, 2. Inspect with a tool, 3. Tune or swap a part, 4. Earn First Fix or clear route).
   - **B5 + V9 (`moped-workbench.tsx`)**: Move Derbi `fuel-filter` pin to `(41%, 54%)` so it never overlaps `carburetor` `(44%, 62%)`; route the SVG fuel line accurately per make (from rear tank on Hobbit/Derbi, from diagonal tank on Maxi/Tomos); add idle vibration & animated exhaust smoke puffs when `standTest?.engineRunning`!
   - **A7**: Play `PulseSynth.playGarage(...)` foley on part installs, jet swaps, diagnostic tool readings (plug pull, carb spray, spark snap, compression kick), and switch flips!
   - **B12**: Filter `recentJournal` to active bike by default with an `Active Bike / All Fleet` toggle and bike color tags!
4. **B6 + B8 + B11 (`ride-view.tsx`)**:
   - Move seize pre-warning badge to top-right below coffee card so it NEVER overlaps centered stacked captions.
   - Add `"kill-switch"` roadside stall headline (`"ENGINE KILLED — NOT WIDE OPEN FOR PLUG CHOP"`).
   - Gate the numeric `Carb Fuel Bowl` bar so it only appears when `hasStethoscope` is owned (or show `"CARB BOWL: CHECK FLOW IN GARAGE"` otherwise) — no free diagnostic giveaway!
5. **G7 (`route-map.tsx`, `simulator-root.tsx`)**:
   - Render earned **Route Medals** (`Cleared`, `Speed`, `Cool Head`, `Hot Coffee`) on each route card in `route-map.tsx` and highlight newly earned medals in `RideSummaryModal`!
