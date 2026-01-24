const modal = document.getElementById("teacherModal");
const table = document.getElementById("accountsTable").getElementsByTagName("tbody")[0];


let isSubmittingUser = false;

document.addEventListener('DOMContentLoaded', function () {
    const contactInput = document.getElementById('teacherContact');
    const editContactInput = document.getElementById('editTeacherContact');

    if (contactInput) {
        contactInput.addEventListener('input', function (e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 11) {
                this.value = this.value.slice(0, 11);
            }
        });
    }

    if (editContactInput) {
        editContactInput.addEventListener('input', function (e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 11) {
                this.value = this.value.slice(0, 11);
            }
        });
    }
});


const employIdInput = document.getElementById('employID');
if (employIdInput) {
    employIdInput.addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 8) {
            this.value = this.value.slice(0, 8);
        }
    });
}


const employIDInput = document.getElementById("employID");
if (employIDInput) {
    employIDInput.addEventListener("input", async function () {
        const employID = employIDInput.value.trim();

        employIDInput.classList.remove("input-error");
        removeEmployIdErrorMessage();

        if (!employID || employID.length < 3) return;

        try {
            const response = await fetch(`/accounts/check-employid/?employID=${encodeURIComponent(employID)}`);
            const data = await response.json();

            if (data.exists) {
                showEmployIdErrorMessage("This employee ID already exists");
                employIDInput.classList.add("input-error");
            }
        } catch (error) {
            console.error("Error checking employee ID:", error);
        }
    });
}

function showEmployIdErrorMessage(message) {
    let errorLabel = document.getElementById("employID-error");

    if (!errorLabel) {
        errorLabel = document.createElement("div");
        errorLabel.id = "employID-error";
        errorLabel.style.color = "red";
        errorLabel.style.fontSize = "12px";
        errorLabel.style.marginTop = "4px";
        employIDInput.parentNode.appendChild(errorLabel);
    }

    errorLabel.textContent = message;
}

function removeEmployIdErrorMessage() {
    const errorLabel = document.getElementById("employID-error");
    if (errorLabel) errorLabel.remove();
}


document.addEventListener('click', function (e) {
    if (e.target.closest('.edit-btn-action')) {
        e.preventDefault();
        const button = e.target.closest('.edit-btn-action');
        const row = button.closest('tr');

        const id = row.getAttribute('data-professor-id') || '';
        const firstName = row.getAttribute('data-first-name') || '';
        const midName = row.getAttribute('data-mid-name') || '';
        const lastName = row.getAttribute('data-last-name') || '';
        const email = row.getAttribute('data-email') || '';
        const phoneNumber = row.getAttribute('data-phone') || '';
        const department = row.getAttribute('data-department') || '';
        const employmentStatus = row.getAttribute('data-employment-status') || 'Full-time';
        const employID = row.getAttribute('data-employ-id') || '';
        const userType = row.getAttribute('data-user-type') || 'TertiaryFaculty';

        editProfessor(id, firstName, midName, lastName, email, phoneNumber, department, employmentStatus, employID, userType);
    }
});

function toggleUserTypeFields() {
    const facultyFields = document.getElementById('facultyFields');

    facultyFields.style.display = 'block';
    document.getElementById('employmentStatus').required = true;
    document.getElementById('employID').required = true;
    document.getElementById('teacherDept').required = true;
}

function openEditModal() {
    const editModal = document.getElementById("editTeacherModal");
    if (editModal) {
        console.log('✅ Edit modal found, opening...');
        editModal.style.display = "flex";
    } else {
        console.error('❌ Edit modal not found in DOM');
    }
}

function closeEditModal() {
    const editModal = document.getElementById("editTeacherModal");
    if (editModal) {
        editModal.style.display = "none";
    }
}

function openModal() {
    modal.style.display = "flex";
    document.getElementById('user-type').value = 'TertiaryFaculty';
    toggleUserTypeFields();
}

function closeModal() {
    modal.style.display = "none";

    document.getElementById('teacherFirst').value = '';
    document.getElementById('teacherMiddle').value = '';
    document.getElementById('teacherLast').value = '';
    document.getElementById('teacherEmail').value = '';
    document.getElementById('teacherContact').value = '';
    document.getElementById('teacherDept').value = '';
    document.getElementById('employmentStatus').value = '';
    document.getElementById('employID').value = '';
    removeEmployIdErrorMessage();
}

function searchTable() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toLowerCase();
    const tbody = document.querySelector('#accountsTable tbody');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (row.querySelector('td[colspan]')) {
            continue;
        }

        const employID = row.querySelector('.employID');
        const nameCell = row.querySelector('.user-name');
        const employStatus = row.querySelector('.user-employ-status');
        const userDepartment = row.querySelector('.user-department');
        const userEmail = row.querySelector('.user-email');
        const userPhoneNumber = row.querySelector('.user-phone-number');

        const name = nameCell ? (nameCell.textContent || nameCell.innerText).trim().toLowerCase() : "";
        const id = employID ? (employID.textContent || employID.innerText).trim().toLowerCase() : "";
        const status = employStatus ? (employStatus.textContent || employStatus.innerText).trim().toLowerCase() : "";
        const department = userDepartment ? (userDepartment.textContent || userDepartment.innerText).trim().toLowerCase() : "";
        const email = userEmail ? (userEmail.textContent || userEmail.innerText).trim().toLowerCase() : "";
        const phoneNumber = userPhoneNumber ? (userPhoneNumber.textContent || userPhoneNumber.innerText).trim().toLowerCase() : "";

        if (name.indexOf(filter) > -1 ||
            id.indexOf(filter) > -1 ||
            status.indexOf(filter) > -1 ||
            department.indexOf(filter) > -1 ||
            email.indexOf(filter) > -1 ||
            phoneNumber.indexOf(filter) > -1) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

function filterByDepartment() {
    const departmentFilter = document.getElementById('departmentFilter').value.toLowerCase();
    const tbody = document.querySelector('#accountsTable tbody');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (row.querySelector('td[colspan]')) {
            continue;
        }

        const departmentCell = row.cells[2];

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

function getCookie(name) {
    try {
        const cookies = (document.cookie || '').split(';');

        for (let cookie of cookies) {
            const trimmedCookie = cookie.trim();
            if (trimmedCookie.startsWith(name + '=')) {
                return decodeURIComponent(trimmedCookie.substring(name.length + 1));
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting cookie:', error);
        return null;
    }
}

function resetPassword(professorId, email, userType) {
    const passwordType = 'cscqcApp123';
    if (!confirm(`Reset password of ${email} to ${passwordType}?`)) {
        return;
    }

    const button = event.target.closest('button');
    const originalContent = button.innerHTML;

    button.disabled = true;
    button.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span>';

    fetch(`/accounts/reset-password/${professorId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Content-Type': 'application/json',
        },
    })
        .then(response => {
            if (response.status === 403) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Permission denied');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert(`✅ ${data.message}`);
                console.log(`The password has been reset: ${data.email}`);
            } else {
                alert('❌ Error: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('❌ ' + error.message);
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalContent;
        });
}

async function saveTeacher() {

    if (isSubmittingUser) return;

    const addBtn = document.getElementById("addUserBtn");
    isSubmittingUser = true;


    addBtn.disabled = true;
    addBtn.style.pointerEvents = "none";
    addBtn.innerHTML = `
    <span class="material-symbols-outlined spin">hourglass_empty</span>
    Creating...
  `;

    try {
        const firstName = document.getElementById("teacherFirst").value.trim();
        const midName = document.getElementById("teacherMiddle").value.trim();
        const lastName = document.getElementById("teacherLast").value.trim();
        const email = document.getElementById("teacherEmail").value.trim();
        const phoneNumber = document.getElementById("teacherContact").value.trim();
        const department = document.getElementById("teacherDept").value;
        const employID = document.getElementById("employID").value.trim();
        const employmentStatus = document.getElementById("employmentStatus").value;


        const userType = "TertiaryFaculty";



        if (!employmentStatus) {
            alert("Employment Status is required");
            resetAddUserButton();
            return;
        }

        if (!employID) {
            alert("Employee ID is required");
            resetAddUserButton();
            return;
        }

        if (phoneNumber.length !== 11 || !/^[0-9]{11}$/.test(phoneNumber)) {
            alert("Contact number must be exactly 11 numeric digits");
            resetAddUserButton();
            return;
        }


        if (document.querySelector(".input-error")) {
            alert("Please fix the highlighted errors before submitting.");
            resetAddUserButton();
            return;
        }



        const requestBody = {
            first_name: firstName,
            midName: midName,
            last_name: lastName,
            email: email,
            phoneNumber: phoneNumber,
            department: department,
            employID: employID,
            employmentStatus: employmentStatus,
            user_type: userType,
            password: "cscqcApp123"
        };



        const response = await fetch("/accounts/register/", {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken"),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (data.success) {

            addBtn.innerHTML = "✅ Created";

            alert("Tertiary Faculty added successfully!");


            document.getElementById("teacherFirst").value = "";
            document.getElementById("teacherMiddle").value = "";
            document.getElementById("teacherLast").value = "";
            document.getElementById("teacherEmail").value = "";
            document.getElementById("teacherContact").value = "";
            document.getElementById("teacherDept").value = "";
            document.getElementById("employmentStatus").value = "";
            document.getElementById("employID").value = "";


            setTimeout(() => {
                closeModal();
                location.reload();
            }, 800);

        } else {
            alert("Error adding faculty: " + (data.error || "Unknown error"));
            resetAddUserButton();
        }

    } catch (error) {
        console.error("Error:", error);
        alert("Error adding faculty");
        resetAddUserButton();
    }
}

function editProfessor(id, firstName, midName, lastName, email, phoneNumber, department, employmentStatus, employID, userType) {
    console.log('=== EDIT PROFESSOR CALLED ===');
    console.log('Parameters received:', {
        id, firstName, midName, lastName, email, phoneNumber,
        department, employmentStatus, employID, userType
    });


    document.getElementById('editTeacherId').value = id || '';
    document.getElementById('editUserType').value = userType || 'TertiaryFaculty';


    document.getElementById('editTeacherFirst').value = firstName || '';
    document.getElementById('editTeacherMiddle').value = midName || '';
    document.getElementById('editTeacherLast').value = lastName || '';
    document.getElementById('editTeacherEmail').value = email || '';
    document.getElementById('editTeacherContact').value = phoneNumber || '';
    document.getElementById('editTeacherDept').value = department || '';


    const editFacultyFields = document.getElementById('editFacultyFields');
    editFacultyFields.style.display = 'block';
    document.getElementById('editEmploymentStatus').value = employmentStatus || 'Full-time';
    document.getElementById('editEmployID').value = employID || '';

    console.log('✅ Fields populated successfully');
    console.log('Employment Status:', document.getElementById('editEmploymentStatus').value);
    console.log('Employee ID:', document.getElementById('editEmployID').value);

    openEditModal();
}


const editEmployIDInput = document.getElementById("editEmployID");
const editUserIdInput = document.getElementById("editTeacherId");

if (editEmployIDInput) {
    editEmployIDInput.addEventListener("input", async function () {
        const employID = editEmployIDInput.value.trim();
        const uid = editUserIdInput.value;

        editEmployIDInput.classList.remove("input-error");
        removeEditEmployIdError();

        if (!employID || employID.length < 3) return;

        try {
            const url = `/accounts/check-employid/?employID=${encodeURIComponent(employID)}&excludeUid=${encodeURIComponent(uid)}`;
            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();

                if (data.exists) {
                    showEditEmployIdError("This employee ID already exists");
                    editEmployIDInput.classList.add("input-error");
                }
            }
        } catch (error) {
            console.error("Error checking employID (edit modal):", error);
        }
    });
}

function showEditEmployIdError(message) {
    let error = document.getElementById("editEmployID-error");

    if (!error) {
        error = document.createElement("div");
        error.id = "editEmployID-error";
        error.style.color = "red";
        error.style.fontSize = "12px";
        error.style.marginTop = "4px";
        editEmployIDInput.parentNode.appendChild(error);
    }

    error.textContent = message;
}

function removeEditEmployIdError() {
    const error = document.getElementById("editEmployID-error");
    if (error) error.remove();
}

async function updateTeacher() {
    const professorId = document.getElementById('editTeacherId').value;
    const userType = document.getElementById('editUserType').value;
    const firstName = document.getElementById('editTeacherFirst').value;
    const midName = document.getElementById('editTeacherMiddle').value;
    const lastName = document.getElementById('editTeacherLast').value;
    const phoneNumber = document.getElementById('editTeacherContact').value;
    const department = document.getElementById('editTeacherDept').value;
    const employmentStatus = document.getElementById('editEmploymentStatus').value;
    const employID = document.getElementById('editEmployID').value.trim();
    const editEmpInput = document.getElementById("editEmployID");


    if (editEmpInput && editEmpInput.classList.contains("input-error")) {
        alert("Employee ID already exists. Please choose a different ID.");
        return;
    }

    if (phoneNumber.length !== 11 || !/^[0-9]{11}$/.test(phoneNumber)) {
        alert("Contact number must be exactly 11 numeric digits");
        return;
    }

    if (!employmentStatus) {
        alert("Employment Status is required");
        return;
    }

    if (!employID || employID.length !== 8) {
        alert("Employee ID must be exactly 8 digits");
        return;
    }


    try {
        const checkResponse = await fetch(`/accounts/check-employid/?employID=${encodeURIComponent(employID)}&excludeUid=${encodeURIComponent(professorId)}`, {
            method: 'GET',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
        });

        if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            if (checkData.exists) {
                alert("This Employee ID is already registered to another user. Please use a different Employee ID.");
                return;
            }
        }
    } catch (error) {
        console.error('Error checking employID:', error);
    }

    const updateData = {
        first_name: firstName,
        midName: midName,
        last_name: lastName,
        phoneNumber: phoneNumber,
        department: department,
        employmentStatus: employmentStatus,
        employID: employID
    };

    fetch(`/accounts/update-professor/${professorId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeEditModal();
                alert("User updated successfully!");
                location.reload();
            } else {
                alert("Error updating user: " + (data.error || "Unknown error"));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Error updating user");
        });
}

async function deleteUser(professorId, buttonElement) {
    try {
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }

        buttonElement.disabled = true;
        buttonElement.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span>';

        const response = await fetch(`/accounts/delete-user/${professorId}/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            const row = buttonElement.closest('tr');
            row.style.transition = 'opacity 0.3s ease';
            row.style.opacity = '0';

            setTimeout(() => {
                row.remove();
            }, 300);

            alert('User deleted successfully');
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }

    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error: ' + error.message);
    } finally {
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<span class="material-symbols-outlined">delete</span>';
        }
    }
}

const firstNameInput = document.getElementById('teacherFirst');
if (firstNameInput) {
    firstNameInput.addEventListener('input', async function () {
        const firstName = this.value.trim();
        const lastName = document.getElementById('teacherLast').value.trim();

        this.classList.remove('input-error');
        removeFirstNameError();

        if (!firstName || firstName.length < 2) return;
        if (!lastName || lastName.length < 2) return;

        await checkNameExists(firstName, lastName);
    });
}

const lastNameInput = document.getElementById('teacherLast');
if (lastNameInput) {
    lastNameInput.addEventListener('input', async function () {
        const firstName = document.getElementById('teacherFirst').value.trim();
        const lastName = this.value.trim();

        this.classList.remove('input-error');
        lastNameInput.classList.remove('input-error');
        removeLastNameError();

        if (!firstName || firstName.length < 2) return;
        if (!lastName || lastName.length < 2) return;

        await checkNameExists(firstName, lastName);
    });
}

async function checkNameExists(firstName, lastName) {
    const firstNameInput = document.getElementById('teacherFirst');
    const lastNameInput = document.getElementById('teacherLast');

    try {
        const response = await fetch(`/accounts/check-name/?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`);
        const data = await response.json();

        if (data.exists) {
            showNameError("A user with this first and last name already exists");
            firstNameInput.classList.add('input-error');
            lastNameInput.classList.add('input-error');
        } else {
            removeNameError();
            firstNameInput.classList.remove('input-error');
            lastNameInput.classList.remove('input-error');
        }
    } catch (error) {
        console.error("Error checking name:", error);
    }
}

function showNameError(message) {
    let errorLabel = document.getElementById("name-error");

    if (!errorLabel) {
        errorLabel = document.createElement("div");
        errorLabel.id = "name-error";
        errorLabel.style.color = "red";
        errorLabel.style.fontSize = "12px";
        errorLabel.style.marginTop = "4px";

        const lastNameInput = document.getElementById('teacherLast');
        lastNameInput.parentNode.appendChild(errorLabel);
    }

    errorLabel.textContent = message;
}

function removeNameError() {
    const errorLabel = document.getElementById("name-error");
    if (errorLabel) errorLabel.remove();
}

function removeFirstNameError() {
    removeNameError();
}

function removeLastNameError() {
    removeNameError();
}

const editFirstNameInput = document.getElementById('editTeacherFirst');
if (editFirstNameInput) {
    editFirstNameInput.addEventListener('input', async function () {
        const firstName = this.value.trim();
        const lastName = document.getElementById('editTeacherLast').value.trim();
        const currentUserId = document.getElementById('editTeacherId').value;

        this.classList.remove('input-error');
        removeEditNameError();

        if (!firstName || firstName.length < 2) return;
        if (!lastName || lastName.length < 2) return;

        await checkEditNameExists(firstName, lastName, currentUserId);
    });
}

const editLastNameInput = document.getElementById('editTeacherLast');
if (editLastNameInput) {
    editLastNameInput.addEventListener('input', async function () {
        const firstName = document.getElementById('editTeacherFirst').value.trim();
        const lastName = this.value.trim();
        const currentUserId = document.getElementById('editTeacherId').value;

        this.classList.remove('input-error');
        editFirstNameInput.classList.remove('input-error');
        removeEditNameError();

        if (!firstName || firstName.length < 2) return;
        if (!lastName || lastName.length < 2) return;

        await checkEditNameExists(firstName, lastName, currentUserId);
    });
}

async function checkEditNameExists(firstName, lastName, excludeUserId) {
    const editFirstNameInput = document.getElementById('editTeacherFirst');
    const editLastNameInput = document.getElementById('editTeacherLast');

    try {
        const response = await fetch(`/accounts/check-name/?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&excludeUid=${encodeURIComponent(excludeUserId)}`);
        const data = await response.json();

        if (data.exists) {
            showEditNameError("A user with this first and last name already exists");
            editFirstNameInput.classList.add('input-error');
            editLastNameInput.classList.add('input-error');
        } else {
            removeEditNameError();
            editFirstNameInput.classList.remove('input-error');
            editLastNameInput.classList.remove('input-error');
        }
    } catch (error) {
        console.error("Error checking name:", error);
    }
}

function showEditNameError(message) {
    let errorLabel = document.getElementById("edit-name-error");

    if (!errorLabel) {
        errorLabel = document.createElement("div");
        errorLabel.id = "edit-name-error";
        errorLabel.style.color = "red";
        errorLabel.style.fontSize = "12px";
        errorLabel.style.marginTop = "4px";

        const editLastNameInput = document.getElementById('editTeacherLast');
        editLastNameInput.parentNode.appendChild(errorLabel);
    }

    errorLabel.textContent = message;
}

function removeEditNameError() {
    const errorLabel = document.getElementById("edit-name-error");
    if (errorLabel) errorLabel.remove();
}

function isValidName(name) {
    return /^[A-Za-z\s'-]+$/.test(name);
}

function showInputError(input, message, id) {
    input.classList.add("input-error");

    let error = document.getElementById(id);
    if (!error) {
        error = document.createElement("div");
        error.id = id;
        error.className = "input-error-message";
        input.parentNode.appendChild(error);
    }
    error.textContent = message;
}

function removeInputError(input, id) {
    input.classList.remove("input-error");
    const error = document.getElementById(id);
    if (error) error.remove();
}

const emailInput = document.getElementById("teacherEmail");

if (emailInput) {
    let emailDebounceTimer = null;

    emailInput.addEventListener("input", function () {
        const email = this.value.trim();

        removeEmailError();
        emailInput.classList.remove("input-error");

        if (!email) return;


        if (!email.includes("@")) {
            showEmailError("Email must contain '@'");
            emailInput.classList.add("input-error");
            return;
        }

        clearTimeout(emailDebounceTimer);
        emailDebounceTimer = setTimeout(() => {
            checkEmailExists(email);
        }, 500);
    });
}

async function checkEmailExists(email) {
    try {
        const response = await fetch(
            `/accounts/check-email/?email=${encodeURIComponent(email)}`
        );
        const data = await response.json();

        if (data.exists) {
            showEmailError("This email is already registered");
            emailInput.classList.add("input-error");
        }
    } catch (error) {
        console.error("Email validation error:", error);
    }
}

function showEmailError(message) {
    let error = document.getElementById("email-error");

    if (!error) {
        error = document.createElement("div");
        error.id = "email-error";
        error.style.color = "red";
        error.style.fontSize = "12px";
        error.style.marginTop = "4px";
        emailInput.parentNode.appendChild(error);
    }

    error.textContent = message;
}

function removeEmailError() {
    const error = document.getElementById("email-error");
    if (error) error.remove();
}

function resetAddUserButton() {
    const addBtn = document.getElementById("addUserBtn");
    if (!addBtn) return;

    isSubmittingUser = false;
    addBtn.disabled = false;
    addBtn.style.pointerEvents = "auto";
    addBtn.innerHTML = "Add User";
}

function initializeDepartmentAccordion() {
    const tbody = document.querySelector('#accountsTable tbody');
    if (!tbody) return;

    // Get all rows
    const allRows = Array.from(tbody.querySelectorAll('tr'));

    // Group rows by department
    const departmentGroups = {};

    allRows.forEach(row => {
        const departmentCell = row.querySelector('.user-department');
        if (departmentCell) {
            const department = departmentCell.textContent.trim();
            if (!departmentGroups[department]) {
                departmentGroups[department] = [];
            }
            departmentGroups[department].push(row);
        }
    });

    // Clear tbody
    tbody.innerHTML = '';

    // Create department accordion rows
    Object.keys(departmentGroups).sort().forEach(department => {
        const teacherRows = departmentGroups[department];
        const teacherCount = teacherRows.length;

        // Create department header row
        const deptHeaderRow = document.createElement('tr');
        deptHeaderRow.className = 'department-header-row';
        deptHeaderRow.setAttribute('data-department', department);
        deptHeaderRow.innerHTML = `
      <td colspan="5" class="department-header-cell">
        <div class="department-header-content">
          <span class="department-toggle-icon material-symbols-outlined">chevron_right</span>
          <span class="department-name">${department}</span>
          <span class="department-count">(${teacherCount} ${teacherCount === 1 ? 'teacher' : 'teachers'})</span>
        </div>
      </td>
    `;

        // Add click event to toggle
        deptHeaderRow.addEventListener('click', function () {
            toggleDepartment(department);
        });

        tbody.appendChild(deptHeaderRow);

        // Add teacher rows (hidden by default)
        teacherRows.forEach(row => {
            row.classList.add('teacher-row');
            row.classList.add('department-collapsed');
            row.setAttribute('data-department', department);
            tbody.appendChild(row);
        });
    });
}

function toggleDepartment(department) {
    const headerRow = document.querySelector(`tr.department-header-row[data-department="${department}"]`);
    const teacherRows = document.querySelectorAll(`tr.teacher-row[data-department="${department}"]`);
    const toggleIcon = headerRow.querySelector('.department-toggle-icon');

    const isCollapsed = teacherRows[0].classList.contains('department-collapsed');

    if (isCollapsed) {
        // Expand
        teacherRows.forEach(row => {
            row.classList.remove('department-collapsed');
            row.classList.add('department-expanded');
        });
        toggleIcon.textContent = 'expand_more';
        headerRow.classList.add('department-active');
    } else {
        // Collapse
        teacherRows.forEach(row => {
            row.classList.add('department-collapsed');
            row.classList.remove('department-expanded');
        });
        toggleIcon.textContent = 'chevron_right';
        headerRow.classList.remove('department-active');
    }
}

// Initialize on page load - Add this to your DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
    initializeDepartmentAccordion();

    // ... rest of your existing DOMContentLoaded code
    const contactInput = document.getElementById('teacherContact');
    const editContactInput = document.getElementById('editTeacherContact');

    if (contactInput) {
        contactInput.addEventListener('input', function (e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 11) {
                this.value = this.value.slice(0, 11);
            }
        });
    }

    if (editContactInput) {
        editContactInput.addEventListener('input', function (e) {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (this.value.length > 11) {
                this.value = this.value.slice(0, 11);
            }
        });
    }
});

// Updated search function with accordion support
function searchTable() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toLowerCase();
    const tbody = document.querySelector('#accountsTable tbody');
    const rows = tbody.getElementsByTagName('tr');

    // Track which departments have visible teachers
    const visibleDepartments = new Set();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Skip department header rows
        if (row.classList.contains('department-header-row')) {
            continue;
        }

        if (row.querySelector('td[colspan]') && !row.classList.contains('department-header-row')) {
            continue;
        }

        // Get cells
        const cells = row.querySelectorAll('td');
        let employID = row.querySelector('.employID');
        let nameCell = null;
        let employStatus = row.querySelector('.user-employ-status');
        let userDepartment = row.querySelector('.user-department');

        // Try to find name cell by checking the second td
        if (cells.length >= 2) {
            nameCell = cells[1];
        }

        if (!nameCell) {
            nameCell = row.querySelector('.user_name') || row.querySelector('.user-name');
        }

        const name = nameCell ? (nameCell.textContent || nameCell.innerText).trim().toLowerCase() : "";
        const id = employID ? (employID.textContent || employID.innerText).trim().toLowerCase() : "";
        const status = employStatus ? (employStatus.textContent || employStatus.innerText).trim().toLowerCase() : "";
        const department = userDepartment ? (userDepartment.textContent || userDepartment.innerText).trim().toLowerCase() : "";

        // Remove previous highlights
        removeHighlights(row);

        if (filter === '') {
            // If no filter, collapse all
            row.classList.add('department-collapsed');
            row.classList.remove('department-expanded');
            row.style.display = '';
        } else {
            const matches = name.includes(filter) ||
                id.includes(filter) ||
                status.includes(filter) ||
                department.includes(filter);

            if (matches) {
                row.style.display = '';
                row.classList.remove('department-collapsed');
                row.classList.add('department-expanded');

                // Highlight matching text
                highlightText(employID, id, filter);
                highlightText(nameCell, name, filter);
                highlightText(employStatus, status, filter);
                highlightText(userDepartment, department, filter);

                // Track the department
                const dept = row.getAttribute('data-department');
                if (dept) visibleDepartments.add(dept);
            } else {
                row.style.display = 'none';
            }
        }
    }

    // Update department headers
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.classList.contains('department-header-row')) {
            const dept = row.getAttribute('data-department');
            const toggleIcon = row.querySelector('.department-toggle-icon');

            if (filter === '') {
                row.style.display = '';
                toggleIcon.textContent = 'chevron_right';
                row.classList.remove('department-active');
            } else if (visibleDepartments.has(dept)) {
                row.style.display = '';
                toggleIcon.textContent = 'expand_more';
                row.classList.add('department-active');
            } else {
                row.style.display = 'none';
            }
        }
    }
}

// Function to highlight matching text
function highlightText(cell, cellText, filter) {
    if (!cell || !filter || !cellText.includes(filter)) return;

    const originalText = cell.textContent || cell.innerText;
    const regex = new RegExp(`(${escapeRegex(filter)})`, 'gi');
    const highlightedText = originalText.replace(regex, '<mark class="search-highlight">$1</mark>');

    cell.innerHTML = highlightedText;
}

// Function to remove highlights from a row
function removeHighlights(row) {
    const highlights = row.querySelectorAll('.search-highlight');
    highlights.forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
    });
}

// Escape special regex characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Updated filterByDepartment with accordion support
function filterByDepartment() {
    const departmentFilter = document.getElementById('departmentFilter').value.toLowerCase();
    const tbody = document.querySelector('#accountsTable tbody');
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Handle department headers
        if (row.classList.contains('department-header-row')) {
            const dept = row.getAttribute('data-department');
            if (departmentFilter === '' || dept.toLowerCase().indexOf(departmentFilter) > -1) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
            continue;
        }

        if (row.querySelector('td[colspan]')) {
            continue;
        }

        const departmentCell = row.querySelector('.user-department');

        if (departmentCell) {
            const department = departmentCell.textContent || departmentCell.innerText;

            if (departmentFilter === '') {
                row.style.display = '';
                row.classList.add('department-collapsed');
                row.classList.remove('department-expanded');
            } else if (department.toLowerCase().indexOf(departmentFilter) > -1) {
                row.style.display = '';
                row.classList.remove('department-collapsed');
                row.classList.add('department-expanded');
            } else {
                row.style.display = 'none';
            }
        }
    }

    // Update department header icons
    if (departmentFilter !== '') {
        const headers = tbody.querySelectorAll('.department-header-row');
        headers.forEach(header => {
            if (header.style.display !== 'none') {
                const toggleIcon = header.querySelector('.department-toggle-icon');
                toggleIcon.textContent = 'expand_more';
                header.classList.add('department-active');
            }
        });
    } else {
        const headers = tbody.querySelectorAll('.department-header-row');
        headers.forEach(header => {
            const toggleIcon = header.querySelector('.department-toggle-icon');
            toggleIcon.textContent = 'chevron_right';
            header.classList.remove('department-active');
        });
    }
}