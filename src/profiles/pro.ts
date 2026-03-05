/**
 * Pro-form profile for elite/professional players.
 *
 * This profile represents elite-level mechanics with tight tolerances
 * across all metrics. At this level, players should demonstrate:
 * - Precise elbow alignment with minimal variation
 * - Perfect ball-to-leg synchronization
 * - Consistent release mechanics and timing
 * - Optimal body alignment and posture
 * - Elite-level efficiency in all aspects of the shot
 *
 * This profile is also appropriate for advanced college players
 * and serious competitive players aiming for professional standards.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

import type { FormProfile } from "./types";

/**
 * Pro-form profile for elite/professional players.
 *
 * Tight acceptable ranges across all metrics reflect the precision
 * and consistency expected at the highest levels of basketball.
 */
export const proFormProfile: FormProfile = {
  name: "pro-form",
  description:
    "Elite profile for professional and advanced college players. Tight tolerances on all metrics emphasizing precision, consistency, and optimal biomechanics.",
  targets: {
    // ========== Shooting Arm (Elite Precision) ==========
    shootingElbowAngle: {
      ideal: 90,
      acceptable: { min: 85, max: 95 },
      priority: "high",
      feedback: {
        tooLow:
          "Elbow angle is below optimal range. A tighter 90° angle maximizes force transfer through the shot line.",
        tooHigh:
          "Elbow is too extended at set point. Optimal L-shape position creates better backspin and consistency.",
      },
    },
    shootingElbowFlare: {
      ideal: 8,
      acceptable: { min: 0, max: 18 },
      priority: "high",
      feedback: {
        tooLow:
          "Elbow is over-tucked. While alignment is good, slight natural flare improves comfort and repeatability.",
        tooHigh:
          "Excessive elbow flare reduces shot accuracy. Align elbow under the ball for a straighter shot line.",
      },
    },
    followThroughHold: {
      ideal: 80,
      acceptable: { min: 60, max: 100 },
      priority: "high",
      feedback: {
        tooLow:
          "Abbreviated follow-through indicates incomplete release. Full extension and hold ensures consistent ball flight.",
      },
    },
    maxArmExtension: {
      ideal: 170,
      acceptable: { min: 155, max: 180 },
      priority: "high",
      feedback: {
        tooLow:
          "Incomplete arm extension limits release height and angle. Full extension optimizes release point.",
      },
    },
    wristSnapAngle: {
      ideal: 65,
      acceptable: { min: 55, max: 75 },
      priority: "high",
      feedback: {
        tooLow:
          "Insufficient wrist flexion reduces backspin and soft touch. Increase wrist snap for better rotation.",
        tooHigh:
          "Over-flexion can cause inconsistent release. Moderate snap maintains control while generating spin.",
      },
    },

    // ========== Ball Position (Optimal Mechanics) ==========
    setPointHeight: {
      ideal: 0.12,
      acceptable: { min: 0.05, max: 0.22 },
      priority: "high",
      feedback: {
        tooLow:
          "Set point is too low, reducing release height and creating longer ball path to target. Elevate set point.",
        tooHigh:
          "Very high set point may affect rhythm and timing. Find optimal height for your mechanics.",
      },
    },
    releaseAngle: {
      ideal: 52,
      acceptable: { min: 45, max: 58 },
      priority: "high",
      feedback: {
        tooLow:
          "Release angle is flat. Increase arc to optimize entry angle into the basket.",
        tooHigh:
          "Release angle is too steep. Reduce arc slightly for better distance consistency.",
      },
    },
    ballDip: {
      ideal: 0.05,
      acceptable: { min: 0, max: 0.15 },
      priority: "medium",
      feedback: {
        tooHigh:
          "Ball dip is slowing shot tempo. Minimize pre-shot movement for quicker, more fluid release.",
      },
    },
    ballPath: {
      ideal: 0.05,
      acceptable: { min: 0, max: 0.15 },
      priority: "medium",
      feedback: {
        tooHigh:
          "Lateral ball path deviation affects consistency. Straighter path to set point improves repeatability.",
      },
    },
    setPointDuration: {
      ideal: 100,
      acceptable: { min: 50, max: 180 },
      priority: "medium",
      feedback: {
        tooLow:
          "Brief set point may indicate rushing. Slight pause at set point improves rhythm without slowing shot.",
        tooHigh:
          "Extended pause at set point slows release. Quicken transition to release phase.",
      },
    },
    ballBehindHead: {
      ideal: 0.02,
      acceptable: { min: -0.05, max: 0.1 },
      priority: "low",
      feedback: {
        tooLow:
          "Ball is positioned too far forward. Slight behind-head position creates better shooting angle.",
        tooHigh:
          "Ball is drifting too far behind head. This can affect release timing and control.",
      },
    },

    // ========== Guide Hand (Perfect Technique) ==========
    guideHandPosition: {
      ideal: "side",
      acceptable: ["side"],
      priority: "high",
      feedback: {
        incorrect:
          "Guide hand must be positioned on the side of the ball at elite level. Under or thumb-up positions introduce inconsistency.",
      },
    },
    guideHandRelease: {
      ideal: 50,
      acceptable: { min: 45, max: 58 },
      priority: "high",
      feedback: {
        tooLow:
          "Guide hand releasing early may cause loss of control. Maintain contact until optimal release point.",
        tooHigh:
          "Late guide hand release can interfere with shot path. Separate hands precisely at release.",
      },
    },
    guideElbowFlare: {
      ideal: 35,
      acceptable: { min: 25, max: 45 },
      priority: "medium",
      feedback: {
        tooLow:
          "Guide arm too tight restricts natural ball support. Allow moderate separation.",
        tooHigh:
          "Excessive guide arm flare can pull shot off-line. Maintain controlled position.",
      },
    },

    // ========== Lower Body (Power Optimization) ==========
    kneeFlexion: {
      ideal: 45,
      acceptable: { min: 35, max: 55 },
      priority: "medium",
      feedback: {
        tooLow:
          "Insufficient knee flexion limits power generation. Increase load for better leg drive.",
        tooHigh:
          "Deep knee bend slows shot release. Optimal flexion balances power and quickness.",
      },
    },
    hipDrop: {
      ideal: 0.1,
      acceptable: { min: 0.05, max: 0.15 },
      priority: "medium",
      feedback: {
        tooLow:
          "Minimal hip engagement reduces power transfer. Engage hips in the load phase.",
        tooHigh:
          "Excessive hip drop slows overall motion. Optimize load depth for speed and power.",
      },
    },
    legExtensionStart: {
      ideal: 35,
      acceptable: { min: 28, max: 42 },
      priority: "high",
      feedback: {
        tooLow:
          "Premature leg extension disrupts ball-leg synchronization. Delay leg drive slightly.",
        tooHigh:
          "Late leg extension causes disconnected motion. Start leg drive earlier for fluid power transfer.",
      },
    },

    // ========== Posture & Alignment (Perfect Form) ==========
    backPosture: {
      ideal: 3,
      acceptable: { min: 0, max: 8 },
      priority: "high",
      feedback: {
        tooHigh:
          "Forward lean exceeds optimal range. Maintain near-vertical spine for consistent balance.",
      },
    },
    headTilt: {
      ideal: 0,
      acceptable: { min: -5, max: 5 },
      priority: "medium",
      feedback: {
        tooLow:
          "Head tilting away from target affects aim. Keep head level and eyes on target.",
        tooHigh:
          "Excessive head tilt toward target can affect body alignment. Maintain neutral head position.",
      },
    },
    shoulderAlignment: {
      ideal: 0,
      acceptable: { min: -5, max: 5 },
      priority: "high",
      feedback: {
        tooLow:
          "Shoulder rotation away from target reduces accuracy. Square shoulders to basket.",
        tooHigh:
          "Over-rotation creates inconsistency. Maintain neutral shoulder alignment.",
      },
    },
    handCupVsHinge: {
      ideal: "cup",
      acceptable: ["cup"],
      priority: "high",
      feedback: {
        incorrect:
          "Elite shooting requires consistent cup position for optimal ball control and release. Hinge position introduces variability.",
      },
    },

    // ========== Timing & Synchronization (Elite Rhythm) ==========
    ballLegSync: {
      ideal: 3,
      acceptable: { min: -5, max: 10 },
      priority: "high",
      feedback: {
        tooLow:
          "Ball rising before leg extension indicates disconnected upper/lower body. Synchronize leg drive with ball lift.",
        tooHigh:
          "Leg extension preceding ball rise wastes power. Time ball lift with leg drive initiation.",
      },
    },
    ballRiseStart: {
      ideal: 32,
      acceptable: { min: 25, max: 40 },
      priority: "high",
      feedback: {
        tooLow:
          "Premature ball rise disrupts loading phase. Allow full lower body load before ball lift.",
        tooHigh:
          "Delayed ball rise extends shot time. Initiate ball lift earlier for quicker release.",
      },
    },
    legRiseStart: {
      ideal: 30,
      acceptable: { min: 22, max: 38 },
      priority: "medium",
      feedback: {
        tooLow:
          "Early leg extension before ball rises creates timing mismatch. Coordinate with ball movement.",
        tooHigh:
          "Late leg drive results in arm-dominant shot. Initiate leg extension earlier.",
      },
    },
    releaseStart: {
      ideal: 72,
      acceptable: { min: 65, max: 80 },
      priority: "high",
      feedback: {
        tooLow:
          "Early release point indicates rushed shot. Build full rhythm before release.",
        tooHigh:
          "Late release extends shot time and reduces effectiveness off the catch. Quicken release timing.",
      },
    },
    totalShotDuration: {
      ideal: 550,
      acceptable: { min: 400, max: 700 },
      priority: "medium",
      feedback: {
        tooLow:
          "Very fast release may sacrifice consistency. Ensure full mechanics within quick release.",
        tooHigh:
          "Extended shot duration creates defensive opportunities. Work on quickening overall motion.",
      },
    },
  },
};
