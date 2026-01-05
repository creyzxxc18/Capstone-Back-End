function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const csrftoken = getCookie('csrftoken');

document.addEventListener('DOMContentLoaded', function() {
  const accessButtons = document.querySelectorAll('.access-btn');
  
  accessButtons.forEach(button => {
    button.addEventListener('click', function() {
      const userId = this.getAttribute('data-user-id');
      const userName = this.getAttribute('data-user-name');
      const currentStatus = this.getAttribute('data-is-active') === 'true';
      
      toggleAccess(this, userId, currentStatus, userName);
    });
  });
});

// Toggle access 
function toggleAccess(button, userId, currentStatus, userName) {
  const newStatus = !currentStatus;
  const actionText = newStatus ? 'Enable' : 'Disable';
  
  // Show confirmation dialog
  const confirmed = confirm(`Do you want to ${actionText} access for ${userName}?`);
  
  if (confirmed) {
    // Disable button 
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Updating...';
    
    fetch('/toggle_user_access/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken
      },
      body: JSON.stringify({
        user_id: userId,
        is_active: newStatus
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {

        button.disabled = false;
        button.classList.remove('enabled', 'disabled');
        button.classList.add(newStatus ? 'enabled' : 'disabled');
        button.textContent = newStatus ? 'ENABLED' : 'DISABLED';
        button.setAttribute('data-is-active', newStatus);
        
        alert(`Access ${newStatus ? 'enabled' : 'disabled'} successfully for ${userName}!`);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    })
    .catch(error => {
      console.error('Error updating access:', error);
      button.disabled = false;
      button.textContent = originalText;
      alert('Error updating access. Please try again.\n' + error.message);
    });
  }
}

function searchTable() {
  const input = document.getElementById('searchInput');
  const filter = input.value.toLowerCase();
  const tbody = document.querySelector('#accessTable tbody');
  const rows = tbody.getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.querySelector('td[colspan]')) {
      continue;
    }

    const employID = row.querySelector('.employID')
    const nameCell = row.querySelector('.user-name');
    const userDepartment = row.querySelector('.user-department');

    const name = nameCell ? (nameCell.textContent || nameCell.innerText).trim().toLowerCase() : "";
    const id = employID ? (employID.textContent || employID.innerText).trim().toLowerCase() : "";
    const department = userDepartment ? (userDepartment.textContent || userDepartment.innerText).trim().toLowerCase() : "";
  

    if (name.indexOf(filter) > -1 ) {
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