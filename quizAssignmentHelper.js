/**
 * quizAssignmentHelper.js
 * Automatically intercepts quiz completion for all 12 quizzes in LearnSphere.
 * - Handles assignment submission if ?assignment=<id> is in the URL.
 * - Automatically records practice attempts for non-motion/non-nlm quizzes.
 * - Triggers achievement unlocks and toast notifications.
 */
(function () {
    'use strict';

    const START_TIME = Date.now();

    function getStudentName() {
        try {
            const user = JSON.parse(localStorage.getItem("user"));
            return user && user.fullname ? user.fullname : "Guest Learner";
        } catch (e) {
            return "Guest Learner";
        }
    }

    function getStudentEmail() {
        try {
            const user = JSON.parse(localStorage.getItem("user"));
            return user && user.email ? user.email : "guest@learnsphere.com";
        } catch (e) {
            return "guest@learnsphere.com";
        }
    }

    function getTopicIdFromPath() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes("motion")) return "physics-motion";
        if (path.includes("nlm")) return "physics-nlm";
        if (path.includes("projectile")) return "physics-projectile";
        if (path.includes("ray")) return "physics-ray";
        if (path.includes("calculus")) return "maths-calculus";
        if (path.includes("geometry")) return "maths-geometry";
        if (path.includes("probability")) return "maths-probability";
        if (path.includes("vector")) return "maths-vectors";
        if (path.includes("atomic")) return "chemistry-atomic";
        if (path.includes("bonding")) return "chemistry-bonding";
        if (path.includes("equilibrium")) return "chemistry-equil";
        if (path.includes("thermo")) return "chemistry-thermo";
        return null;
    }

    function recordSubmission(assignmentId, score, totalQuestions) {
        try {
            const submissions = JSON.parse(localStorage.getItem("learnsphere_assignment_submissions")) || [];
            const studentEmail = getStudentEmail();
            const existingIdx = submissions.findIndex(s => s.assignmentId === assignmentId && s.studentEmail === studentEmail);
            
            const newSubmission = {
                assignmentId: assignmentId,
                studentName: getStudentName(),
                studentEmail: studentEmail,
                score: score,
                totalQuestions: totalQuestions,
                timestamp: new Date().toISOString()
            };

            if (existingIdx !== -1) {
                submissions[existingIdx] = newSubmission;
            } else {
                submissions.push(newSubmission);
            }

            localStorage.setItem("learnsphere_assignment_submissions", JSON.stringify(submissions));
            console.log("LearnSphere: Assignment submission recorded successfully", newSubmission);
        } catch (e) {
            console.warn("LearnSphere: Failed to record assignment submission", e);
        }
    }

    function handleQuizCompletion(scoreVal, totalQsVal) {
        const urlParams = new URLSearchParams(window.location.search);
        const assignmentId = urlParams.get('assignment');

        const topicId = getTopicIdFromPath();
        const timeTakenMs = Date.now() - START_TIME;

        // 1. Record practice attempt if this quiz doesn't do it itself (motion and nlm quizzes do it themselves)
        if (topicId && topicId !== "physics-motion" && topicId !== "physics-nlm") {
            if (window.quizProgress && typeof window.quizProgress.recordAttempt === 'function') {
                const quizSubId = topicId.split("-")[1];
                window.quizProgress.recordAttempt({
                    topicId: topicId,
                    score: scoreVal,
                    totalQuestions: totalQsVal,
                    correctCount: scoreVal,
                    timeTakenMs: timeTakenMs,
                    quizId: "quiz:" + quizSubId
                });
                console.log(`LearnSphere: Practice attempt logged for topic: ${topicId}`);
            }
        }

        // 2. Record assignment submission if in assignment mode
        if (assignmentId) {
            recordSubmission(assignmentId, scoreVal, totalQsVal);
        }

        // 3. Trigger achievements check and show toast alerts for any newly unlocked badges
        setTimeout(() => {
            if (window.achievements && typeof window.achievements.checkAndNotify === 'function') {
                window.achievements.checkAndNotify();
            }
        }, 300);
    }

    function wrapShowResults(originalShowResults) {
        return function () {
            // Call original function first
            if (typeof originalShowResults === 'function') {
                originalShowResults.apply(this, arguments);
            }

            setTimeout(() => {
                let finalScore = null;
                let totalQs = null;

                // 1. Try to read from DOM (#score)
                const scoreEl = document.getElementById("score");
                if (scoreEl) {
                    const text = scoreEl.textContent;
                    const match = text.match(/scored\s+(\d+)\s+out of\s+(\d+)/i);
                    if (match) {
                        finalScore = parseInt(match[1], 10);
                        totalQs = parseInt(match[2], 10);
                    }
                }

                // 2. Fallback to global variables
                if (finalScore === null || isNaN(finalScore)) {
                    if (typeof window.score === 'number') {
                        finalScore = window.score;
                    } else if (typeof score === 'number') {
                        finalScore = score;
                    }
                }
                if (totalQs === null || isNaN(totalQs)) {
                    if (window.questions && Array.isArray(window.questions)) {
                        totalQs = window.questions.length;
                    } else if (window.adaptiveSteps && Array.isArray(window.adaptiveSteps)) {
                        totalQs = window.adaptiveSteps.length;
                    } else if (typeof questions !== 'undefined' && Array.isArray(questions)) {
                        totalQs = questions.length;
                    } else if (typeof adaptiveSteps !== 'undefined' && Array.isArray(adaptiveSteps)) {
                        totalQs = adaptiveSteps.length;
                    } else {
                        totalQs = 5;
                    }
                }

                if (finalScore !== null && !isNaN(finalScore)) {
                    handleQuizCompletion(finalScore, totalQs);
                } else {
                    console.warn("LearnSphere: Could not determine final score for submission / tracking.");
                }
            }, 100);
        };
    }

    function init() {
        const originalShowResults = window.showResults;
        if (typeof originalShowResults === 'function') {
            window.showResults = wrapShowResults(originalShowResults);
            console.log("LearnSphere: Hooked into global showResults function.");
        } else {
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                checkCount++;
                if (typeof window.showResults === 'function' && window.showResults !== window._wrappedShowResults) {
                    clearInterval(checkInterval);
                    window.showResults = wrapShowResults(window.showResults);
                    window._wrappedShowResults = window.showResults;
                    console.log("LearnSphere: Hooked into dynamically loaded showResults function.");
                }
                if (checkCount > 30) clearInterval(checkInterval); // stop checking after 3s
            }, 100);
        }
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
