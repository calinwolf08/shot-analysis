/**
 * Generates features/benchmarks/data/elite-placeholder-v1.json from the
 * library's pro-form profile (numeric targets + feedback) merged with
 * player-facing copy (displayName / shortCue / explanation) authored here.
 *
 * PLACEHOLDER: numbers derive from the library's pro-form heuristics, not
 * measured elite shooters. populationStats stays null until real data
 * lands (see design doc §Content Needed).
 *
 * Run from app/: npx tsx scripts/generate-placeholder-benchmark.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proFormProfile } from "basketball-shot-analysis";

interface Copy {
  displayName: string;
  shortCue: string; // imperative, ≤ 4 words
  category:
    | "shooting-arm"
    | "guide-arm"
    | "ball"
    | "lower-body"
    | "posture"
    | "timing";
  explanation: string;
}

/** LLM-drafted copy — flagged for coach review in the Content Needed table. */
const COPY: Record<string, Copy> = {
  shootingElbowFlare: {
    displayName: "Elbow alignment",
    shortCue: "Tuck your elbow",
    category: "shooting-arm",
    explanation:
      "How far your shooting elbow drifts out from your body. A tucked elbow keeps the ball on a straight line to the rim.",
  },
  shootingElbowAngle: {
    displayName: "Elbow bend",
    shortCue: "Make an L",
    category: "shooting-arm",
    explanation:
      "The bend of your shooting arm at the set point. A right-angle L stores energy and releases it straight up through the ball.",
  },
  maxArmExtension: {
    displayName: "Arm extension",
    shortCue: "Reach for rim",
    category: "shooting-arm",
    explanation:
      "How fully your arm extends on the release. Full extension adds arc and consistent power.",
  },
  wristSnapAngle: {
    displayName: "Wrist snap",
    shortCue: "Snap your wrist",
    category: "shooting-arm",
    explanation:
      "How much your wrist flexes through the release. A full snap puts backspin on the ball for a soft bounce.",
  },
  followThroughHold: {
    displayName: "Follow-through hold",
    shortCue: "Hold your follow-through",
    category: "shooting-arm",
    explanation:
      "How long you keep your arm up after release. Holding it keeps the release smooth instead of jerky.",
  },
  guideElbowFlare: {
    displayName: "Guide elbow",
    shortCue: "Relax guide elbow",
    category: "guide-arm",
    explanation:
      "How far your off-hand elbow sticks out. A relaxed guide elbow keeps the guide hand from steering the ball.",
  },
  guideHandPosition: {
    displayName: "Guide hand position",
    shortCue: "Guide hand beside",
    category: "guide-arm",
    explanation:
      "Where your off-hand sits on the ball. On the side, it supports without pushing.",
  },
  guideHandRelease: {
    displayName: "Guide hand release",
    shortCue: "Let go early",
    category: "guide-arm",
    explanation:
      "When your guide hand leaves the ball. Leaving early means only your shooting hand aims the shot.",
  },
  ballDip: {
    displayName: "Ball dip",
    shortCue: "Smooth small dip",
    category: "ball",
    explanation:
      "How far the ball drops before rising. A small, smooth dip builds rhythm without wasting time.",
  },
  ballPath: {
    displayName: "Ball path",
    shortCue: "Lift it straight",
    category: "ball",
    explanation:
      "How straight the ball travels from catch to set point. A straight lift is repeatable and quick.",
  },
  setPointHeight: {
    displayName: "Set point height",
    shortCue: "Set it high",
    category: "ball",
    explanation:
      "How high you set the ball before release. A high set point is harder to block and simplifies the release.",
  },
  setPointDuration: {
    displayName: "Set point pause",
    shortCue: "No hitch",
    category: "ball",
    explanation:
      "How long the ball pauses at the set point. One fluid motion beats a hitch that saps power and timing.",
  },
  releaseAngle: {
    displayName: "Release angle",
    shortCue: "Shoot up, not out",
    category: "ball",
    explanation:
      "The angle of your arm as the ball leaves. Releasing upward gives the shot arc so it can drop softly through.",
  },
  ballBehindHead: {
    displayName: "Ball behind head",
    shortCue: "Keep ball forward",
    category: "ball",
    explanation:
      "How far the ball drifts behind your head at the set point. Keeping it forward keeps the motion compact.",
  },
  handCupVsHinge: {
    displayName: "Shooting hand set",
    shortCue: "Wrist loaded back",
    category: "posture",
    explanation:
      "Whether your shooting wrist is loaded back under the ball. A hinged wrist is a spring ready to snap.",
  },
  hipDrop: {
    displayName: "Hip drop",
    shortCue: "Sit into it",
    category: "lower-body",
    explanation:
      "How much your hips lower in the dip. Loading your hips powers the shot from the ground up.",
  },
  kneeFlexion: {
    displayName: "Knee bend",
    shortCue: "Bend your knees",
    category: "lower-body",
    explanation:
      "How deep your knees bend before rising. The right bend generates effortless range.",
  },
  legExtensionStart: {
    displayName: "Leg drive timing",
    shortCue: "Legs start first",
    category: "lower-body",
    explanation:
      "When your legs begin extending in the shot. Legs firing first sends energy up the kinetic chain.",
  },
  backPosture: {
    displayName: "Back posture",
    shortCue: "Stay tall",
    category: "posture",
    explanation:
      "How upright your spine stays through the shot. Staying tall keeps your shot line consistent.",
  },
  headTilt: {
    displayName: "Head position",
    shortCue: "Eyes on rim",
    category: "posture",
    explanation:
      "How steady and level your head is. A still head means steady eyes and better aim.",
  },
  shoulderAlignment: {
    displayName: "Shoulder alignment",
    shortCue: "Square your shoulders",
    category: "posture",
    explanation:
      "How square your shoulders are to the rim. Square shoulders point everything at the target.",
  },
  ballRiseStart: {
    displayName: "Ball rise timing",
    shortCue: "Rise on time",
    category: "timing",
    explanation:
      "When the ball starts moving upward in the shot. Consistent timing makes the whole motion repeatable.",
  },
  legRiseStart: {
    displayName: "Leg rise timing",
    shortCue: "Drive legs early",
    category: "timing",
    explanation:
      "When your legs begin to rise. Early leg drive leads the shot instead of chasing it.",
  },
  ballLegSync: {
    displayName: "Ball-leg sync",
    shortCue: "Sync ball and legs",
    category: "timing",
    explanation:
      "How your ball lift and leg drive line up. Synced timing turns leg power into easy range.",
  },
  releaseStart: {
    displayName: "Release timing",
    shortCue: "Release going up",
    category: "timing",
    explanation:
      "When the release begins within the shot. Releasing on the way up uses your momentum.",
  },
  totalShotDuration: {
    displayName: "Shot speed",
    shortCue: "Quick and smooth",
    category: "timing",
    explanation:
      "How long the whole shot takes. A compact shot gets off before defenders can react.",
  },
};

function main(): void {
  const targets: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const [name, target] of Object.entries(proFormProfile.targets)) {
    const copy = COPY[name];
    if (!copy) {
      missing.push(name);
      continue;
    }
    targets[name] = {
      ideal: target.ideal,
      acceptable: target.acceptable,
      priority: target.priority,
      populationStats: null,
      feedback: target.feedback,
      ...copy,
    };
  }
  if (missing.length > 0) {
    throw new Error(`No copy authored for metrics: ${missing.join(", ")}`);
  }

  const profile = {
    id: "elite-placeholder-v1",
    name: "Elite Shooter (sample data)",
    version: 1,
    isPlaceholder: true,
    basedOn:
      "Derived from the basketball-shot-analysis library's pro-form profile heuristics. NOT measured elite-shooter data.",
    targets,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(
    here,
    "..",
    "src",
    "lib",
    "features",
    "benchmarks",
    "data",
    "elite-placeholder-v1.json",
  );
  writeFileSync(out, JSON.stringify(profile, null, 2) + "\n");
  console.log(
    `Wrote ${Object.keys(targets).length} targets → ${out.split("/app/")[1]}`,
  );
}

main();
