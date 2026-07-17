/*
  curriculumMapConfig.js

  Defines the curriculum graph structure (nodes + prerequisite edges).
  Node ids must match progress.js topic ids (e.g., "physics-motion").
*/

(function () {
  const CURRICULUM = {
    version: { major: 1, minor: 0 },

    // Mastery unlock rules.
    // Unlock/completion is based on topic accuracy from quiz analytics.
    masteryUnlock: {
      mode: "topic-accuracy",
      defaultMasteryThresholdPct: 80,
    },

    // Each node represents a topic/module.
    // quizUrl is optional; if provided, node click will navigate there.
    nodes: [
      // --- Physics ---
      { id: "physics-motion", label: "Physics: Motion", subject: "physics", quizUrl: "quiz/motionquiz.html" },
      { id: "physics-nlm", label: "Physics: Newton's Laws", subject: "physics", quizUrl: "quiz/nlmquiz.html" },
      { id: "physics-projectile", label: "Physics: Projectile Motion", subject: "physics", quizUrl: "quiz/projectilequiz.html" },
      { id: "physics-ray", label: "Physics: Ray Optics", subject: "physics", quizUrl: "quiz/rayquiz.html" },

      // --- Maths ---
      { id: "maths-geometry", label: "Maths: Coordinate Geometry", subject: "maths", quizUrl: "mathsquiz/geometryquiz.html" },
      { id: "maths-calculus", label: "Maths: Calculus", subject: "maths", quizUrl: "mathsquiz/calculusquiz.html" },
      { id: "maths-vectors", label: "Maths: Vectors & 3D Geometry", subject: "maths", quizUrl: "mathsquiz/vectorquiz.html" },
      { id: "maths-probability", label: "Maths: Probability & Statistics", subject: "maths", quizUrl: "mathsquiz/probabilityquiz.html" },

      // --- Chemistry ---
      { id: "chemistry-atomic", label: "Chemistry: Atomic Structure", subject: "chemistry", quizUrl: "chemistryquiz/atomic_structurequiz.html" },
      { id: "chemistry-bonding", label: "Chemistry: Chemical Bonding", subject: "chemistry", quizUrl: "chemistryquiz/chemical_bondingquiz.html" },
      { id: "chemistry-equil", label: "Chemistry: Equilibrium", subject: "chemistry", quizUrl: "chemistryquiz/equilibriumquiz.html" },
      { id: "chemistry-thermo", label: "Chemistry: Thermodynamics", subject: "chemistry", quizUrl: "chemistryquiz/thermoquiz.html" },
    ],

    // Directed edges: from prerequisite -> to dependent
    edges: [
      // Physics
      { from: "physics-motion", to: "physics-nlm" },
      { from: "physics-nlm", to: "physics-projectile" },
      { from: "physics-projectile", to: "physics-ray" },

      // Maths
      { from: "maths-geometry", to: "maths-calculus" },
      { from: "maths-geometry", to: "maths-vectors" },
      { from: "maths-calculus", to: "maths-probability" },

      // Chemistry
      { from: "chemistry-atomic", to: "chemistry-bonding" },
      { from: "chemistry-bonding", to: "chemistry-equil" },
      { from: "chemistry-equil", to: "chemistry-thermo" },
    ],
  };

  window.curriculumMapConfig = CURRICULUM;
})();

