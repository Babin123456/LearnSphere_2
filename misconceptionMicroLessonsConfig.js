// misconceptionMicroLessonsConfig.js
// Micro-lessons mapping for misconception tags used in review_mistakes drill-down.
//
// Format:
//  window.misconceptionMicroLessonsConfig = {
//    "tag": {
//      title: "...",
//      summary: "...",
//      steps: ["step 1", "step 2", ...]
//    }
//  }

window.misconceptionMicroLessonsConfig = {
  // General fallback buckets
  "unknown-misconception": {
    title: "Review the concept",
    summary: "Your answer wasn’t what the question expected—rebuild the core idea and try again.",
    steps: [
      "Read the question carefully and identify what is being asked.",
      "Recall the definition/formula involved.",
      "Check each option against that definition (eliminate mismatches).",
    ],
  },

  // Example misconception tags (extend as quiz banks are enriched)
  "sign error": {
    title: "Sign error",
    summary: "You likely used the wrong sign (+/−). Focus on direction and reference frames.",
    steps: [
      "Write the reference direction (positive/negative) clearly.",
      "Substitute values carefully and keep track of negatives.",
      "Sanity-check the result by reasoning about direction (does it make sense?).",
    ],
  },

  "units error": {
    title: "Units error",
    summary: "You mixed up units. Make sure every quantity is in the correct unit before using a formula.",
    steps: [
      "List the units of each given quantity.",
      "Convert to the required unit system (e.g., SI units) first.",
      "Recompute and verify that the final unit is consistent.",
    ],
  },

  "confusing speed with acceleration": {
    title: "Speed vs acceleration",
    summary: "Speed describes how fast something is; acceleration describes how velocity changes (speed and/or direction).",
    steps: [
      "Identify whether the question is about velocity change over time.",
      "If velocity changes (speed and/or direction), acceleration is non-zero.",
      "If velocity stays constant, acceleration is zero.",
    ],
  },

  "constant velocity still implies acceleration": {
    title: "Constant velocity ⇒ zero acceleration",
    summary: "Acceleration is the rate of change of velocity. Constant velocity means no change, so acceleration is zero.",
    steps: [
      "Recall: a(t) = d(v)/dt.",
      "If v is constant, then d(v)/dt = 0.",
      "Re-check options: anything that suggests change should be rejected.",
    ],
  },
};

