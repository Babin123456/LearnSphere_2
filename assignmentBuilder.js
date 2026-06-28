/**
 * assignmentBuilder.js — Teacher Assignment Builder & Submission Analytics
 *
 * Implements form logic, localStorage storage keys, rendering of
 * active assignments, student submissions table, and analytics KPIs.
 */

(function () {
    'use strict';

    const ASSIGNMENTS_KEY = "learnsphere_assignments";
    const SUBMISSIONS_KEY = "learnsphere_assignment_submissions";

    // Helper to get topics from quizProgress
    function getTopics() {
        return window.quizProgress?.QUIZ_TOPICS || [];
    }

    // Helper to load assignments
    function loadAssignments() {
        try {
            return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY)) || [];
        } catch {
            return [];
        }
    }

    // Helper to save assignments
    function saveAssignments(assignments) {
        try {
            localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
        } catch (e) {
            console.error("LearnSphere: Could not save assignments.", e);
        }
    }

    // Helper to load submissions
    function loadSubmissions() {
        try {
            return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY)) || [];
        } catch {
            return [];
        }
    }

    // Populate topics in the form
    function populateTopicCheckboxes() {
        const container = document.getElementById("formTopicsContainer");
        if (!container) return;

        const topics = getTopics();
        container.innerHTML = "";

        if (topics.length === 0) {
            container.innerHTML = "<p class='muted'>No topics available.</p>";
            return;
        }

        topics.forEach(t => {
            const label = document.createElement("label");
            label.className = "checkbox-label";
            label.style.display = "flex";
            label.style.alignItems = "center";
            label.style.gap = "8px";
            label.style.padding = "6px 10px";
            label.style.background = "var(--progress-item-bg)";
            label.style.border = "1px solid var(--border-color)";
            label.style.borderRadius = "8px";
            label.style.cursor = "pointer";
            label.style.transition = "var(--theme-transition)";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "assignmentTopics";
            checkbox.value = t.id;
            checkbox.style.cursor = "pointer";

            const textSpan = document.createElement("span");
            textSpan.textContent = t.label;
            textSpan.style.fontSize = "0.9rem";
            textSpan.style.color = "var(--text-color)";

            label.appendChild(checkbox);
            label.appendChild(textSpan);

            // Hover effect
            label.addEventListener("mouseenter", () => {
                label.style.borderColor = "var(--accent-color)";
                label.style.background = "rgba(56, 189, 248, 0.08)";
            });
            label.addEventListener("mouseleave", () => {
                if (!checkbox.checked) {
                    label.style.borderColor = "var(--border-color)";
                    label.style.background = "var(--progress-item-bg)";
                }
            });

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    label.style.borderColor = "var(--accent-color)";
                    label.style.background = "rgba(56, 189, 248, 0.12)";
                } else {
                    label.style.borderColor = "var(--border-color)";
                    label.style.background = "var(--progress-item-bg)";
                }
            });

            container.appendChild(label);
        });
    }

    // Handle form submission
    function setupFormHandler() {
        const form = document.getElementById("addAssignmentForm");
        if (!form) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();

            // Collect selected topics
            const checkboxes = document.querySelectorAll("input[name='assignmentTopics']:checked");
            const selectedTopicIds = Array.from(checkboxes).map(cb => cb.value);

            if (selectedTopicIds.length === 0) {
                alert("Please select at least one topic.");
                return;
            }

            const dueDate = document.getElementById("dueDate").value;
            const difficulty = document.getElementById("difficulty").value;
            const numQuestions = parseInt(document.getElementById("numQuestions").value, 10);

            if (!dueDate) {
                alert("Please select a due date.");
                return;
            }

            const newAssignment = {
                id: "assignment_" + Date.now(),
                topicIds: selectedTopicIds,
                dueDate: dueDate,
                difficulty: difficulty,
                numQuestions: isNaN(numQuestions) ? 5 : numQuestions,
                createdAt: new Date().toISOString(),
                status: "active"
            };

            const assignments = loadAssignments();
            assignments.push(newAssignment);
            saveAssignments(assignments);

            // Reset form
            form.reset();
            populateTopicCheckboxes();

            // Refresh view
            renderAssignmentsAndSubmissions();
            updateTeacherAnalytics();
        });
    }

    // Render assignments list & submissions
    function renderAssignmentsAndSubmissions() {
        const container = document.getElementById("assignmentsTableBody");
        if (!container) return;

        const assignments = loadAssignments();
        const submissions = loadSubmissions();
        const topics = getTopics();

        container.innerHTML = "";

        if (assignments.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">
                        No assignments published yet. Use the form above to create one.
                    </td>
                </tr>
            `;
            return;
        }

        // Sort assignments by creation date descending
        const sortedAssignments = [...assignments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        sortedAssignments.forEach((asg) => {
            // Find topic labels
            const topicLabels = asg.topicIds.map(id => {
                const found = topics.find(t => t.id === id);
                return found ? found.label : id;
            }).join(", ");

            // Calculate assignment submissions
            const asgSubmissions = submissions.filter(s => s.assignmentId === asg.id);
            const totalSubs = asgSubmissions.length;

            let avgScoreText = "—";
            if (totalSubs > 0) {
                const totalScorePct = asgSubmissions.reduce((sum, curr) => {
                    const pct = curr.totalQuestions > 0 ? (curr.score / curr.totalQuestions) * 100 : 0;
                    return sum + pct;
                }, 0);
                avgScoreText = Math.round(totalScorePct / totalSubs) + "%";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="padding: 12px; font-weight: 600;">${topicLabels}</td>
                <td style="padding: 12px; text-align: center;">${asg.numQuestions}</td>
                <td style="padding: 12px; text-align: center;"><span class="difficulty-badge ${asg.difficulty}">${asg.difficulty.toUpperCase()}</span></td>
                <td style="padding: 12px; text-align: center;">${asg.dueDate}</td>
                <td style="padding: 12px; text-align: center;">
                    <div style="font-weight: 700; color: var(--accent-color);">${totalSubs} submitted</div>
                    <div class="muted" style="font-size: 0.8rem;">Avg: ${avgScoreText}</div>
                </td>
                <td style="padding: 12px; text-align: center;">
                    <button class="view-submissions-btn" data-id="${asg.id}" style="background: var(--btn-secondary-bg); border: 1px solid var(--border-color); color: var(--text-color); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; margin-right: 6px; transition: var(--theme-transition);">Submissions</button>
                    <button class="delete-asg-btn" data-id="${asg.id}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: var(--theme-transition);">Delete</button>
                </td>
            `;

            // Hover micro-animations
            const viewBtn = tr.querySelector(".view-submissions-btn");
            viewBtn.addEventListener("mouseenter", () => {
                viewBtn.style.background = "var(--btn-secondary-hover)";
                viewBtn.style.borderColor = "var(--accent-color)";
            });
            viewBtn.addEventListener("mouseleave", () => {
                viewBtn.style.background = "var(--btn-secondary-bg)";
                viewBtn.style.borderColor = "var(--border-color)";
            });

            const delBtn = tr.querySelector(".delete-asg-btn");
            delBtn.addEventListener("mouseenter", () => {
                delBtn.style.background = "rgba(239, 68, 68, 0.3)";
            });
            delBtn.addEventListener("mouseleave", () => {
                delBtn.style.background = "rgba(239, 68, 68, 0.15)";
            });

            container.appendChild(tr);

            // Create submissions drawer/details row
            const detailsTr = document.createElement("tr");
            detailsTr.id = `details_${asg.id}`;
            detailsTr.style.display = "none";
            detailsTr.style.background = "rgba(0, 0, 0, 0.15)";

            let submissionsHTML = "";
            if (asgSubmissions.length === 0) {
                submissionsHTML = `<p class="muted" style="margin: 0; padding: 10px;">No student submissions yet.</p>`;
            } else {
                submissionsHTML = `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 5px;">
                        <thead>
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left;">
                                <th style="padding: 6px 12px; font-size: 0.85rem; color: var(--text-muted);">Student Name</th>
                                <th style="padding: 6px 12px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">Score</th>
                                <th style="padding: 6px 12px; font-size: 0.85rem; color: var(--text-muted); text-align: center;">Accuracy</th>
                                <th style="padding: 6px 12px; font-size: 0.85rem; color: var(--text-muted); text-align: right;">Date Submitted</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${asgSubmissions.map(sub => {
                                const scorePct = sub.totalQuestions > 0 ? Math.round((sub.score / sub.totalQuestions) * 100) : 0;
                                const dateStr = new Date(sub.timestamp).toLocaleString();
                                return `
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 6px 12px; font-size: 0.9rem; font-weight: 500;">${sub.studentName}</td>
                                        <td style="padding: 6px 12px; font-size: 0.9rem; text-align: center; font-weight: 700; color: var(--accent-color);">${sub.score} / ${sub.totalQuestions}</td>
                                        <td style="padding: 6px 12px; font-size: 0.9rem; text-align: center;">
                                            <span style="padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; background: ${scorePct >= 80 ? 'rgba(16, 185, 129, 0.15); color: #10b981;' : (scorePct >= 50 ? 'rgba(245, 158, 11, 0.15); color: #f59e0b;' : 'rgba(239, 68, 68, 0.15); color: #ef4444;')};">
                                                ${scorePct}%
                                            </span>
                                        </td>
                                        <td style="padding: 6px 12px; font-size: 0.85rem; text-align: right; color: var(--text-muted);">${dateStr}</td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                `;
            }

            detailsTr.innerHTML = `
                <td colspan="6" style="padding: 16px; border-left: 4px solid var(--accent-color);">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-color); font-size: 0.95rem;">Submissions details for ${topicLabels}</h4>
                    ${submissionsHTML}
                </td>
            `;
            container.appendChild(detailsTr);
        });

        // Add event listeners for Submissions toggle & Delete button
        container.addEventListener("click", (e) => {
            const target = e.target;
            if (target.classList.contains("view-submissions-btn")) {
                const asgId = target.getAttribute("data-id");
                const detailsRow = document.getElementById(`details_${asgId}`);
                if (detailsRow) {
                    if (detailsRow.style.display === "none") {
                        detailsRow.style.display = "table-row";
                        target.style.background = "var(--accent-color)";
                        target.style.borderColor = "var(--accent-color)";
                        target.style.color = "#ffffff";
                    } else {
                        detailsRow.style.display = "none";
                        target.style.background = "var(--btn-secondary-bg)";
                        target.style.borderColor = "var(--border-color)";
                        target.style.color = "var(--text-color)";
                    }
                }
            } else if (target.classList.contains("delete-asg-btn")) {
                const asgId = target.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this assignment and all its submissions?")) {
                    // Delete assignment
                    let activeAsgs = loadAssignments();
                    activeAsgs = activeAsgs.filter(a => a.id !== asgId);
                    saveAssignments(activeAsgs);

                    // Delete submissions
                    let activeSubs = loadSubmissions();
                    activeSubs = activeSubs.filter(s => s.assignmentId !== asgId);
                    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(activeSubs));

                    // Re-render
                    renderAssignmentsAndSubmissions();
                    updateTeacherAnalytics();
                }
            }
        });
    }

    // Calculate and update analytics KPIs
    function updateTeacherAnalytics() {
        const assignments = loadAssignments();
        const submissions = loadSubmissions();

        const totalPublished = assignments.length;
        const totalSubmissions = submissions.length;

        // KPI element selectors
        const countValEl = document.getElementById("asgCountValue");
        const submissionValEl = document.getElementById("asgSubmissionsValue");
        const avgScoreValEl = document.getElementById("asgAvgScoreValue");

        if (countValEl) countValEl.textContent = String(totalPublished);
        if (submissionValEl) submissionValEl.textContent = String(totalSubmissions);

        if (avgScoreValEl) {
            if (totalSubmissions === 0) {
                avgScoreValEl.textContent = "—";
            } else {
                const totalScorePct = submissions.reduce((sum, curr) => {
                    const pct = curr.totalQuestions > 0 ? (curr.score / curr.totalQuestions) * 100 : 0;
                    return sum + pct;
                }, 0);
                avgScoreValEl.textContent = Math.round(totalScorePct / totalSubmissions) + "%";
            }
        }
    }

    function exportAssignmentsAsJson() {
        const assignments = loadAssignments();
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            assignments
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `learnsphere_assignment_set_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function importAssignmentsFromJsonFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result || '{}'));
                const importedAssignments = Array.isArray(parsed) ? parsed : parsed?.assignments;

                if (!Array.isArray(importedAssignments)) {
                    alert('Invalid JSON format for assignment import.');
                    return;
                }

                // Basic normalization
                const cleaned = importedAssignments
                    .filter(a => a && typeof a === 'object')
                    .map(a => ({
                        id: String(a.id || ('assignment_' + Date.now())),
                        topicIds: Array.isArray(a.topicIds) ? a.topicIds : [],
                        dueDate: a.dueDate,
                        difficulty: a.difficulty || 'medium',
                        numQuestions: typeof a.numQuestions === 'number' ? a.numQuestions : 5,
                        createdAt: a.createdAt || new Date().toISOString(),
                        status: a.status || 'active'
                    }))
                    .filter(a => a.topicIds.length > 0 && !!a.dueDate);

                if (cleaned.length === 0) {
                    alert('No valid assignments found in the JSON.');
                    return;
                }

                // Merge by id, overwriting duplicates
                const existing = loadAssignments();
                const byId = new Map(existing.map(a => [a.id, a]));
                cleaned.forEach(a => byId.set(a.id, a));

                saveAssignments(Array.from(byId.values()));

                // Re-render
                renderAssignmentsAndSubmissions();
                updateTeacherAnalytics();

                alert(`Imported ${cleaned.length} assignment(s).`);
            } catch (e) {
                console.error(e);
                alert('Failed to import assignments: invalid JSON.');
            }
        };
        reader.readAsText(file);
    }

    // Init function
    function init() {
        populateTopicCheckboxes();
        setupFormHandler();

        // Export / Import wiring
        const exportBtn = document.getElementById('exportAssignmentsBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportAssignmentsAsJson);
        }

        const importFileEl = document.getElementById('importAssignmentsFile');
        if (importFileEl) {
            importFileEl.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                importAssignmentsFromJsonFile(file);
                // reset value so importing same file twice triggers change
                importFileEl.value = '';
            });
        }

        renderAssignmentsAndSubmissions();
        updateTeacherAnalytics();
    }


    // Load
    document.addEventListener("DOMContentLoaded", () => {
        // Run only if we are on teachers.html and assignment components are present
        if (document.getElementById("addAssignmentForm") || document.getElementById("assignmentsTableBody")) {
            init();
        }
    });

    // Expose functions globally for debugging/refreshing
    window.assignmentBuilder = {
        init,
        loadAssignments,
        loadSubmissions,
        renderAssignmentsAndSubmissions,
        updateTeacherAnalytics
    };

})();
