# What carried over from x3d.gamelab

I read `src/game.js` (hero, cannon, ragdoll, stunt scoring), `src/core.js` (XPBD solver), `src/showtime.js` (the Giggleworks trick judge), `NOTES.md` and CHASM's `ARCADE.md`. These are the principles this game kept, and what it changed.

## Kept

1. **The cannon is the best toy in the lab.** Its loop is: aim with a visible arc, fire, and hand control to physics. That one launch gives anticipation, a loss of control that is a release rather than a punishment, and a different result every time. Noodle Cannon makes it the whole game instead of Hall 6.
2. **Going limp is the fun.** In the gamelab the hero turns into a jointed ragdoll; the joy is in the tumble, not in precise control. Here the noodle is limp from the moment it leaves the barrel.
3. **A little control in the air.** Showtime's three directional puffs and the A/D spin are what turn watching into playing. Both are kept, and one is added: **tuck**. Pulling the limbs in lowers the moment of inertia, so the same angular momentum spins about 3.6× faster (`test/sim.test.mjs` checks for at least 2×). This is the diver's trick, and it gives players a physics skill they already understand.
4. **Variety beats repetition.** Showtime raises the multiplier with *trick families*, not with repeats of one trick, and each trick pays once per chain. The judge keeps this rule: 10 families (air, spin, bonk, smash, boing, puff, target, skim, distance, tuck), multiplier `1 + floor(families / 2)`, capped at ×5.
5. **Funny names are part of the reward.** "Bonk Cinematic Universe", "Insurance Nightmare", "Air Traffic Control Is Concerned". This is the same voice as Giggleworks' captions.
6. **Determinism and gates.** Fixed step, seeded layouts, no `Math.random` and no clock in the simulation, and a world hash checked by tests. The same daily seed gives the same field for everyone, which keeps a shared leaderboard possible later.
7. **Measured juice.** Screen shake, hit-stop on big hits, confetti and slow motion are added in the view, which honours reduced-motion, and never in the simulation (as in CHASM's focus time).

## Changed

| gamelab | Noodle Cannon | Why |
|---|---|---|
| Rigid-body XPBD with hinges, a platformer hero and many systems | Particle/stick (Verlet) bodies, crates as 4-particle quads, no platforming | Ragdolls and crates are cheap and stable this way, and the scope stays on launching |
| Cannon in one hall of a museum | Cannon is the core verb in all three concepts | It was the most fun part |
| Score shown, meaning left to explore | Each concept has a clear goal (beat your 5-shot total, chain cannons, par) | It gives players a reason to come back |
| Large X3D source model, editor and AI curator | None yet | Find the fun first. The engine keeps the data layout simple enough to export to X3D later |

## New physics findings (this build)

- **PBD bleeds angular momentum when a muscle shortens.** A position correction along the radius also shortens the stored "velocity chord", so a tuck *slowed* the spin (3.6 → 2.9 rad/s). The fix applies the change in free flight only: measure L before the step and re-inject `ΔL / I` after it (`Noodle.keepMomentum`).
- **Sleeping stacks need wake propagation.** Knocking out the middle of a sleeping tower left the top floating. Any crate that moves more than 1 cm in a tick now wakes the sleepers it touches, recursively.
- **Friction must include the gravity support term.** Without `mu * g * dt` in the normal impulse, resting contacts had no friction and a noodle slid 88 m. With it, the slide is 34 m.
- **Golf needed rules for the cannon's position, not only for physics:** it must never park over the hole, it must be able to fire backwards after an overshoot, and a body draped over the cup with its centre of mass over the hole counts as sunk.
