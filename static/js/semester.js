let selectedProfessorId = null;
const csrftoken = getCookie('csrftoken');

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function fetchClassesByTeacher(teacherUid, department = "all") {
    try {
        console.log(`🔍 Fetching classes for teacher: ${teacherUid}`);
        const response = await fetch(`schedules/get_classes_list/?teacherUid=${teacherUid}&department=${department}`);
        const data = await response.json();

        console.log("📦 Raw API response:", data);

        if (data.success) {
            console.log(`✅ Classes for teacher ${teacherUid}:`, data.classes);
            console.log(`📊 Number of classes: ${data.classes.length}`);

            if (data.classes.length > 0) {
                console.log("🔬 First class structure:", data.classes[0]);
            }

            return data.classes;
        } else {
            console.error("❌ Error fetching classes:", data.error);
            return [];
        }
    } catch (err) {
        console.error("⚠️ Fetch error:", err);
        return [];
    }
}

function searchTable() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toLowerCase();
    const tbody = document.querySelector('#professorTable tbody');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (row.querySelector('td[colspan]')) {
            continue;
        }

        const employID = row.querySelector('.employ-id')
        const nameCell = row.querySelector('.user-name');
        const userDepartment = row.querySelector('.user-department');

        const name = nameCell ? (nameCell.textContent || nameCell.innerText).trim().toLowerCase() : "";
        const id = employID ? (employID.textContent || employID.innerText).trim().toLowerCase() : "";
        const department = userDepartment ? (userDepartment.textContent || userDepartment.innerText).trim().toLowerCase() : "";

        if (name.indexOf(filter) > -1) {
            row.style.display = '';
        } else if (id.indexOf(filter) > -1) {
            row.style.display = '';
        } else if (department.indexOf(filter) > -1) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}


function viewClasses(teacherId, teacherName) {
    selectedProfessorId = teacherId;

    const professorTable = document.getElementById("professorTable");
    const classesSection = document.getElementById("classesSection");
    const professorNameSpan = document.getElementById("professorName");

    if (!professorTable || !classesSection || !professorNameSpan) {
        console.error("Missing elements in HTML!");
        return;
    }

    professorTable.style.display = "none";
    classesSection.style.display = "block";
    professorNameSpan.textContent = teacherName;

    fetchClassesByTeacher(teacherId).then(classes => {
        console.log("📚 Fetched classes:", classes);
        displayClasses(classes);
    }).catch(err => {
        console.error("Error fetching classes:", err);
        alert("Error loading classes.");
    });
}


function backToProfessorList() {
    const professorTable = document.getElementById("professorTable");
    const classesSection = document.getElementById("classesSection");

    if (professorTable && classesSection) {
        classesSection.style.display = "none";
        professorTable.style.display = "table";
    }
}

function deleteSelected() {

    const checkboxes = document.querySelectorAll('.course-checkbox:checked');

    if (checkboxes.length === 0) {
        alert('Please select at least one user to delete');
        return;
    }

    if (!confirm(`Are you sure you want to delete ${checkboxes.length} user(s)?`)) {
        return;
    }

    const deletePromises = [];

    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const courseID = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

        if (courseID) {
            const promise = fetch(`/semester/maintenance/delete_course/${courseID}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Content-Type': 'application/json',
                },
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        row.style.transition = 'opacity 0.3s ease';
                        row.style.opacity = '0';
                        setTimeout(() => row.remove(), 300);
                        return true;
                    }
                    return false;
                });

            deletePromises.push(promise);
        }
    });

    Promise.all(deletePromises).then(() => {
        alert('Selected courses deleted successfully');
    }).catch(error => {
        console.error('Error deleting courses:', error);
        alert('Error deleting some courses');
    });

}

function displayClasses(classes) {
    const tableBody = document.getElementById("courseTableBody");
    tableBody.innerHTML = "";

    if (!classes || classes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3">No classes found.</td></tr>';
        return;
    }

    classes.forEach(cls => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><input type="checkbox" class="course-checkbox" data-id="${cls.id}""></td>
            <td>${cls.subjectCode || 'N/A'}</td>
            <td>${cls.subjectName || 'N/A'}</td>
            <td>
                <button class="delete-btn" onclick="deleteCourse('${cls.id}', this)">Delete</button>
                <button class="edit-btn" onclick='editClass(${JSON.stringify(cls)})'>Edit</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


function deleteCourse(classId, btn) {
    if (!confirm("Are you sure you want to delete this class?")) return;

    fetch(`/semester/maintenance/delete_course/${classId}/`, {
        method: "POST",
        headers: {
            "X-CSRFToken": csrftoken,
            "Content-Type": "application/json",
        },
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                btn.closest("tr").remove();
                alert("Class deleted successfully!");
            } else {
                alert("Error deleting class: " + data.error);
            }
        })
        .catch(err => {
            console.error("Error deleting class:", err);
            alert("Error deleting class.");
        });
}


function importExcel() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("teacherUid", selectedProfessorId);
        formData.append("teacher_name", document.getElementById("professorName").textContent);
        formData.append("department", "all");

        fetch("maintenance/semester/import_class_excel/", {
            method: "POST",
            headers: { "X-CSRFToken": csrftoken },
            body: formData,
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    let message = data.message;


                    if (data.skipped && data.skipped.length > 0) {
                        message += "\n\n⚠️ Skipped classes (schedule conflicts):\n";
                        data.skipped.forEach(skipped => {
                            message += `\n• ${skipped.subjectCode}: ${skipped.reason}`;
                        });
                    }

                    alert(message);
                    viewClasses(selectedProfessorId, document.getElementById("professorName").textContent);
                } else {
                    alert("Error importing: " + data.error);
                }
            })
            .catch(err => {
                console.error("Error importing classes:", err);
                alert("Error uploading file.");
            });
    };

    input.click();
}

function importAllTeachersExcel() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;


        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification("File is too large. Maximum size is 10MB.", "error");
            return;
        }


        const allowedTypes = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel"
        ];
        if (!allowedTypes.includes(file.type)) {
            showNotification("Invalid file type. Please upload an Excel file.", "error");
            return;
        }


        const confirmed = confirm(
            "This will import schedules for all teachers in the Excel file. Continue?"
        );
        if (!confirmed) return;


        const loadingOverlay = showLoading("Processing schedules for all teachers...");

        try {
            const formData = new FormData();
            formData.append("file", file);

            console.log("Uploading file:", file.name, "Size:", file.size);

            const response = await fetch("/semester/maintenance/import_all_teachers_excel/", {
                method: "POST",
                headers: { "X-CSRFToken": csrftoken },
                body: formData,
            });

            console.log("Response status:", response.status);
            console.log("Response headers:", response.headers);


            const data = await response.json();
            console.log("Response data:", data);

            if (!response.ok) {

                let errorMessage = `Server error: ${response.status} ${response.statusText}`;


                if (data.error) {
                    errorMessage += `\n\nDetails: ${data.error}`;
                }


                if (data.errors && data.errors.length > 0) {
                    errorMessage += `\n\nErrors:\n${data.errors.join('\n')}`;
                }

                console.error("Server error details:", data);
                showNotification(errorMessage, "error");
                return;
            }

            if (data.success) {
                let message = buildImportSummary(data);
                showNotification(message, data.has_errors ? "warning" : "success");


                if (typeof viewClasses === 'function' && selectedProfessorId) {
                    viewClasses(
                        selectedProfessorId,
                        document.getElementById("professorName")?.textContent
                    );
                }
            } else {
                showNotification(
                    data.error || "Failed to import schedules.",
                    "error"
                );
            }
        } catch (error) {
            console.error("Error importing schedules:", error);


            let errorMsg = "Failed to upload file.\n\n";
            errorMsg += `Error: ${error.message}\n\n`;
            errorMsg += "Please check:\n";
            errorMsg += "1. Your internet connection\n";
            errorMsg += "2. The Excel file format\n";
            errorMsg += "3. Browser console for details";

            showNotification(errorMsg, "error");
        } finally {
            hideLoading(loadingOverlay);
        }
    };

    input.click();
}


function buildImportSummary(data) {
    const parts = [];


    parts.push(`✓ Bulk Import Complete\n`);
    parts.push(`─────────────────────────`);


    parts.push(`\n📊 Overall Statistics:`);
    parts.push(`   • Teachers processed: ${data.teachers_processed}`);
    parts.push(`   • Total classes imported: ${data.total_imported}`);

    if (data.total_skipped > 0) {
        parts.push(`   • Total classes skipped: ${data.total_skipped}`);
    }


    if (data.teacher_results && data.teacher_results.length > 0) {
        parts.push(`\n👥 Per-Teacher Breakdown:`);

        data.teacher_results.forEach(teacher => {
            parts.push(`\n   ${teacher.teacher_name || teacher.employee_id}:`);
            parts.push(`      ✓ Imported: ${teacher.imported_count} classes`);

            if (teacher.skipped_count > 0) {
                parts.push(`      ⚠ Skipped: ${teacher.skipped_count} classes`);
            }
        });
    }


    if (data.skipped_details && data.skipped_details.length > 0) {
        parts.push(`\n\n⚠️ Skipped Classes (Conflicts):`);

        data.skipped_details.forEach(item => {
            parts.push(
                `   • ${item.employee_id} - ${item.subjectCode}: ${item.reason}`
            );
        });
    }


    if (data.errors && data.errors.length > 0) {
        parts.push(`\n\n❌ Errors:`);
        data.errors.forEach(error => {
            parts.push(`   • ${error}`);
        });
    }

    return parts.join('\n');
}

function showNotification(message, type = "info") {

    const existing = document.getElementById("notificationModal");
    if (existing) existing.remove();

    const colors = {
        success: { bg: "#d4edda", border: "#c3e6cb", text: "#155724", icon: "✓" },
        error: { bg: "#f8d7da", border: "#f5c6cb", text: "#721c24", icon: "✕" },
        warning: { bg: "#fff3cd", border: "#ffeaa7", text: "#856404", icon: "⚠" },
        info: { bg: "#d1ecf1", border: "#bee5eb", text: "#0c5460", icon: "ℹ" }
    };

    const color = colors[type] || colors.info;

    const modal = document.createElement("div");
    modal.id = "notificationModal";
    modal.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        background: ${color.bg};
        border: 1px solid ${color.border};
        border-left: 4px solid ${color.border};
        color: ${color.text};
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        white-space: pre-wrap;
    `;

    modal.innerHTML = `
        <div style="display: flex; align-items: start; gap: 10px;">
            <span style="font-size: 20px; font-weight: bold;">${color.icon}</span>
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 500;">${message}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; font-size: 20px; 
                    cursor: pointer; padding: 0; color: ${color.text}; 
                    opacity: 0.7;">×</button>
        </div>
    `;


    const style = document.createElement("style");
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);


    const timeout = message.length > 100 ? 10000 : 5000;
    setTimeout(() => {
        if (modal.parentNode) {
            modal.style.animation = "slideIn 0.3s ease-out reverse";
            setTimeout(() => modal.remove(), 300);
        }
    }, timeout);
}

function showLoading(message = "Loading...") {
    const overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    const loader = document.createElement("div");
    loader.style.cssText = `
        background: white;
        padding: 30px 40px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    loader.innerHTML = `
        <div class="spinner" style="
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        "></div>
        <p style="margin: 0; font-size: 16px; color: #333;">${message}</p>
    `;


    const style = document.createElement("style");
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    overlay.appendChild(loader);
    document.body.appendChild(overlay);

    return overlay;
}

function hideLoading(overlay) {
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

function openAddClassModal() {
    const modal = document.getElementById("addClassModal");
    if (modal) {
        modal.style.display = "block";
        console.log("✅ Modal opened");
    } else {
        console.error("❌ Modal element 'addClassModal' not found!");
        alert("Error: Modal not found. Check your HTML.");
    }
}

function closeAddClassModal() {
    const modal = document.getElementById("addClassModal");
    const form = document.getElementById("addClassForm");

    if (modal) {
        modal.style.display = "none";
        console.log("✅ Modal closed");
    }

    if (form) {
        form.reset();
    } else {
        console.warn("⚠️ Form 'addClassForm' not found");
    }
}


function submitAddClass(event) {
    event.preventDefault();

    const subjectCode = document.getElementById("subjectCode").value.trim();
    const subjectName = document.getElementById("subjectName").value.trim();
    const section = document.getElementById("section")?.value.trim() || 'B';
    const day = document.getElementById("day").value;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const room = document.getElementById("room").value.trim();

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    function formatTime(hours, minutes) {
        let displayHours = hours % 12 || 12;
        let period = hours >= 12 ? "PM" : "AM";
        let displayMinutes = String(minutes).padStart(2, "0");
        return displayHours + ":" + displayMinutes + " " + period;
    }

    const formattedStartTime = formatTime(startHours, startMinutes);
    const formattedEndTime = formatTime(endHours, endMinutes);

    console.log(startTime);
    console.log(endTime);

    if (!subjectCode || !subjectName || !day || !startTime || !endTime || !room) {
        alert("Please fill in all required fields.");
        return;
    }

    const classData = {
        subjectCode: subjectCode,
        subjectName: subjectName,
        teacherUid: selectedProfessorId,
        section: section,
        day: day,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        room: room,
    };

    fetch("maintenance/semester/add_class/", {
        method: "POST",
        headers: {
            "X-CSRFToken": csrftoken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(classData),
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Class added successfully!");
                viewClasses(selectedProfessorId, document.getElementById("professorName").textContent);
                closeAddClassModal();
            } else {

                if (res.status === 409) {
                    alert("⚠️ Schedule Conflict!\n\n" + data.error);
                } else {
                    alert("Error adding class: " + data.error);
                }
            }
        })
        .catch(err => {
            console.error("Error adding class:", err);
            alert("Error adding class.");
        });
}

function editClass(classData) {
    document.getElementById("editClassId").value = classData.id;
    document.getElementById("editSubjectCode").value = classData.subjectCode;
    document.getElementById("editSubjectName").value = classData.subjectName;
    document.getElementById("editDay").value = classData.day || "";
    document.getElementById("editStartTime").value = formatTimeForInput(classData.startTime);
    document.getElementById("editEndTime").value = formatTimeForInput(classData.endTime);
    document.getElementById("editRoom").value = classData.room || "";
    document.getElementById("editClassModal").style.display = "block";
}

function formatTimeForInput(time) {
    if (!time) return "";

    if (/^\d{2}:\d{2}$/.test(time)) {
        return time;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
        return time.substring(0, 5);
    }

    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();

        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    return time;
}

function closeEditClassModal() {
    document.getElementById("editClassModal").style.display = "none";
    document.getElementById("editClassForm").reset();
}

function submitEditClass(event) {
    event.preventDefault();

    const classId = document.getElementById("editClassId").value;
    const subjectCode = document.getElementById("editSubjectCode").value.trim();
    const subjectName = document.getElementById("editSubjectName").value.trim();
    const day = document.getElementById("editDay").value;
    const startTime = document.getElementById("editStartTime").value;
    const endTime = document.getElementById("editEndTime").value;
    const room = document.getElementById("editRoom").value.trim();

    if (!subjectCode || !subjectName || !day || !startTime || !endTime || !room) {
        alert("Please fill in all fields.");
        return;
    }

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    function formatTime(hours, minutes) {
        let displayHours = hours % 12 || 12;
        let period = hours >= 12 ? "PM" : "AM";
        let displayMinutes = String(minutes).padStart(2, "0");
        return displayHours + ":" + displayMinutes + " " + period;
    }

    const formattedStartTime = formatTime(startHours, startMinutes);
    const formattedEndTime = formatTime(endHours, endMinutes);

    const classData = {
        subjectCode: subjectCode,
        subjectName: subjectName,
        day: day,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        room: room,
    };

    fetch(`/semester/maintenance/update_class/${classId}/`, {
        method: "POST",
        headers: {
            "X-CSRFToken": csrftoken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(classData),
    })
        .then(res => {

            const status = res.status;
            return res.json().then(data => ({ status, data }));
        })
        .then(({ status, data }) => {
            if (data.success) {
                alert("Class updated successfully!");
                viewClasses(selectedProfessorId, document.getElementById("professorName").textContent);
                closeEditClassModal();
            } else {

                if (status === 409) {
                    alert("⚠️ Schedule Conflict!\n\n" + data.error);
                } else {
                    alert("Error updating class: " + data.error);
                }
            }
        })
        .catch(err => {
            console.error("Error updating class:", err);
            alert("Error updating class.");
        });
}

function filterByDepartment() {
    const departmentFilter = document.getElementById('departmentFilter').value.toLowerCase();
    const tbody = document.querySelector('#professorTable tbody');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (row.querySelector('td[colspan]')) {
            continue;
        }

        const departmentCell = row.querySelector('.user-department');

        if (departmentCell) {
            const department = departmentCell.textContent || departmentCell.innerText;

            if (departmentFilter === '' || department.toLowerCase().indexOf(departmentFilter) > -1) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    }
}