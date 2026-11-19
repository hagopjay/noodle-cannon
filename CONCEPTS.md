# Choose the concept

All three are playable in `dist/noodle-cannon.html` and share the same engine, noodle, cannon and trick judge. Picking one decides where the next month of work goes; the others can survive as side modes.

## A · Launch Party: *destruction sandbox*

**Loop:** 5 shots per round into one seeded field. The towers you topple, the TNT you set off and the bodies you leave behind all stay, so shot 4 lands in the mess shots 1 to 3 made.

- **Physics fun:** chain reactions (TNT throws crates into more TNT), collapses, bumpers, trampolines, piles of noodles.
- **Why people come back:** a daily field that is the same for everyone, a ghost of your best shot, a 5-shot total to beat.
- **Risks:** it is the closest to existing games (Angry Birds, Happy Wheels). Late shots can turn into "aim at the rubble".
- **Grow it into:** level packs with a target structure (a "condemned building" to knock down), cannon upgrades (cluster shot, sticky suit, glider), a slow-motion replay cam, and sharing a GIF of the best shot.

## B · Barrel Relay: *skill runner*

**Loop:** cannon to cannon over the sea. Fixed, swivelling, swinging, sliding and auto-blast cannons. Two puffs per hop rescue a bad shot. Time slows near a catch.

- **Physics fun:** reading momentum mid-air, last-second puff saves, using tuck to drop faster.
- **Why people come back:** runs of about 30 seconds, "one more go", a best distance, difficulty that rises with the cannon count.
- **Risks:** the least emergent of the three. It is mostly timing, and crates and destruction barely matter. It needs hazards (birds, wind gusts, moving crates) to stay physical.
- **Grow it into:** biomes, coins and cosmetics, mid-air obstacles to bonk for points, and a daily seed race against friends' ghosts.

## C · Flop Golf: *readable puzzle*

**Loop:** 3 holes per round with par. Each shot fires from wherever the noodle stopped. Hills, water (penalty), sand (high friction), windmills and crate walls.

- **Physics fun:** learning how a limp body rolls, bounces and tumbles down slopes, and steering the landing with tuck and puffs. Hole-in-ones feel like miracles.
- **Why people come back:** daily holes, a scorecard, par to beat, and later a natural fit for asynchronous multiplayer ("I took 4 on today's hole 2").
- **Risks:** slower pace, and needs hand-tuned holes on top of the generated ones to be great.
- **Grow it into:** an 18-hole course, a hole editor (the gamelab X3D level pipeline fits here), and same-hole ghosts from friends.

## My suggestion

**C (Flop Golf), with A's destruction kit as hazards.** It has the clearest reason to return (par, daily holes, comparing scorecards). It rewards learning the physics instead of only spectacle, and every gamelab toy (crates, TNT, bumpers, fans, water) becomes a hole hazard. If you would rather have the most fun in the first 30 seconds, pick A.

## Choices that apply whatever you pick

1. **2D canvas or 2.5D three.js/X3D?** The prototype is 2D to keep it fast and portable. The engine is 2D either way; a three.js view, like the gamelab bridge, could come later.
2. **Daily seed + local records only, or a shared leaderboard?** Determinism already makes replay verification possible.
3. **Phone first?** Touch controls work but have not been tested on a real phone.
