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
 * = more bent); head pitch + = chin down; lean/offsets + = toward the
 * direction the player faces;
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
  "load.head_pitch": w("Head position", ["tilted back", "Level your head, eyes on the rim"], ["tilted down", "Lift your chin, eyes on the rim"]),
  "load.knee_depth": w("Knee bend", ["too deep", "Bend your knees a little less"], ["too shallow", "Bend your knees more"]),
  "load.hip_over_knee": w("Hips over knees", ["too far back", "Sit back a little less"], ["too far forward", "Sit back more"]),
  "load.knee_over_ankle": w("Knees over feet", ["too far back", "Let your knees come forward"], ["too far forward", "Keep your knees over your feet"]),
  "load.ball_drop": w("Ball dip", ["too low", "Don't dip the ball so low"], ["not low enough", "Dip the ball lower"]),
  "load.elbow_angle": w("Elbow at the dip", ["too bent", "Relax your arm at the dip"], ["too straight", "Keep a bend in the elbow at the dip"]),
  "load.elbow_change": w("Elbow loading", ["folds too much", "Fold the elbow less in the dip"], ["doesn't load", "Load the elbow in the dip"]),
  "load.ball_close": w("Ball distance from body", ["too close", "Give the ball a little room"], ["too far", "Keep the ball closer"]),
  "load.t_drop_start": w("Ball vs hips going down", ["ball starts down before your hips", "Start the dip with your hips"], ["ball starts down after your hips", "Start the ball down with your hips"]),
  "load.t_drop_end": w("Ball vs hips at the bottom", ["ball bottoms out before your hips", "Keep the ball moving down with your hips"], ["ball bottoms out after your hips", "Get the ball down with your hips"]),
  "load.t_elbow_bend": w("Elbow bend timing", ["too early", "Bend the elbow a little later"], ["too late", "Bend the elbow sooner"]),
  // ---- Rise ----------------------------------------------------------------
  "rise.t_start": w("Ball vs legs starting up", ["ball starts up before your legs", "Start the rise with your legs"], ["ball starts up late", "Bring the ball up with your legs"]),
  "rise.t_ball_vs_knee_bottom": w("Ball up vs knee bend", ["ball rises while knees still bend", "Finish your knee bend before lifting the ball"], ["ball waits after the knees bottom out", "Start the ball up as your knees bottom out"]),
  "rise.t_end": w("Set point vs legs", ["ball reaches set point too early", "Let your legs carry the ball up"], ["ball reaches set point too late", "Reach set point as your legs straighten"]),
  "rise.elbow_change_1": w("Elbow, early rise", ["folds", "Keep the elbow steady as you start up"], ["opens too early", "Keep the elbow loaded as you start up"]),
  "rise.elbow_change_2": w("Elbow, late rise", ["folds", "Don't pull the ball back at the top"], ["opens too early", "Hold the elbow until set point"]),
  "rise.wrist_hinge_change_1": w("Wrist cock, early rise", ["too much", "Less wrist cock early"], ["not enough", "Cock the wrist as you start up"]),
  "rise.wrist_hinge_change_2": w("Wrist cock, late rise", ["too much", "Less wrist cock at the top"], ["uncocks early", "Keep the wrist cocked to set point"]),
  "rise.spine_change": w("Torso as you rise", ["tips back", "Stay over the ball as you rise"], ["tips forward", "Rise straight up"]),
  "rise.t_spine_vs_knees": w("Torso vs legs timing", ["torso finishes before your legs", "Rise with your legs"], ["torso finishes after your legs", "Get tall as your legs finish"]),
  "rise.head_pitch_change": w("Head as you rise", ["tips back", "Keep your head level as you rise"], ["drops", "Keep your chin up as you rise"]),
  // ---- Set point -----------------------------------------------------------
  "setPoint.wrist_vs_head": w("Set point height", ["too low", "Raise your set point"], ["too high", "Lower your set point"]),
  "setPoint.elbow_angle": w("Elbow at set point", ["too bent", "Open the elbow a little at set point"], ["too straight", "Bend the elbow more at set point"]),
  "setPoint.spine_angle": w("Torso at set point", ["leaning back", "Don't lean back at set point"], ["leaning forward", "Stand tall at set point"]),
  "setPoint.knee_angle": w("Knees at set point", ["still bent", "Straighten your legs by set point"], ["legs locked too early", "Keep a little knee bend at set point"]),
  "setPoint.hip_angle": w("Hips at set point", ["bent at the hips", "Stand taller at set point"], ["hips pushed through", "Relax the hips at set point"]),
  "setPoint.hip_over_knee": w("Hips over knees at set point", ["too far back", "Bring your hips under you"], ["too far forward", "Keep your hips over your knees"]),
  "setPoint.knee_over_ankle": w("Knees over feet at set point", ["too far back", "Let your knees come forward"], ["too far forward", "Keep your knees over your feet"]),
  "setPoint.head_pitch": w("Head at set point", ["tilted back", "Level your head, eyes on the rim"], ["tilted down", "Lift your chin, eyes on the rim"]),
  // ---- Release -------------------------------------------------------------
  "release.elbow_path": w("Elbow path", ["drifts back", "Push the elbow up and through"], ["pushes out too far", "Drive the elbow straight up"]),
  "release.wrist_vs_head_end": w("Release height", ["too low", "Release higher"], ["too high", "Release a little lower"]),
  "release.guide_hand_dx": w("Guide hand (front/back)", ["too far back", "Keep the guide hand on the side of the ball"], ["too far forward", "Keep the guide hand off the shot"]),
  "release.guide_hand_dy": w("Guide hand (height)", ["too low", "Keep the guide hand up"], ["too high", "Lower the guide hand"]),
  "release.knee_change": w("Leg drive at release", ["legs bend during release", "Finish your leg drive"], ["legs still straightening", "Straighten your legs before you release"]),
  "release.spine_change": w("Torso at release", ["leaning back", "Don't fall back"], ["leaning forward", "Stay tall through the release"]),
  "release.wrist_snap": w("Wrist snap", ["not enough snap", "Snap the wrist"], ["too much snap", "Smooth out the wrist snap"]),
  "release.forward_drift": w("Forward drift", ["drifting back", "Don't fade away"], ["drifting forward", "Land where you took off"]),
  "release.t_legs_vs_arm": w("Legs vs arm finishing", ["legs finish too early", "Time your legs with your arm"], ["legs finish after the arm", "Finish your legs before the release"]),
  // ---- Details (not scored) -------------------------------------------------
  "detail.wrist_path_deviation": w("Ball path straightness", ["very straight", "—"], ["ball path curves", "Bring the ball straight up"]),
  "detail.elbow_height_vs_head": w("Elbow height at release", ["below the head", "Lift the elbow"], ["above the head", "—"]),
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
