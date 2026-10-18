# Venus 0.4.1

This patch fixes abnormal acceleration of shared nodes traveling between systems. Exterior cruise is driven by actual path distance and real delta time at 6 world units per second, rather than a fixed curve parameter or a radius-scaled step. Short entry and docking handoffs preserve smooth transitions.

During cross-system transfer, shared groups may pass through other bodies. Obstacle detours, residual collision offsets and collision-pair corrections are bypassed only for those moving groups. Ordinary resident orbit speeds, body clearance and parent spacing remain in place. Node identities, relations and source data are unchanged.

The source deployment package retains the eleven English synthetic demo screenshots and all 0.4.0 features. No new screenshots, private data, history, logs, credentials or private Git branches are included. The patch does not claim to eliminate all stutter or improve every dense-scene workload.

Install with `npm ci` and `npm run build`. Start with `VENUS_ANALYSIS=0` for a first local-only session; choose analysis providers and budgets deliberately. See README.md for installation, token costs, privacy and the existing license status.
