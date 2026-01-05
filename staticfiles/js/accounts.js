const modal = document.getElementById("teacherModal");
const table = document.getElementById("accountsTable").getElementsByTagName("tbody")[0];

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
const userTypeSelect = document.getElementById("user-type");

if (employIDInput) {
  employIDInput.addEventListener("input", async function () {
    const employID = employIDInput.value.trim();

    
    employIDInput.classList.remove("input-error");
    removeEmployIdErrorMessage();

    if (!employID || employID.length < 3) return;

    
    if (userTypeSelect.value !== "TertiaryFaculty" && userTypeSelect.value !== "SystemUser") return;

    try {
      const response = await fetch(`/accounts/check-employid/?employID=${encodeURIComponent(employID)}`);
      const data = await response.json();

      if (data.exists) {
        showEmployIdErrorMessage("This employee ID exists in system user or tertiary faculty");
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

    console.log('Row element:', row);
    console.log('All datasets:', row.dataset);

    const id = row.getAttribute('data-professor-id') || '';
    const firstName = row.getAttribute('data-first-name') || '';
    const midName = row.getAttribute('data-mid-name') || '';
    const lastName = row.getAttribute('data-last-name') || '';
    const email = row.getAttribute('data-email') || '';
    const phoneNumber = row.getAttribute('data-phone') || '';
    const department = row.getAttribute('data-department') || '';
    const employmentStatus = row.getAttribute('data-employment-status') || 'Full-time';
    const employID = row.getAttribute('data-employ-id') || '';
    const userType = row.getAttribute('data-user-type') || '';

    console.log('Extracted data:', {
      id, firstName, midName, lastName, email, phoneNumber,
      department, employmentStatus, employID, userType
    });

    editProfessor(id, firstName, midName, lastName, email, phoneNumber, department, employmentStatus, employID, userType);
  }
});


function toggleUserTypeFields() {
  const userType = document.getElementById('user-type').value;
  const facultyFields = document.getElementById('facultyFields');
  const systemUserFields = document.getElementById('systemUserFields');

  if (userType === 'TertiaryFaculty') {
    facultyFields.style.display = 'block';
    systemUserFields.style.display = 'none';
    document.getElementById('employmentStatus').required = true;
    document.getElementById('employID').required = true;
  } else if (userType === 'SystemUser') {
    facultyFields.style.display = 'none';
    systemUserFields.style.display = 'block';
    document.getElementById('employmentStatus').required = false;
    document.getElementById('employID').required = false;
  } else {
    facultyFields.style.display = 'none';
    systemUserFields.style.display = 'none';
  }
}

function openModal() {
  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
  document.getElementById('user-type').value = '';
  toggleUserTypeFields();
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

function editProfessor(id, firstName, midName, lastName, email, phoneNumber, department, employmentStatus, employID, userType) {
  console.log('=== EDIT PROFESSOR CALLED ===');
  console.log('Parameters received:', {
    id, firstName, midName, lastName, email, phoneNumber,
    department, employmentStatus, employID, userType
  });

  
  document.getElementById('editTeacherId').value = id || '';
  document.getElementById('editUserType').value = userType || '';
  document.getElementById('editTeacherFirst').value = firstName || '';
  document.getElementById('editTeacherMiddle').value = midName || '';
  document.getElementById('editTeacherLast').value = lastName || '';
  document.getElementById('editTeacherEmail').value = email || '';
  document.getElementById('editTeacherContact').value = phoneNumber || '';
  document.getElementById('editTeacherDept').value = department || '';

  console.log('Fields populated. Values:');
  console.log('First Name:', document.getElementById('editTeacherFirst').value);
  console.log('Last Name:', document.getElementById('editTeacherLast').value);
  console.log('Email:', document.getElementById('editTeacherEmail').value);

  const editFacultyFields = document.getElementById('editFacultyFields');

  if (userType === 'TertiaryFaculty') {
    console.log('Showing faculty fields');
    editFacultyFields.style.display = 'block';
    document.getElementById('editEmploymentStatus').value = employmentStatus || 'Full-time';
    document.getElementById('editEmployID').value = employID || '';
  } else {
    console.log('Hiding faculty fields (System User)');
    editFacultyFields.style.display = 'none';
  }

  console.log('Opening edit modal...');
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
          showEditEmployIdError("This employee ID exists in system user or tertiary faculty");
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
  const editEmpInput = document.getElementById("editEmployID");

  if (editEmpInput && editEmpInput.classList.contains("input-error")) {
    alert("Employee ID already exists. Please choose a different ID.");
    return;
  }

  if (phoneNumber.length !== 11) {
    alert("Contact number must be exactly 11 digits");
    return;
  }

  if (!/^[0-9]{11}$/.test(phoneNumber)) {
    alert("Contact number must contain only numbers");
    return;
  }

  const updateData = {
    first_name: firstName,
    midName: midName,
    last_name: lastName,
    phoneNumber: phoneNumber,
    department: department,
  };

  if (userType === 'TertiaryFaculty') {
    const employmentStatus = document.getElementById('editEmploymentStatus').value;
    const employID = document.getElementById('editEmployID').value;

    if (employID) {
      try {
        const checkResponse = await fetch(`/accounts/check-employid/?employID=${encodeURIComponent(employID)}&excludeUid=${encodeURIComponent(professorId.replace('django_', ''))}`, {
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
    }

    updateData.employmentStatus = employmentStatus;
    updateData.employID = employID;
  }

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

async function saveTeacher() {
  const firstName = document.getElementById("teacherFirst").value;
  const midName = document.getElementById("teacherMiddle").value;
  const lastName = document.getElementById("teacherLast").value;
  const email = document.getElementById("teacherEmail").value;
  const phoneNumber = document.getElementById("teacherContact").value;
  const department = document.getElementById("teacherDept").value;
  const userType = document.getElementById("user-type").value;
  const employID = document.getElementById("employID").value.trim();
  const userRole = document.getElementById("userRole").value;

  [firstNameInput, lastNameInput].forEach((input, index) => {
    if (!input) return;

    input.addEventListener("input", function () {
      const errorId = `name-error-${index}`;

      if (this.value && !isValidName(this.value)) {
        showInputError(
          this,
          "Only letters, spaces, hyphens, and apostrophes are allowed",
          errorId
        );
      } else {
        removeInputError(this, errorId);
      }
    });
  });

  if (!userType) {
    alert("Please select a user type");
    return;
  }

  if (phoneNumber.length !== 11 || !/^[0-9]{11}$/.test(phoneNumber)) {
    alert("Contact number must be exactly 11 numeric digits");
    return;
  }

  if (document.querySelector(".input-error")) {
    alert("Please fix the highlighted errors before submitting.");
    return;
  }

  const requestBody = {
    first_name: firstName,
    midName: midName,
    last_name: lastName,
    email: email,
    phoneNumber: phoneNumber,
    department: department,
    user_type: userType,
    userRole: userRole,
    employID: employID,
  };

  if (employID) {
    try {
      const url = `/accounts/check-employid/?employID=${encodeURIComponent(employID)}`;
      const checkResponse = await fetch(url, {
        method: "GET",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();

        if (checkData.exists) {
          alert("⚠️ This Employee ID already exists in system user or tertiary faculty.");
          return; 
        }
      }
    } catch (error) {
      console.error("Error validating employID:", error);
    }
  }

  if (userType === "TertiaryFaculty") {
    const employmentStatus = document.getElementById("employmentStatus").value;

    if (!employmentStatus) {
      alert("Employment Status is required for Tertiary Faculty");
      return;
    }

    if (!employID) {
      alert("Employee ID is required for Tertiary Faculty");
      return;
    }

    requestBody.employmentStatus = employmentStatus;
    requestBody.password = "cscqcApp123";
  }

  console.log("Submitting registration...");

  fetch("/accounts/register/", {
    method: "POST",
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        closeModal();

        
        document.getElementById("teacherFirst").value = "";
        document.getElementById("teacherMiddle").value = "";
        document.getElementById("teacherLast").value = "";
        document.getElementById("teacherEmail").value = "";
        document.getElementById("teacherContact").value = "";
        document.getElementById("teacherDept").value = "";
        document.getElementById("employmentStatus").value = "";
        document.getElementById("employID").value = "";
        document.getElementById("user-type").value = "";

        alert(`${userType === "SystemUser" ? "System User" : "Tertiary Faculty"} added successfully!`);
        location.reload();
      } else {
        alert("Error adding user: " + (data.error || "Unknown error"));
      }
    })
    .catch(error => {
      console.error("Error:", error);
      alert("Error adding user");
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

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response data:', data);

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

function showNotification(message, type) {
  alert(message);
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
  const passwordType = userType === 'SystemUser' ? 'cscqcSys123' : 'cscqcApp123';
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

document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const userType = urlParams.get('user_type');
  
  document.querySelectorAll('.filters-btn').forEach(btn => {
    btn.classList.remove('filter-active');
  });
  
  document.querySelectorAll('.filters-btn').forEach(btn => {
    const btnUserType = btn.getAttribute('data-filter');
    if (btnUserType === userType) {
      btn.classList.add('filter-active');
    }
  });
  

  if (!userType || userType === 'TertiaryFaculty') {
    document.querySelector('[data-filter="TertiaryFaculty"]').classList.add('filter-active');
  }
});

function filterByUserType(userTypeFilter) {
  if (userTypeFilter) {
    window.location.href = `?user_type=${userTypeFilter}`;
  } else if (userTypeFilter === null) {
    window.location.href = `?user_type=TertiaryFaculty`;
  }
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

    const employID = row.querySelector('.employID')
    const nameCell = row.querySelector('.user-name');
    const employStatus = row.querySelector('.user-employ-status');
    const userDepartment = row.querySelector('.user-department');
    const userRole = row.querySelector('.user-role');
    const userEmail = row.querySelector('.user-email');
    const userPhoneNumber = row.querySelector('.user-phone-number');

    const name = nameCell ? (nameCell.textContent || nameCell.innerText).trim().toLowerCase() : "";
    const id = employID ? (employID.textContent || employID.innerText).trim().toLowerCase() : "";
    const status = employStatus ? (employStatus.textContent || employStatus.innerText).trim().toLowerCase() : "";
    const department = userDepartment ? (userDepartment.textContent || userDepartment.innerText).trim().toLowerCase() : "";
    const role = userRole ? (userRole.textContent || userRole.innerText).trim().toLowerCase() : "";
    const email = userEmail ? (userEmail.textContent || userEmail.innerText).trim().toLowerCase() : "";
    const phoneNumber = userPhoneNumber ? (userPhoneNumber.textContent || userPhoneNumber.innerText).trim().toLowerCase() : "";

    if (name.indexOf(filter) > -1 ) {
      row.style.display = '';
    } else if (id.indexOf(filter) > -1) {
      row.style.display = '';
    } else if (status.indexOf(filter) > -1) {
      row.style.display = '';
    } else if (department.indexOf(filter) > -1) {
      row.style.display = '';
    } else if (role.indexOf(filter) > -1) {
      row.style.display = '';
    } else if (email.indexOf(filter) > -1) {
      row.style.display = '';
    } else if (phoneNumber.indexOf(filter) > -1) {
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

    // Must contain "@"
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

