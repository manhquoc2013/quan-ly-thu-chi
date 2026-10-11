# Product Management: Stories & Acceptance Checks

## User Story 1 (REQ-1)
As a user browsing the financial dashboard,
I want the mascot to move around without shooting grappling hook cords across my data screens,
so that the interface stays clean and unobtrusive.
- **Acceptance:** No grappling hook SVG elements or rope shooting animations appear on screen during locomotion.

## User Story 2 (REQ-2)
As a user watching the mascot climb to a higher card or element,
I want Mèo Nấm to pull out a folding ladder from its backpack, climb up step-by-step, and pack the ladder back,
so that the climbing motion looks lively, cute, and logical.
- **Acceptance:** When moving upward to a latchable platform, a folding ladder extends from bottom to target ledge, Mèo Nấm climbs with synchronized limb animations, and the ladder packs away upon reaching the top.

## User Story 3 (REQ-3)
As a user watching the mascot descend from a platform,
I want Mèo Nấm to climb down the ladder for small drops (< 250px) or deploy a colorful parachute for high descents (>= 250px) and tosses,
so that descents feel physically varied and delightful.
- **Acceptance:** Drops < 250px use the folding ladder downwards; drops >= 250px or airborne fling/toss deploy the parachute with soft floating descent.

## User Story 4 (REQ-4)
As a user interacting with the mascot,
I want the character animation to feel smooth and bouncy with responsive ears, tail inertia, and landing squash & stretch,
so that the mascot feels alive rather than stiff.
- **Acceptance:** Smooth cubic-bezier transitions, reactive tail wiggling, ear bobbing, and squash/stretch on landings and ladder climbing.

## User Story 5 (REQ-5)
As a user who wants to focus on work without distractions,
I want an easily accessible toggle in Settings and a Quick Hide button in the mascot control deck,
so that I can enable or disable the mascot at any time with persistent state.
- **Acceptance:** Settings tab Mascot has a toggle switch for Mascot ON/OFF; LucyControlDeck has a quick hide option; changes persist across reloads.
