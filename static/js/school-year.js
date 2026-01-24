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

document.addEventListener('DOMContentLoaded', function () {

  sortTableAlphabetically();
  attachAccessListeners();
  attachPDFListeners();
});

function attachAccessListeners() {
  const accessIcons = document.querySelectorAll('.active-icon, .archived-icon');

  accessIcons.forEach(icon => {
    icon.addEventListener('click', function () {
      const userId = this.getAttribute('data-user-id');
      const userName = this.getAttribute('data-user-name');
      const currentStatus = this.getAttribute('data-is-active') === 'true';

      toggleAccess(this, userId, currentStatus, userName);
    });
  });
}

function attachPDFListeners() {
  const pdfIcons = document.querySelectorAll('.pdf-icon:not(.disabled)');

  pdfIcons.forEach(icon => {
    icon.addEventListener('click', function () {
      if (!this.disabled) {
        downloadArchivedUserReport(this);
      }
    });
  });
}
function sortTableAlphabetically() {
  const tbody = document.querySelector('#accessTable tbody');
  const rows = Array.from(tbody.getElementsByTagName('tr'));

  rows.sort((a, b) => {
    const nameA = a.querySelector('.user_name').textContent.trim().toLowerCase();
    const nameB = b.querySelector('.user_name').textContent.trim().toLowerCase();
    return nameA.localeCompare(nameB);
  });
  tbody.innerHTML = '';
  rows.forEach(row => tbody.appendChild(row));
}
function toggleAccess(icon, userId, currentStatus, userName) {
  const newStatus = !currentStatus;
  const actionText = newStatus ? 'Activate' : 'Archive';
  const confirmed = confirm(`Do you want to ${actionText} ${userName}?`);

  if (confirmed) {

    icon.disabled = true;
    const originalHTML = icon.innerHTML;
    icon.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span>';

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

          const row = icon.closest('tr');
          const accessCell = row.querySelector('.access-actions-cell');
          const employId = row.querySelector('.employID').textContent;
          const department = row.querySelector('.user-department').textContent;
          if (newStatus) {

            accessCell.innerHTML = `
            <div class="access-icons-container">
              <button class="icon-btn active-icon"
                      data-user-id="${userId}"
                      data-user-name="${userName}"
                      data-is-active="true"
                      title="Active - Click to Archive">
                <span class="material-symbols-outlined">check_circle</span>
              </button>
              <button class="icon-btn pdf-icon disabled"
                      disabled
                      title="No reports available for active users">
                <span class="material-symbols-outlined">picture_as_pdf</span>
              </button>
            </div>
          `;
          } else {

            accessCell.innerHTML = `
            <div class="access-icons-container">
              <button class="icon-btn archived-icon"
                      data-user-id="${userId}"
                      data-user-name="${userName}"
                      data-is-active="false"
                      title="Archived - Click to Activate">
                <span class="material-symbols-outlined">cancel</span>
              </button>
              <button class="icon-btn pdf-icon"
                      data-user-id="${userId}"
                      data-user-name="${userName}"
                      data-employ-id="${employId}"
                      data-department="${department}"
                      title="Download Performance Report">
                <span class="material-symbols-outlined">picture_as_pdf</span>
              </button>
            </div>
          `;
          }
          attachAccessListeners();
          attachPDFListeners();

          alert(`User ${newStatus ? 'activated' : 'archived'} successfully!`);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      })
      .catch(error => {
        console.error('Error updating access:', error);
        icon.disabled = false;
        icon.innerHTML = originalHTML;
        alert('Error updating status. Please try again.\n' + error.message);
      });
  }
}
function filterTable() {
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const searchValue = searchInput.value.toLowerCase();
  const statusValue = statusFilter.value;
  const tbody = document.querySelector('#accessTable tbody');
  const rows = tbody.getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.querySelector('td[colspan]')) {
      continue;
    }

    const employID = row.querySelector('.employID');
    const nameCell = row.querySelector('.user_name');
    const userDepartment = row.querySelector('.user-department');
    const accessIcon = row.querySelector('.active-icon, .archived-icon');

    const name = nameCell ? (nameCell.textContent || nameCell.innerText).trim().toLowerCase() : "";
    const id = employID ? (employID.textContent || employID.innerText).trim().toLowerCase() : "";
    const department = userDepartment ? (userDepartment.textContent || userDepartment.innerText).trim().toLowerCase() : "";
    const isActive = accessIcon ? accessIcon.classList.contains('active-icon') : false;
    const searchMatch = name.indexOf(searchValue) > -1 ||
      id.indexOf(searchValue) > -1 ||
      department.indexOf(searchValue) > -1;
    let statusMatch = true;
    if (statusValue === 'active') {
      statusMatch = isActive;
    } else if (statusValue === 'archived') {
      statusMatch = !isActive;
    }
    if (searchMatch && statusMatch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  }
}
function formatDateToReadable(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}
async function downloadArchivedUserReport(icon) {
  const userId = icon.getAttribute('data-user-id');
  const userName = icon.getAttribute('data-user-name');
  const employId = icon.getAttribute('data-employ-id');
  const department = icon.getAttribute('data-department');
  icon.disabled = true;
  const originalHTML = icon.innerHTML;
  icon.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span>';
  icon.classList.add('loading');

  try {
    console.log('🔍 Fetching all-time attendance data for user:', userId);
    const response = await fetch(`/get_archived_user_report/?user_id=${userId}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch attendance data');
    }

    console.log('📊 Attendance data received:', data);

    if (!data.data || data.data.length === 0) {
      alert(`No attendance data found for ${userName}`);
      icon.disabled = false;
      icon.innerHTML = originalHTML;
      icon.classList.remove('loading');
      return;
    }

    const userData = data.data[0];
    await generateArchivedUserPDF(userData, userName, employId, department, data.start_date, data.end_date, data.history);

    console.log('✅ PDF generated successfully');

  } catch (error) {
    console.error('❌ Error downloading report:', error);
    alert('Error generating report: ' + error.message);
  } finally {
    icon.disabled = false;
    icon.innerHTML = originalHTML;
    icon.classList.remove('loading');
  }
}
async function generateArchivedUserPDF(userData, userName, employId, department, startDate, endDate, attendanceHistory) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const formattedStart = formatDateToReadable(startDate);
  const formattedEnd = formatDateToReadable(endDate);
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(`${userName}`, 105, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.text('All-Time Performance Report (ARCHIVED)', 105, 25, { align: 'center' });

  doc.setFontSize(11);
  doc.text('CSCQC Faculty Attendance System', 105, 30, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text('Faculty Member Information', 14, 55);

  doc.setFontSize(11);
  doc.setTextColor(51, 51, 51);
  doc.text(`Employee ID: ${employId}`, 14, 65);
  doc.text(`Department: ${department}`, 14, 72);
  doc.text(`Report Period: ${formattedStart} to ${formattedEnd}`, 14, 79);
  doc.text(`Status: ARCHIVED`, 14, 86);
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text('Percentage Breakdown', 14, 100);

  const presentDays = userData.present_count || 0;
  const absentDays = userData.absent_count || 0;
  const lateDays = userData.late_count || 0;

  doc.autoTable({
    startY: 110,
    head: [['Category', 'Percentage', 'Count']],
    body: [
      ['Present', `${userData.present_percentage || 0}%`, `${presentDays} days`],
      ['Absent', `${userData.absent_percentage || 0}%`, `${absentDays} days`],
      ['Late', `${userData.late_percentage || 0}%`, `${lateDays} days`],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'center' },
      2: { halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });
  doc.setFontSize(12);
  doc.setTextColor(51, 51, 51);
  doc.text(`TOTAL CLASSES: `, 14, 150);

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(`${userData.total_classes || 0}`, 52, 150);

  const classTextWidth = doc.getTextWidth(`${userData.total_classes || 0}`);
  doc.setDrawColor(51, 51, 51);
  doc.line(52, 151, 52 + classTextWidth, 151);

  doc.setFont(undefined, 'normal');

  doc.setFontSize(12);
  doc.text(`TOTAL HOURS: `, 14, 157);

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(`${(userData.total_hours || 0).toFixed(1)}`, 48, 157);

  const hoursTextWidth = doc.getTextWidth(`${(userData.total_hours || 0).toFixed(1)}`);
  doc.line(48, 158, 48 + hoursTextWidth, 158);

  doc.setFont(undefined, 'normal');
  const performance = userData.performance || { classification: 'N/A', score: 0 };
  doc.setFontSize(12);
  doc.text(`PERFORMANCE ANALYSIS: `, 14, 164);

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(`${performance.classification}`, 72, 164);

  const paTextWidth = doc.getTextWidth(`${performance.classification}`);
  doc.line(72, 165, 72 + paTextWidth, 165);

  doc.setFont(undefined, 'normal');
  if (attendanceHistory && attendanceHistory.length > 0) {
    doc.addPage();

    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Detailed Attendance History', 14, 20);

    const historyTableData = attendanceHistory.map(record => {
      const date = new Date(record.date + 'T00:00:00');
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      let statusText = record.status.charAt(0).toUpperCase() + record.status.slice(1);
      let lateReason = record.late_reason || 'N/A';
      if (record.status.toLowerCase() !== 'late') {
        lateReason = '-';
      }

      return [
        formattedDate,
        record.subject_code || 'N/A',
        record.subject_name || 'N/A',
        record.room || 'N/A',
        record.time_in || 'N/A',
        record.time_out || 'N/A',
        statusText,
        lateReason
      ];
    });

    doc.autoTable({
      startY: 30,
      head: [['Date', 'Subject Code', 'Subject', 'Room', 'Time In', 'Time Out', 'Status', 'Late Reason']],
      body: historyTableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 20 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'left', cellWidth: 32 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
        7: { halign: 'left', cellWidth: 30 }
      },
      didParseCell: function (data) {
        if (data.column.index === 6 && data.section === 'body') {
          const status = data.cell.raw.toLowerCase();
          if (status === 'present') {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (status === 'absent') {
            data.cell.styles.textColor = [239, 68, 68];
          } else if (status === 'late') {
            data.cell.styles.textColor = [245, 158, 11];
          }
        }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });
  } else {
    doc.setFontSize(11);
    doc.setTextColor(128, 128, 128);
    doc.text('No detailed attendance records found.', 14, 175);
  }
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);

    doc.text(
      `Page ${i} of ${pageCount}`,
      105,
      pageHeight - 10,
      { align: 'center' }
    );

    if (i === pageCount) {
      doc.text(
        `Generated on ${new Date().toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        14,
        pageHeight - 10
      );
    }
  }
  const filename = `${userName.replace(/\s+/g, '_')}_Archived_Performance_Report.pdf`;
  doc.save(filename);

  console.log('📄 PDF exported:', filename);
}