/**
 * Youth fundamentals form profile for players ages 8-12.
 *
 * This profile focuses on foundational mechanics with wider acceptable ranges
 * appropriate for developing players. The emphasis is on:
 * - Basic elbow alignment (not tucked in or flared out)
 * - Consistent follow-through
 * - Reasonable set point height
 * - Basic rhythm and timing
 *
 * Advanced metrics like precise wrist snap angles or tight timing synchronization
 * are de-emphasized or excluded as they are less meaningful for youth development.
 *
 * @see Feature 6.0 - Form Profile Comparison
 */
/**
 * Youth fundamentals profile for developing players (ages 8-12).
 *
 * Wider acceptable ranges focus on building correct habits without
 * over-correcting natural variations in young players' form.
 */
export const youthFundamentalsProfile = {
    name: "youth-fundamentals",
    description: "Fundamentals-focused profile for developing players (ages 8-12). Emphasizes basic mechanics with wider acceptable ranges to encourage good habits without over-correction.",
    targets: {
        // ========== Shooting Arm (Core Fundamentals) ==========
        shootingElbowAngle: {
            ideal: 90,
            acceptable: { min: 70, max: 110 },
            priority: "high",
            feedback: {
                tooLow: "Try to bend your elbow a bit more at the set point. Think of making an 'L' shape with your arm.",
                tooHigh: "Your elbow is very straight. Bend it a little more before you shoot.",
            },
        },
        shootingElbowFlare: {
            ideal: 15,
            acceptable: { min: 0, max: 40 },
            priority: "medium",
            feedback: {
                tooLow: "Your elbow is tucked in very close. It's okay to let it come out a little.",
                tooHigh: "Your elbow is sticking out to the side. Try to bring it in a bit closer to your body.",
            },
        },
        followThroughHold: {
            ideal: 70,
            acceptable: { min: 40, max: 100 },
            priority: "high",
            feedback: {
                tooLow: "Hold your follow-through longer! Keep your arm up like you're reaching into a cookie jar on a high shelf.",
            },
        },
        maxArmExtension: {
            ideal: 160,
            acceptable: { min: 130, max: 180 },
            priority: "medium",
            feedback: {
                tooLow: "Reach up higher when you release the ball. Stretch your arm up to the sky!",
            },
        },
        // ========== Ball Position (Fundamentals) ==========
        setPointHeight: {
            ideal: 0.15,
            acceptable: { min: -0.1, max: 0.4 },
            priority: "high",
            feedback: {
                tooLow: "Bring the ball up higher before you shoot. Start with it near your forehead or above.",
                tooHigh: "The ball is starting very high. That's okay, but make sure you're comfortable.",
            },
        },
        releaseAngle: {
            ideal: 52,
            acceptable: { min: 35, max: 70 },
            priority: "medium",
            feedback: {
                tooLow: "Your shot is a bit flat. Try to arc the ball more - think 'rainbow shot'!",
                tooHigh: "You're shooting very high. A little less arc might help your accuracy.",
            },
        },
        ballDip: {
            ideal: 0.1,
            acceptable: { min: 0, max: 0.4 },
            priority: "low",
            feedback: {
                tooHigh: "You're dipping the ball down a lot before shooting. Try to bring it up more directly.",
            },
        },
        // ========== Guide Hand (Basics) ==========
        guideHandPosition: {
            ideal: "side",
            acceptable: ["side", "under", "thumb-up"],
            priority: "medium",
            feedback: {
                incorrect: "Keep your helper hand on the side of the ball. It guides the ball but doesn't push it.",
            },
        },
        guideHandRelease: {
            ideal: 50,
            acceptable: { min: 30, max: 80 },
            priority: "low",
            feedback: {
                tooLow: "Your guide hand is coming off the ball very early. Keep it there a bit longer.",
                tooHigh: "Your guide hand is staying on the ball too long. Let it come off as you release.",
            },
        },
        // ========== Lower Body (Foundation) ==========
        kneeFlexion: {
            ideal: 45,
            acceptable: { min: 20, max: 80 },
            priority: "medium",
            feedback: {
                tooLow: "Bend your knees more before you shoot. Get low to get power!",
                tooHigh: "You're bending your knees a lot! That's okay, just make sure you can jump up comfortably.",
            },
        },
        // ========== Posture (Basics) ==========
        backPosture: {
            ideal: 8,
            acceptable: { min: 0, max: 25 },
            priority: "low",
            feedback: {
                tooHigh: "Try to stand a bit taller. Lean forward just a little, not too much.",
            },
        },
        handCupVsHinge: {
            ideal: "cup",
            acceptable: ["cup", "neutral", "hinge"],
            priority: "low",
            feedback: {
                incorrect: "Try cupping the ball in your hand like you're holding a bowl of soup.",
            },
        },
    },
};
//# sourceMappingURL=youth.js.map