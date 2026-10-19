# Network behavior

Current display mode supersedes historical gravity descriptions below. The active
star-map path does not integrate N-body gravity, collision impulses or escape
velocities. Single stars stay anchored; comparable double/triple leaders rotate
as a bounded group around their weighted centre. Planets and local descendants
advance on assigned bounded circles; source neighbourhoods and all semantic edges
remain. Shared-domain nodes orbit a bounded geometric centre of their hosts.
The separate gravity math exports remain only for isolated tests/legacy helpers.
Automatic axial spin remains 400; analysis is unaffected. Native visual acceptance
has not been verified.

Physical playback stays at its existing 2x fixed-step baseline. Automatic axial
spin alone runs 400x the original rate (another 20x over the previous 20x), applied once; floating, orbital motion,
layout convergence and camera controls retain their prior speed. Each node has a
stable independent spin rate and initial phase; orbital periods evolve from its
own masses, radius and perturbations. Multiple stellar systems share the gravity
calculation without sharing a rotation angle, orbital period or reset clock.

Multi-domain nodes are shared orbital bridges. Every assigned star contributes
to their field and common motion, rather than binding them exclusively to the
largest star. Their own descendants remain a coherent subsystem. A bounded planar
distance-variance correction moves both the shared node and its assigned stars
gradually toward comparable link lengths. Star corrections respect inertia and
are averaged across shared members. Collision clearance takes priority when
geometric constraints conflict; approximate equal distance is a display constraint,
not a claim of a purely gravitational equilibrium. No core-to-core edge is added.

Planet ownership is a bounded orbital relationship rather than absorption.
Within a stellar system inverse-square gravity has full strength. Cross-system
tidal differences are reduced to 18%; the host star's common external acceleration
is carried by the whole system, so satellites are not left behind when it moves.
All body pairs, including planet/moon/submoon siblings, use surface clearance of
five times the larger body's diameter. Parent-child orbital clearance uses the
same bound. Near this inner boundary only inward radial motion is
removed, and lost tangential speed is restored gradually toward 95% of circular
speed. These are explicit visual orbit protections, additional to Newtonian
gravity, and do not imply unconstrained energy/momentum conservation. Nested
satellites inherit these protection adjustments without losing local motion.

Domain labels act as stars and their members as orbiting planets.
Each secondary star starts with orbital velocity around the largest primary star
and spins on its own axis; its planets start around that moving secondary.
A member with multiple memberships participates in the shared multi-star field; all membership and
knowledge relationships remain intact. The running galaxy now uses Newtonian
inverse-square mutual gravity, with velocity-Verlet integration. Display volume
supplies mass and G is scaled to scene units. Orbital velocity is seeded once from
sqrt(G*(host mass + orbiting mass)/distance); there is no constant-speed orbit or
per-frame radial servo. Initial planetary radii are limited relative to neighbouring
stars' Hill radii to reduce immediate ejection; this cannot guarantee eternal
multi-body stability. Above 180 bodies a Barnes-Hut mass tree approximates distant
gravity; short-range softening avoids singularities. Spin is independent of
revolution and subtle surface shading makes it visible without changing heat rank.

Every body pair uses center distance >= ri+rj+5*max(2ri,2rj). Stellar systems
add room for their nested orbital envelopes so expanded planetary orbits do not
crowd neighbouring systems. Collider sweeps use expanded bounds to detect this
clearance before physical surfaces touch, and recalculate after size changes.
This is an explicit visual constraint, additional to Newtonian gravity. Separation
and inelastic collision handling do not conserve unconstrained orbital energy.
The primary can react physically to other masses; default camera framing follows
its displacement, keeping it central while preserving manual panning offsets.
Star text is hidden by default, including hover. Clicking a star reveals only its
name and highlights its membership; clicking it again or selecting a planet hides
that name. Ordinary planet text still follows distance and density limits.

All orbital axes share one ecliptic normal, [0,1,0]. Existing vertical spread
settles gradually toward the common plane instead of snapping. Vertical velocity
is damped; coincident-body separation starts in the plane. Space is created by
spreading outward while retaining collision clearance. The camera fits again
after the first simulation step to include the expanded initial arrangement.

Explicit evidenced contains (parent to child), part-of (child to parent), or
dimensions.orbitParent relationships can extend the orbit tree through planets,
satellites and sub-satellites. Ordinary related/step/shared-knowledge links never
imply hierarchy. Cycles and cross-network parent assignments are rejected.
Initialisation runs in parent-before-child order and adds each local orbital
velocity to its parent's world velocity. Host changes propagate position/velocity
changes through all descendants, preserving local motion. Stellar separation also
translates the whole nested system. Subsequent motion is integrated in world space
under mutual gravity; local satellite motion is measured relative to its immediate
parent. Initial stability bounds include non-stellar ancestors as well as stars.

Every node and domain label has a sphere collider matching its displayed radius,
plus a small separation gap. Connection growth and size settings update that
radius. Spring rest distances respect both bodies' volumes. A bounded iterative
sphere solver separates overlaps in proportion to inverse mass and removes inward
collision velocity, without bounce. All labels participate in collisions; none
has infinite mass. The primary participates in gravity and collisions as well.
Collision candidates use sphere-bound sweeps without the large-graph repulsion
sampler's neighbour cap. Glow and screen-space text are not solid geometry.

The graph is the main surface. Processing appears in a compact, initially closed
floating panel inside the canvas. Opening it reveals the active slots; selecting
a slot opens the existing processing dialog. The toolbar contains only the view
title, heat legend, node locator and fit action. Category and file lists use their
parent pane's natural scrolling rather than nested fixed-height scroll boxes.

File progress displays actual saved segment count and the current segment number.
The total follows nextChunk's real newline boundaries for the remaining body,
and is recalculated when chunk size changes. Completion uses the actual final
number of saved segments, not three fixed workflow phases.

Layout resets regenerate only coordinates and increment a per-network epoch.
The client discards old simulation positions, velocities, center and elapsed time
on an epoch change. Checkpoints from earlier epochs cannot restore the old layout.
Source files, classifications, evidence, relationships and analysis offsets remain.
An explicit all-zero restart seed also places generated domain labels at the
origin and clears initial velocity. Coincident bodies separate through the same
collision and affinity solver; normal refreshes never reset an existing session.
Center-mode reset writes the origin coordinates and new epochs atomically, and
requires checkpoint protocol 2 so a cached older client cannot restore its layout.

Left drag orbits. Middle drag pans the camera and its target together. Wheel
scroll zooms. Selecting a content node makes it the observation center. Floating
selected nodes move the camera only by their own displacement, preserving pan.
Pan and semantic highlighting do not write node coordinates.

Motion uses mass proportional to displayed volume (relative diameter cubed).
The largest domain label determines the primary; ties retain the current primary.
Default framing and View all target this primary, rather than the bounding-box midpoint;
camera distance accounts for the viewport aspect ratio and all visible nodes.
Explicit selection and middle-button panning remain available.
New data and size changes preserve existing positions. Orbital velocities are
initialised only for new nodes or changed hosts. Graphs without domain stars and
non-floating diagnostic runs retain the earlier affinity layout. In the running
galaxy, semantic edges are evidence links and do not add non-gravitational springs.

Main domains apply to all three networks and are discovered from source content.
Each membership stores a short label, reason and exact quote; provenance remains
available through the node's existing source links. Existing material is reviewed
in mixed batches within the same five analysis calls, without a sixth model call.
Unjustified labels are not saved. The processing dialog reports coverage and gaps.
Domain membership links are visible between each domain core and its members.
Domain cores never connect directly to other domain cores; such edges are excluded
from rendering, layout forces and connection counts. Content cross-domain links remain.
They retain the membership reason and exact quote, distinct from factual knowledge
relationships. Clicking one highlights the domain. Lines follow both endpoints.
Domain selection highlights members while retaining cross-domain edges.

Displayed diameter = base diameter × (1 + 0.01 × effective connection count), with
linear addition. Radius follows the same ratio. Repeated relationships with the
same endpoints and type count once; directed step/procedure relationships retain
direction. Visible domain membership links count once at both endpoints; pure
layout forces do not count. The former maximum-radius setting is
retained for compatibility but does not cap this rule. Domain cores use three
times the base diameter before growth. A domain core counts unique member nodes;
its diameter is 3 × base diameter × (1 + 0.01 × unique members). Duplicate imports
or repeated labels do not add members. Core colors use membership counts: white
0–2, green 3–9, blue 10–24, purple 25–49, orange 50–99, gold 100+. These thresholds
are defined independently of ordinary stars' activity heat. The growth parameter
remains adjustable.

Colors describe relationship types and can be changed independently of type
visibility. Thickness describes strength. Types may be introduced with evidence.
Stronger links have smaller target distances and stronger attraction. A network
with many constraints cannot guarantee a strict global ordering of every length.

Knowledge remains separate across sources and uses evidenced relationships for
shared rules. Same-source continuation can reuse its knowledge records. Skills
may integrate multiple knowledge records into a single capability with evidence.
Previously combined knowledge is preserved; no automatic bulk split or deletion.

Skill relations accept exact evidence from peer skill excerpts as well as the
current source. Cross-network edges remain invalid. A separate shared-knowledge
relation records that two skills cite the same current knowledge record, with
matching source hashes and exact quotes. It claims only common foundation, never
equivalence, prerequisite, proficiency or verification. Rebuilds are idempotent.

Metadata-only analysis chunks may return zero tags or derived records; coverage
still advances after a valid result. Upper count limits and exact-quote checks
remain enforced. Failed attempts now retain a bounded history with error, offset,
chunk size and time. Targeted retries keep previously saved segments.

An empty main-domain result from a partial excerpt does not finish review of a
long file. Subsequent 3000-character windows continue within the existing five
calls until an evidenced label is found or the entire body has been reviewed.
Previously negative partial reviews re-enter this process without resetting source
analysis. Short genuinely empty conversations may remain unclassified with reasons.

Manual body edits retain versions and queue only affected source chains for review.
In-flight results from older review tokens are rejected. Automatically generated
text cannot replace manually edited bodies; valid provenance may still be added.

Validation limitation: native window capture was stopped because its browser URL
could not be verified. A separate data-URL layout fixture was also rejected by
browser policy. Neither restriction was bypassed. Pixel dimensions, canvas-area
ratios and visible clipping must be checked through a permitted browser surface.
Unit tests exercise the real OrbitControls input implementation and layout forces;
they do not establish native-window visual acceptance.

Current hierarchy supersedes the earlier multi-star model: only the largest
main label is the star. Other main labels are planets orbiting it; their members
are local satellites. Large-label sizes and semantic memberships remain unchanged.
bodyRoles describes display roles; the internal stellarIndices array still lists
all massive group hosts for grouped gravity, including planets. Planet systems
retain envelope clearance, without the old five-diameter stellar exclusion.
Overview fitting now tracks all rendered node spheres plus glow margins every 250ms, using the narrower horizontal/vertical field of view. It expands outward as needed and refits on resize. Manual navigation or node focus suspends automatic fitting; Fit restores overview. Native visual acceptance remains unverified.
Main-label planets now launch in nine solar-inspired compressed orbital bands (including the historical ninth, Pluto), eight slots per band at 45 degree intervals, with staggered band phases. Further labels extend outward in additional bands. This is a knowledge display arrangement, not nine literal solar planets or an exact astronomical scale. Actual native visibility has not been visually verified.
All three network kinds share the same layout. A second domain with at least ten memberships and >=85% of the leading count forms a binary star; other domains remain eight-per-band planets. Binary surface separation uses 1.12 times the sum of radii, independent of satellite system envelopes. Newtonian mutual motion is retained and overview follows the mass-weighted binary barycentre. Native visual acceptance remains unverified.
Main-label planet orbits now have hard fixed radii and planar circular progress after gravity/collision corrections. Each occupied ring shares angular speed to preserve its eight slots. Host corrections carry local satellites, preserving their relative offsets. These explicit display constraints supersede free radial drift for main-label planets; satellite and binary-star dynamics remain separate.
Local satellites and subsatellites now follow assigned host-relative circular orbits, with ancestor tidal radial variation capped at +/-2 percent. Host correction is propagated parent-first. Angular advance is capped at 0.08 radians per physics step. Shared multi-domain bridge nodes retain their separate multi-host constraint. The bounded response is a visual approximation, not an unconstrained physical simulation.
Planet-ring sizing now reserves four times the full descendant satellite envelope, including visible radii and the maximum 2 percent tidal variation. Thus local satellites/subsatellites remain within 25 percent of their planet-star separation. All members of the same ring receive the same adjusted radius. Tested on Vault, knowledge and skill hierarchies; multi-host semantic bridges are not single-planet satellites.
Satellite placement is now a compact host-relative shell pack: 6, 12, 18... slots per successive shell. Gap is based mostly on satellite size, with a small host-surface allowance, replacing six-per-shell linear radius growth. Fixed local orbits still prevent global forces from detaching satellites. A 60-satellite fixture verifies bounded local placement and surface clearance against its host.
Visual organisation prioritises existing provenance: when a referenced source node is displayed in the same classification group, derived material can orbit that node locally. Explicit containment takes precedence, cycles are rejected, and multi-domain bridges retain their hosts. For sources absent from the current network view, existing siblings are ordered by recorded source IDs, without adding proxy nodes or changing persisted relations. No cross-network source display is added.
Local proximity now also applies to central-star members: removed the old unbounded AU-layer assignment for ordinary nodes. Multi-domain nodes stay near their selected primary visual host; all other semantic memberships/edges remain unchanged, with no multi-centre force or distant circumcentre placement. Unassigned nodes use a bounded central surface-clear fallback without creating a classification. Live-data numerical audit: Vault 350 assigned, knowledge 3209 assigned, skill 707 assigned; zero local bound violations, five unassigned. Existing desktop page version and visual result cannot be confirmed through the restricted UI surfaces.
At user clarification, screenshot-driven adjustments in the immediately preceding pass were reverted: restored prior central-star member bands and bounded shared-domain geometric centres. The stable circular display model and all pre-screenshot authorised work remain. No model configuration changed during this rollback.
Latest overrides: automatic axial spin is disabled (SPIN_SPEED_MULTIPLIER=0); orbital motion and camera controls remain. Main-centre visual volume is capped at 10 times an ordinary zero-degree base sphere of radius settings.baseRadius, so radius/diameter factor cannot exceed cbrt(10). Main centres start at radius factor 1.4 and grow within the cap. Shared nodeRadiusFactor drives both rendering and collision radii. Semantic importance and largest-centre selection still use membership counts. Screenshot-only changes were rolled back; stable pre-screenshot choreography remains.
Latest geometry override: active display orbits no longer use a common ecliptic plane. Stable ID-derived orthonormal frames give each local centre/shell and main planetary ring an independent inclination and azimuth. Binary/triple groups, local descendants, shared-domain circles and unassigned display circles use XYZ offsets. Local bounded radii and parent following remain; axial spin stays zero and centre volume cap stays ten base spheres. Refresh/rebuild reproduces frames for unchanged identities and assignments. Native visual verification is still unavailable.
Current authoritative display rules (supersede older spacing descriptions above): automatic axial spin zero; stable XYZ planes grouped by main owner and actual membership count; centre volume capped at ten ordinary base spheres. The user removed the former two-diameter clearance: sphere surfaces now retain only 0.02 scene units to prevent penetration. Local parent-child orbit targets use one quarter of the uncompressed formula, clamped by individual child subtree geometry, fixed angular slots and bounded 2 percent tides. The largest sibling no longer forces every child onto the same oversized radius. Planet satellite envelopes stay within the full planet-star travel radius; the former 25 percent envelope restriction is removed. Binary packing uses actual pair extents and actual barycentric bounds. Membership combinations do not each allocate another ever-growing shell. Shared nodes retain their identity and membership links; occupancy-checked tours also obey satellite territory boundaries and can wait for a safe route. Up to twelve tours are active. Main-category focus centers the category sphere and a bounded neighborhood, independent of distant member positions. Native visual acceptance and large-window frame rate remain unverified. Neighbor navigation, inline drafts, saved data and backend analysis remain unchanged.
