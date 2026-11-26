/**
 * Every debug tool, for the /__debug index. A unit test checks this list
 * against the route folders so a new tool can't be left off.
 */
export const DEBUG_ROUTES: readonly {
  readonly path: string;
  readonly title: string;
  readonly about: string;
}[] = [
  {
    path: "/__debug/replay",
    title: "Replay scoring",
    about:
      "Load a poses.json and run it through the live analysis + keyframe scoring core (scorecard + voice readback).",
  },
  {
    path: "/__debug/scorecard",
    title: "Scorecard preview",
    about: "Render the deviation scorecard component with sample data.",
  },
  {
    path: "/__debug/analyze",
    title: "Replay analysis (E2E)",
    about: "Run the replay analysis backend on a fixture (test builds only).",
  },
  {
    path: "/__debug/drills",
    title: "Drill catalog (E2E)",
    about: "List the drill catalog (test builds only).",
  },
];
