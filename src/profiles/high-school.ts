/**
 * High school form profile for players ages 13-18.
 *
 * This profile builds on youth fundamentals with more refined expectations.
 * At this level, players should demonstrate:
 * - Consistent elbow alignment with tighter tolerances
 * - Proper ball-to-leg synchronization
 * - More consistent release mechanics
 * - Better body control and posture
 *
 * Timing metrics become more important at this level as players develop
 * rhythm and flow in their shooting motion.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */

import type { FormProfile } from "./types";

/**
 * High school profile for intermediate players (ages 13-18).
 *
 * Tighter acceptable ranges than youth profile, with added emphasis
 * on timing, synchronization, and consistency.
 */
export const highSchoolProfile: FormProfile = {
  name: "high-school",
  description:
    "Intermediate profile for high school players (ages 13-18). More refined mechanics expectations with emphasis on timing, rhythm, and consistency.",
  targets: {
    // ========== Shooting Arm (Refined Mechanics) ==========
    shootingElbowAngle: {
      ideal: 90,
      acceptable: { min: 80, max: 100 },
      priority: "high",
      feedback: {
        tooLow:
          "Elbow angle is too acute at set point. Aim for a 90-degree angle to maximize power transfer.",
        tooHigh:
          "Elbow is too straight at set point. Create more of an L-shape before extending.",
      },
    },
    shootingElbowFlare: {
      ideal: 10,
      acceptable: { min: 0, max: 25 },
      priority: "high",
      feedback: {
        tooLow:
          "Elbow is tucked too tight to the body. Allow some natural separation for comfort.",
        tooHigh:
          "Elbow is flaring out excessively. Keep it more aligned under the ball for accuracy.",
      },
    },
    followThroughHold: {
      ideal: 75,
      acceptable: { min: 50, max: 100 },
      priority: "high",
      feedback: {
        tooLow:
          "Follow-through is too short. Hold your finish position to ensure complete release.",
      },
    },
    maxArmExtension: {
      ideal: 165,
      acceptable: { min: 145, max: 180 },
      priority: "medium",
      feedback: {
        tooLow:
          "Not reaching full extension on release. Extend your arm completely toward the basket.",
      },
    },
    wristSnapAngle: {
      ideal: 60,
      acceptable: { min: 45, max: 75 },
      priority: "medium",
      feedback: {
        tooLow:
          "Wrist snap is insufficient. Focus on snapping your wrist down at release for better rotation.",
        tooHigh:
          "Wrist is over-flexing. Moderate the snap to maintain control and consistency.",
      },
    },

    // ========== Ball Position (Precision) ==========
    setPointHeight: {
      ideal: 0.15,
      acceptable: { min: 0, max: 0.3 },
      priority: "high",
      feedback: {
        tooLow:
          "Set point is too low. Bring the ball up to forehead level or higher for a cleaner release window.",
        tooHigh:
          "Set point is very high. This can work but may affect your timing.",
      },
    },
    releaseAngle: {
      ideal: 52,
      acceptable: { min: 42, max: 62 },
      priority: "high",
      feedback: {
        tooLow:
          "Release angle is too flat. Add more arc to improve your chances of the ball going in.",
        tooHigh:
          "Release angle is too steep. Slightly lower arc will give you better distance control.",
      },
    },
    ballDip: {
      ideal: 0.08,
      acceptable: { min: 0, max: 0.25 },
      priority: "medium",
      feedback: {
        tooHigh:
          "Excessive ball dip is slowing your shot. Minimize downward motion before rising to set point.",
      },
    },
    ballPath: {
      ideal: 0.1,
      acceptable: { min: 0, max: 0.3 },
      priority: "medium",
      feedback: {
        tooHigh:
          "Ball path to set point has too much lateral movement. Work on a straighter, more direct path.",
      },
    },

    // ========== Guide Hand (Proper Technique) ==========
    guideHandPosition: {
      ideal: "side",
      acceptable: ["side", "thumb-up"],
      priority: "medium",
      feedback: {
        incorrect:
          "Guide hand should be positioned on the side of the ball, not underneath or pushing forward.",
      },
    },
    guideHandRelease: {
      ideal: 50,
      acceptable: { min: 40, max: 65 },
      priority: "medium",
      feedback: {
        tooLow:
          "Guide hand is releasing too early. Keep it on the ball until closer to release point.",
        tooHigh:
          "Guide hand is staying on too long, potentially interfering with the shot. Release it earlier.",
      },
    },
    guideElbowFlare: {
      ideal: 30,
      acceptable: { min: 15, max: 50 },
      priority: "low",
      feedback: {
        tooLow:
          "Guide arm elbow is too tight. Let it open naturally for better ball support.",
        tooHigh:
          "Guide arm is flared too wide. Bring it in slightly for better control.",
      },
    },

    // ========== Lower Body (Power Foundation) ==========
    kneeFlexion: {
      ideal: 50,
      acceptable: { min: 35, max: 70 },
      priority: "medium",
      feedback: {
        tooLow:
          "Not enough knee bend in your shot. Load your legs more for better power.",
        tooHigh:
          "Very deep knee bend. This can slow your shot - find a balance between power and quickness.",
      },
    },
    hipDrop: {
      ideal: 0.1,
      acceptable: { min: 0.05, max: 0.2 },
      priority: "low",
      feedback: {
        tooLow:
          "Minimal hip loading. Slight hip drop helps generate upward power.",
        tooHigh:
          "Excessive hip drop is slowing your shot. Reduce the squat depth slightly.",
      },
    },
    legExtensionStart: {
      ideal: 35,
      acceptable: { min: 25, max: 50 },
      priority: "medium",
      feedback: {
        tooLow:
          "Legs are extending too early before the ball rises. Time your leg drive with your shot.",
        tooHigh:
          "Legs are extending late in the shot. Start your leg drive earlier for better power transfer.",
      },
    },

    // ========== Posture & Alignment (Body Control) ==========
    backPosture: {
      ideal: 5,
      acceptable: { min: 0, max: 15 },
      priority: "medium",
      feedback: {
        tooHigh:
          "Leaning forward too much. Stay more upright to maintain balance through your shot.",
      },
    },
    shoulderAlignment: {
      ideal: 0,
      acceptable: { min: -10, max: 10 },
      priority: "medium",
      feedback: {
        tooLow:
          "Shoulders are rotated away from target. Square up to the basket for better accuracy.",
        tooHigh:
          "Shoulders are over-rotated toward target. Neutral alignment is more consistent.",
      },
    },
    handCupVsHinge: {
      ideal: "cup",
      acceptable: ["cup", "neutral"],
      priority: "medium",
      feedback: {
        incorrect:
          "Work on cupping the ball in your shooting hand rather than hinging at the wrist.",
      },
    },

    // ========== Timing & Synchronization (Rhythm) ==========
    ballLegSync: {
      ideal: 5,
      acceptable: { min: -10, max: 15 },
      priority: "high",
      feedback: {
        tooLow:
          "Ball is rising before your legs extend. Start your leg drive earlier for better synchronization.",
        tooHigh:
          "Legs are extending well before the ball rises. Delay your leg drive slightly.",
      },
    },
    ballRiseStart: {
      ideal: 30,
      acceptable: { min: 20, max: 45 },
      priority: "medium",
      feedback: {
        tooLow:
          "Ball is rising too early in your shot motion. Let your legs load first.",
        tooHigh:
          "Ball rise is delayed too long. Start bringing the ball up earlier in your motion.",
      },
    },
    releaseStart: {
      ideal: 70,
      acceptable: { min: 60, max: 85 },
      priority: "medium",
      feedback: {
        tooLow:
          "Release is starting early in your motion. Build more rhythm before releasing.",
        tooHigh:
          "Release is delayed. Quicken your release timing slightly.",
      },
    },
  },
};
