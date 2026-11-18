/**
 * Default plain-language wording for the v3 metrics. The targets builder
 * copies these into live-targets-v3.json, where they can be hand-edited (edits
 * survive rebuilds).
 *
 * For each metric:
 *  - `label`  — what is measured, in player terms ("Knee bend");
 *  - `low` / `high` — when the value is BELOW / ABOVE the target band:
 *      `phrase` — what happened, for the scorecard ("too shallow");
 *      `cue`    — what to do, for the voice ("Bend your knees more").
 *
 * Sign conventions (from ./metrics): angles in degrees (joint angles: smaller
 * = more bent); lean/offsets + = toward the direction the player faces;
 * heights + = higher; timing = (event B − event A) ÷ phase, + = B later.
 */

export interface DirectionWording {
  readonly phrase: string;
  readonly cue: string;
}
export interface MetricWording {
  readonly label: string;
  readonly low: DirectionWording;
  readonly high: DirectionWording;
}

const w = (
  label: string,
  low: [string, string],
  high: [string, string],
): MetricWording => ({
  label,
  low: { phrase: low[0], cue: low[1] },
  high: { phrase: high[0], cue: high[1] },
});

export const DEFAULT_WORDING: Readonly<Record<string, MetricWording>> = {
  // ---- Load ----------------------------------------------------------------
  "load.spine_angle": w("Torso lean", ["too upright", "Lean forward a little more"], ["leaning too far forward", "Stay more upright"]),
  "load.head_vs_spine": w("Head position", ["head tilted back", "Bring your head forward, eyes on the rim"], ["head dropped forward", "Lift your head, eyes on the rim"]),
  "load.knee_depth": w("Knee bend", ["too deep", "Bend your knees a little less"], ["too shallow", "Bend your knees more"]),
  "load.hip_over_knee": w("Hips over knees", ["hips too far back", "Sit back a little less"], ["hips too far forward", "Sit back more"]),
  "load.knee_over_ankle": w("Knees over feet", ["knees too far back", "Let your knees come forward"], ["knees too far forward", "Keep your knees over your feet"]),
  "load.ball_drop": w("Ball dip", ["ball dropped too low", "Don't dip the ball so low"], ["ball not dipped enough", "Dip the ball lower"]),
  "load.elbow_angle": w("Elbow at the dip", ["elbow too bent", "Relax your arm at the dip"], ["arm too straight", "Keep a bend in the elbow at the dip"]),
  "load.elbow_change": w("Elbow loading", ["elbow folds too much", "Fold the elbow less in the dip"], ["elbow doesn't load", "Load the elbow in the dip"]),
  "load.ball_close": w("Ball distance from body", ["ball too close to the body", "Give the ball a little room"], ["ball too far from the body", "Keep the ball closer"]),
  "load.t_drop_start": w("Ball vs hips going down", ["ball starts down before your hips", "Start the dip with your hips"], ["ball starts down after your hips", "Start the ball down with your hips"]),
  "load.t_drop_end": w("Ball vs hips at the bottom", ["ball bottoms out before your hips", "Keep the ball moving down with your hips"], ["ball bottoms out after your hips", "Get the ball down with your hips"]),
  "load.t_elbow_bend": w("Elbow bend timing", ["elbow bends too early", "Bend the elbow a little later"], ["elbow bends too late", "Bend the elbow sooner"]),
  // ---- Rise ----------------------------------------------------------------
  "rise.t_start": w("Ball vs legs starting up", ["ball starts up before your legs", "Start the rise with your legs"], ["ball starts up late", "Bring the ball up with your legs"]),
  "rise.t_end": w("Set point vs legs", ["ball reaches set point too early", "Let your legs carry the ball up"], ["ball reaches set point too late", "Reach set point as your legs straighten"]),
  "rise.elbow_change_1": w("Elbow, early rise", ["elbow folds early in the rise", "Keep the elbow steady as you start up"], ["elbow opens early in the rise", "Keep the elbow loaded as you start up"]),
  "rise.elbow_change_2": w("Elbow, late rise", ["elbow folds near the top", "Don't pull the ball back at the top"], ["elbow opens before set point", "Hold the elbow until set point"]),
  "rise.wrist_hinge_change_1": w("Wrist cock, early rise", ["wrist cocks too much", "Less wrist cock early"], ["wrist doesn't cock", "Cock the wrist as you start up"]),
  "rise.wrist_hinge_change_2": w("Wrist cock, late rise", ["wrist cocks too much late", "Less wrist cock at the top"], ["wrist uncocks early", "Keep the wrist cocked to set point"]),
  "rise.spine_change": w("Torso as you rise", ["torso tips back", "Stay over the ball as you rise"], ["torso tips forward", "Rise straight up"]),
  "rise.t_spine_vs_knees": w("Torso vs legs timing", ["torso finishes before your legs", "Rise with your legs"], ["torso finishes after your legs", "Get tall as your legs finish"]),
  "rise.head_vs_spine_change": w("Head as you rise", ["head drops back", "Keep your head steady"], ["head drops forward", "Keep your head steady"]),
  // ---- Set point -----------------------------------------------------------
  "setPoint.wrist_vs_head": w("Set point height", ["set point too low", "Raise your set point"], ["set point too high", "Lower your set point"]),
  "setPoint.elbow_angle": w("Elbow at set point", ["elbow too bent", "Open the elbow a little at set point"], ["elbow too straight", "Bend the elbow more at set point"]),
  "setPoint.spine_angle": w("Torso at set point", ["leaning back", "Don't lean back at set point"], ["leaning forward", "Stand tall at set point"]),
  "setPoint.knee_angle": w("Knees at set point", ["knees still bent", "Straighten your legs by set point"], ["legs locked too early", "Keep a little knee bend at set point"]),
  "setPoint.hip_angle": w("Hips at set point", ["bent at the hips", "Stand taller at set point"], ["hips pushed through", "Relax the hips at set point"]),
  "setPoint.hip_over_knee": w("Hips over knees at set point", ["hips too far back", "Bring your hips under you"], ["hips too far forward", "Keep your hips over your knees"]),
  "setPoint.knee_over_ankle": w("Knees over feet at set point", ["knees too far back", "Let your knees come forward"], ["knees too far forward", "Keep your knees over your feet"]),
  "setPoint.head_vs_spine": w("Head at set point", ["head tilted back", "Level your head"], ["head dropped forward", "Lift your head, eyes on the rim"]),
  // ---- Release -------------------------------------------------------------
  "release.elbow_path": w("Elbow path", ["elbow drifts back", "Push the elbow up and through"], ["elbow pushes out too far", "Drive the elbow straight up"]),
  "release.wrist_vs_head_end": w("Release height", ["release too low", "Release higher"], ["release too high", "Release a little lower"]),
  "release.guide_hand_dx": w("Guide hand (front/back)", ["guide hand too far back", "Keep the guide hand on the side of the ball"], ["guide hand too far forward", "Keep the guide hand off the shot"]),
  "release.guide_hand_dy": w("Guide hand (height)", ["guide hand too low", "Keep the guide hand up"], ["guide hand too high", "Lower the guide hand"]),
  "release.knee_change": w("Leg drive at release", ["legs bend during release", "Finish your leg drive"], ["legs still straightening", "Straighten your legs before you release"]),
  "release.spine_change": w("Torso at release", ["leaning back", "Don't fall back"], ["leaning forward", "Stay tall through the release"]),
  "release.wrist_snap": w("Wrist snap", ["not enough snap", "Snap the wrist"], ["too much snap", "Smooth out the wrist snap"]),
  "release.forward_drift": w("Forward drift", ["drifting back", "Don't fade away"], ["drifting forward", "Land where you took off"]),
  "release.t_legs_vs_arm": w("Legs vs arm finishing", ["legs finish too early", "Time your legs with your arm"], ["legs finish after the arm", "Finish your legs before the release"]),
  // ---- Details (not scored) -------------------------------------------------
  "detail.wrist_path_deviation": w("Ball path straightness", ["very straight", "—"], ["ball path curves", "Bring the ball straight up"]),
  "detail.elbow_height_vs_head": w("Elbow height at release", ["elbow below the head", "Lift the elbow"], ["elbow above the head", "—"]),
  "detail.release_vs_takeoff": w("Release vs take-off", ["release before take-off", "—"], ["release long after take-off", "Release on the way up"]),
  "detail.follow_through_elbow_max": w("Follow-through extension", ["arm doesn't fully extend", "Finish with a straight arm"], ["arm locks out", "—"]),
};

/** Fallback for an id without wording (keeps the pipeline from breaking). */
export function wordingFor(id: string): MetricWording {
  return (
    DEFAULT_WORDING[id] ??
    w(id.split(".")[1]?.replace(/_/g, " ") ?? id, ["too low", "—"], ["too high", "—"])
  );
}
