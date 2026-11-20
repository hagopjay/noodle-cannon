# Choose the concept

All five are playable in `dist/noodle-cannon.html` and share the same engine, noodle, cannon and trick judge. Picking one decides where the next month of work goes; the others can survive as side modes.

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

## D · Noodle Siege: *rivalry* (v0.2)

**Loop:** turn-based artillery. Each side has a fort with three crowned kings on crate columns, a cannon on a rock, and a hill between them. Wind changes every turn. Each side has limited special ammo. Knock all three enemy kings off their thrones.

- **Physics fun:** reading wind and arcs, collapsing forts, Munchausen rides into the enemy keep, bomb rocket-jumps over the hill.
- **Why people come back:** beating the CPU (it forecasts its own shots with a drag-and-wind model and gets them about 7 % wrong) or a friend on the same screen; wins and losses are tracked.
- **Risks:** turn-based play is slower; online multiplayer is a big build.
- **Grow it into:** online play (deterministic lockstep is possible because the simulation is deterministic), fort building before the battle, more ammo, campaign forts.

## E · Toy Box: *creative sandbox* (v0.2)

**Loop:** no goal. Drop toys, fire any ammo, watch the chaos, toggle slow motion.

- **Physics fun:** the most. Contraptions such as a pendulum into TNT into a sky crate.
- **Why people come back:** expression and sharing. It needs a share or replay feature to keep people.
- **Risks:** little reason to come back without goals. It works best as the editor or practice mode inside another concept.

## Built (v0.3): C with A's hazards and the ammo as clubs

Flop Golf now picks up the Launch Party toys as hole hazards (TNT stacks, small towers, trampolines, fans, balloons, sky crates, plus the existing bumpers, walls and windmills). Crates settle before play and damage persists between strokes on a hole. The ammo are the clubs: **Noodle** is the iron (unlimited); **Rocket** (driver) is available from hole 1; **Bomb** (wedge, for bunkers) joins on hole 2; **Sticky** and **Munchausen** join on hole 3. Each club is one per hole and counts as one stroke. At par + 6 the hole is picked up, so nobody gets stranded. **Flag grab (v0.4):** a Sticky hand that touches the flagstick grabs it (Flag Grab, +250); let go and you drop toward the hole. **Siege factorializer (v0.4):** the nth enemy king felled in one turn scores 500 × n! (500, 1000, 3000), shown in the HUD as n! = ×N; own goals don't count. Not built yet: the Toy Box as a hole editor, online Siege.

## My suggestion

**Still C (Flop Golf) as the spine, now with the ammo as "clubs" (sticky to grab the flag, rocket for a long drive, bomb to escape a bunker) and the toys as hole hazards. Siege as the multiplayer mode and the Toy Box as the hole editor.** If you would rather have the most fun in the first 30 seconds, pick A. If you want something to play with friends, pick D.

## Choices that apply whatever you pick

1. **2D canvas or 2.5D three.js/X3D?** The prototype is 2D to keep it fast and portable. The engine is 2D either way; a three.js view, like the gamelab bridge, could come later.
2. **Daily seed + local records only, or a shared leaderboard?** Determinism already makes replay verification possible.
3. **Phone first?** Touch controls work but have not been tested on a real phone.
