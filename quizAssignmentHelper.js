/**
 * quizAssignmentHelper.js
 * Automatically intercepts quiz completion when loaded with an assignment ID in the URL.
 * Saves the score, total questions, and timestamp to localStorage.
 */
(function () {
    'use strict';

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

    function recordSubmission(assignmentId, score, totalQuestions) {
        try {
            const submissions = JSON.parse(localStorage.getItem("learnsphere_assignment_submissions")) || [];
            
            // Check if this student already submitted for this assignment
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
                // Update existing submission (always keep highest/latest score, let's keep the latest for this attempt)
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

    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const assignmentId = urlParams.get('assignment');
        if (!assignmentId) return;

        console.log(`LearnSphere: Assignment mode active for ID: ${assignmentId}`);

        // We wrap showResults on window object
        const originalShowResults = window.showResults;
        if (typeof originalShowResults === 'function') {
            window.showResults = function () {
                // Call original function first
                originalShowResults.apply(this, arguments);

                // Run interception inside a microtask / timeout to let DOM update
                setTimeout(() => {
                    let finalScore = null;
                    let totalQs = null;

                    // 1. Try to read from DOM
                    const scoreEl = document.getElementById("score");
                    if (scoreEl) {
                        const text = scoreEl.textContent;
                        const match = text.match(/scored\s+(\d+)\s+out of\s+(\d+)/i);
                        if (match) {
                            finalScore = parseInt(match[1], 10);
                            totalQs = parseInt(match[2], 10);
                        }
                    }

                    // 2. Fallback to global variables if DOM parsing failed
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
                            totalQs = 5; // Default fallback
                        }
                    }

                    if (finalScore !== null && !isNaN(finalScore)) {
                        recordSubmission(assignmentId, finalScore, totalQs);
                    } else {
                        console.warn("LearnSphere: Could not determine final score for submission.");
                    }
                }, 100);
            };
        } else {
            // Fallback: If showResults is not globally defined at init time, check periodically
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                checkCount++;
                if (typeof window.showResults === 'function' && window.showResults !== window._wrappedShowResults) {
                    clearInterval(checkInterval);
                    const orig = window.showResults;
                    window.showResults = function() {
                        orig.apply(this, arguments);
                        setTimeout(() => {
                            let finalScore = window.score;
                            let totalQs = window.questions ? window.questions.length : 5;
                            const scoreEl = document.getElementById("score");
                            if (scoreEl) {
                                const match = scoreEl.textContent.match(/scored\s+(\d+)\s+out of\s+(\d+)/i);
                                if (match) {
                                    finalScore = parseInt(match[1], 10);
                                    totalQs = parseInt(match[2], 10);
                                }
                            }
                            recordSubmission(assignmentId, finalScore, totalQs);
                        }, 100);
                    };
                    window._wrappedShowResults = window.showResults;
                }
                if (checkCount > 20) clearInterval(checkInterval); // stop after 2s
            }, 100);
        }
    }

    // Initialize when DOM content is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
