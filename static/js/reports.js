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

let currentReportData = [];
let startDatePicker, endDatePicker;


function formatDateToReadable(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}


function initializeDatePickers() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    startDatePicker = flatpickr("#start-date", {
        locale: {
            firstDayOfWeek: 1
        },
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        defaultDate: todayStr,
        onChange: function (selectedDates, dateStr, instance) {
            console.log('Start date changed:', dateStr);

            if (endDatePicker && dateStr) {
                endDatePicker.set('minDate', dateStr);
            }

            const endDate = document.getElementById('end-date').value;
            if (dateStr && endDate) {
                updateReportPeriod(dateStr, endDate);
                generateReport();
            }
        }
    });


    endDatePicker = flatpickr("#end-date", {
        locale: {
            firstDayOfWeek: 1
        },
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        defaultDate: todayStr,
        minDate: todayStr,
        onChange: function (selectedDates, dateStr, instance) {
            console.log('End date changed:', dateStr);


            const startDate = document.getElementById('start-date').value;
            if (startDate && dateStr) {
                updateReportPeriod(startDate, dateStr);
                generateReport();
            }
        }
    });


    updateReportPeriod(todayStr, todayStr);
}

function updateReportPeriod(startDate, endDate) {
    const reportPeriod = document.getElementById('reportPeriod');
    const reportInfo = document.getElementById('reportInfo');

    if (reportPeriod && startDate && endDate) {

        const formattedStart = formatDateToReadable(startDate);
        const formattedEnd = formatDateToReadable(endDate);

        reportPeriod.textContent = `${formattedStart} to ${formattedEnd}`;
        console.log('Report period updated:', `${formattedStart} to ${formattedEnd}`);
    }

    if (reportInfo && startDate && endDate) {
        reportInfo.style.display = 'flex';
    }
}

function toggleRowDetails(tr, row) {
    const detailRowId = `detail-${row.employID}`;
    const existingDetailRow = document.getElementById(detailRowId);

    if (existingDetailRow) {
        existingDetailRow.remove();
        tr.classList.remove('expanded');
        return;
    }

    document.querySelectorAll('.detail-row').forEach(dr => dr.remove());
    document.querySelectorAll('tr.expanded').forEach(r => r.classList.remove('expanded'));

    tr.classList.add('expanded');

    const totalDays = calculateTotalDays();
    const presentDays = row.present_count;
    const absentDays = row.absent_count;
    const lateDays = row.late_count;

    const detailRow = document.createElement('tr');
    detailRow.id = detailRowId;
    detailRow.className = 'detail-row';
    detailRow.innerHTML = `
        <td colspan="8" style="padding: 0; background: #f8fafc;">
            <div style="padding: 20px 30px; border-top: 2px solid #e2e8f0;">
                <!-- Performance Score Card -->
                <div style="
                    background: linear-gradient(135deg, ${row.performance.color}22 0%, ${row.performance.color}11 100%);
                    padding: 20px;
                    border-radius: 12px;
                    border: 2px solid ${row.performance.color};
                    margin-bottom: 20px;
                    text-align: center;
                ">
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Performance Rating</div>
                    <div style="font-size: 48px; font-weight: bold; color: ${row.performance.color};">
                        ${row.performance.classification}
                    </div>
                    <div style="font-size: 18px; color: #64748b; margin-top: 4px;">
                        Score: ${row.performance.score}/100
                    </div>
                    <div style="
                        margin-top: 12px;
                        padding-top: 12px;
                        border-top: 1px solid ${row.performance.color}33;
                        font-size: 12px;
                        color: #64748b;
                    ">
                        Based on: Attendance Rate (50%) + Punctuality Rate (30%) + Consistency Score (20%)
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Total Present</div>
                        <div style="font-size: 32px; font-weight: bold;">${presentDays}</div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">days</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 20px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Total Absent</div>
                        <div style="font-size: 32px; font-weight: bold;">${absentDays}</div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">days</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Total Late</div>
                        <div style="font-size: 32px; font-weight: bold;">${lateDays}</div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">days</div>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 20px; border-radius: 12px; color: white; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">Total Hours</div>
                        <div style="font-size: 32px; font-weight: bold;">${row.total_hours.toFixed(1)}</div>
                        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">hours worked</div>
                    </div>
                </div>

                <div style="display: flex; gap: 20px; margin-top: 20px;">
                    <!-- PIE CHART -->
                    <div id="pieChart_${row.uid}" 
                        style="background: white; border-radius: 8px; 
                            padding: 10px; width: 50%;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
                            display: flex; justify-content: center;">
                    </div>

                    <!-- ATTENDANCE HISTORY TABLE -->
                    <div id="attendanceHistory_${row.uid}"
                        style="background: white; border-radius: 8px; 
                            padding: 10px; width: 50%; 
                            max-height: 350px; overflow-y: auto;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            scrollbar-width: thin; scrollbar-color: #9ca3af #f1f5f9;">
                        <h3 style="font-size: 16px; margin-bottom: 10px; color: #1e293b;">
                            Attendance Records
                        </h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="background: #3b7bfaff;">
                                    <th style="padding: 8px; border: 1px solid #3b7bfaff;">Date</th>
                                    <th style="padding: 8px; border: 1px solid #3b7bfaff;">Room</th>
                                    <th style="padding: 8px; border: 1px solid #3b7bfaff;">IN</th>
                                    <th style="padding: 8px; border: 1px solid #3b7bfaff;">OUT</th>
                                    <th style="padding: 8px; border: 1px solid #3b7bfaff;">Status</th>
                                </tr>
                            </thead>
                            <tbody id="attendanceRows_${row.uid}">
                                <tr>
                                    <td colspan="5" 
                                        style="text-align:center; padding: 20px; color:#94a3b8;">
                                        Loading...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #2563eb; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 30px;">
                        <div><strong style="color: #1e293b;">Employee:</strong> <span style="color: #64748b;">${row.full_name} (${row.employID || 'N/A'})</span></div>
                        <div><strong style="color: #1e293b;">Department:</strong> <span style="color: #64748b;">${row.department}</span></div>
                        <div><strong style="color: #1e293b;">Report Period:</strong> <span style="color: #64748b;">${document.getElementById('reportPeriod').textContent}</span></div>
                    </div>
                    <button 
                        onclick='exportSingleProfessorToPDF(${JSON.stringify(row).replace(/'/g, "&apos;")})' 
                        style="background: #dc2626; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: background 0.2s;"
                        onmouseover="this.style.background='#b91c1c'"
                        onmouseout="this.style.background='#dc2626'">
                        <span>📄</span> Export to PDF
                    </button>
                </div>
            </div>
        </td>
    `;

    tr.after(detailRow);

    setTimeout(() => {
        createPieChart(`pieChart_${row.uid}`, presentDays, absentDays, lateDays);
    }, 0);

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    loadAttendanceHistory(row.uid, startDate, endDate, `attendanceRows_${row.uid}`);

    detailRow.style.opacity = '0';
    setTimeout(() => {
        detailRow.style.transition = 'opacity 0.3s ease';
        detailRow.style.opacity = '1';
    }, 10);
}

async function loadAttendanceHistory(uid, startDate, endDate, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>`;

    const url = `/get_professor_attendance_history/?professor_uid=${uid}&start_date=${startDate}&end_date=${endDate}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success || data.history.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="padding:10px; text-align:center; color:#94a3b8;">No records found</td></tr>`;
            return;
        }

        tbody.innerHTML = '';

        data.history.forEach(record => {
            const date = new Date(record.date + 'T00:00:00').toLocaleDateString('en-US');
            const status = record.status.charAt(0).toUpperCase() + record.status.slice(1);

            let color = '#10b981';
            if (status === 'Absent') color = '#ef4444';
            else if (status === 'Late') color = '#f59e0b';

            tbody.innerHTML += `
                <tr>
                    <td style="border:1px solid #e5e7eb; padding:6px;">${date}</td>
                    <td style="border:1px solid #e5e7eb; padding:6px;">${record.room}</td>
                    <td style="border:1px solid #e5e7eb; padding:6px;">${record.time_in}</td>
                    <td style="border:1px solid #e5e7eb; padding:6px;">${record.time_out}</td>
                    <td style="border:1px solid #e5e7eb; padding:6px; font-weight:600; color:${color};">
                        ${status}
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:10px; text-align:center; color:#ef4444;">Error loading history</td></tr>`;
        console.error(err);
    }
}


function createPieChart(elementId, presentDays, absentDays, lateDays) {

    const total = presentDays + absentDays + lateDays;

    const presentPercent = (presentDays / total) * 100;
    const absentPercent = (absentDays / total) * 100;
    const latePercent = (lateDays / total) * 100;

    const presentAngle = (presentPercent / 100) * 360;
    const absentAngle = (absentPercent / 100) * 360;
    const lateAngle = (latePercent / 100) * 360;

    const size = 200;
    const center = size / 2;
    const radius = 80;

    function getSlicePath(startAngle, endAngle) {
        const start = polarToCartesian(center, center, radius, endAngle);
        const end = polarToCartesian(center, center, radius, startAngle);
        const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

        return [
            'M', center, center,
            'L', start.x, start.y,
            'A', radius, radius, 0, largeArc, 0, end.x, end.y,
            'Z'
        ].join(' ');
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    let svgContent = '';

    if (presentPercent === 100) {
        svgContent = `
            <circle cx="${center}" cy="${center}" r="${radius}" 
                    fill="#10b981" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                <title>Present: ${presentDays} days (100%)</title>
            </circle>`;
    } else if (absentPercent === 100) {
        svgContent = `
            <circle cx="${center}" cy="${center}" r="${radius}" 
                    fill="#ef4444" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                <title>Absent: ${absentDays} days (100%)</title>
            </circle>`;
    } else if (latePercent === 100) {
        svgContent = `
            <circle cx="${center}" cy="${center}" r="${radius}" 
                    fill="#f59e0b" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                <title>Late: ${lateDays} days (100%)</title>
            </circle>`;
    } else if (total === 0) {
        svgContent = `
            <circle cx="${center}" cy="${center}" r="${radius}" 
                    fill="#c4c3c3ff" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                <title>Late: ${lateDays} days (100%)</title>
            </circle>`;
    } else {
        let currentAngle = 0;

        if (presentDays > 0) {
            const presentPath = getSlicePath(currentAngle, currentAngle + presentAngle);
            svgContent += `
                <path d="${presentPath}" 
                    fill="#10b981" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                    <title>Present: ${presentDays} days (${presentPercent.toFixed(1)}%)</title>
                </path>`;
            currentAngle += presentAngle;
        }

        if (absentDays > 0) {
            const absentPath = getSlicePath(currentAngle, currentAngle + absentAngle);
            svgContent += `
                <path d="${absentPath}" 
                    fill="#ef4444" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                    <title>Absent: ${absentDays} days (${absentPercent.toFixed(1)}%)</title>
                </path>`;
            currentAngle += absentAngle;
        }

        if (lateDays > 0) {
            const latePath = getSlicePath(currentAngle, currentAngle + lateAngle);
            svgContent += `
                <path d="${latePath}" 
                    fill="#f59e0b" 
                    stroke="white" 
                    stroke-width="2"
                    style="transition: opacity 0.3s; cursor: pointer;"
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                    <title>Late: ${lateDays} days (${latePercent.toFixed(1)}%)</title>
                </path>`;
        }
    }

    const chartHTML = `
        <div style="display: flex; align-items: center; gap: 30px; padding: 20px;">
            <!-- Pie Chart SVG -->
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                ${svgContent}
                
                <!-- Center circle for donut effect -->
                <circle cx="${center}" cy="${center}" r="40" fill="white"/>
                
                <!-- Total text in center -->
                <text x="${center}" y="${center - 5}" 
                    text-anchor="middle" 
                    font-size="24" 
                    font-weight="bold" 
                    fill="#1e293b">${total}</text>
                <text x="${center}" y="${center + 15}" 
                    text-anchor="middle" 
                    font-size="12" 
                    fill="#64748b">total days</text>
            </svg>
            
            <!-- Legend -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 16px; height: 16px; background: #10b981; border-radius: 3px;"></div>
                    <span style="font-size: 14px; color: #1e293b;">
                        <strong>Present:</strong> ${presentDays} days (${presentPercent.toFixed(1)}%)
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 16px; height: 16px; background: #ef4444; border-radius: 3px;"></div>
                    <span style="font-size: 14px; color: #1e293b;">
                        <strong>Absent:</strong> ${absentDays} days (${absentPercent.toFixed(1)}%)
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 16px; height: 16px; background: #f59e0b; border-radius: 3px;"></div>
                    <span style="font-size: 14px; color: #1e293b;">
                        <strong>Late:</strong> ${lateDays} days (${latePercent.toFixed(1)}%)
                    </span>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById(elementId);
    if (container) {
        container.innerHTML = chartHTML;
        console.log('Pie chart created successfully!');
    } else {
        console.error('Container not found:', elementId);
    }
}

async function exportSingleProfessorToPDF(row) {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const formattedStart = formatDateToReadable(startDate);
    const formattedEnd = formatDateToReadable(endDate);


    const totalDays = calculateTotalDays();
    const presentDays = Math.round((row.present_percentage / 100) * totalDays);
    const absentDays = Math.round((row.absent_percentage / 100) * totalDays);
    const lateDays = Math.round((row.late_percentage / 100) * totalDays);


    let attendanceHistory = [];
    try {
        const professorUid = row.uid;
        const historyUrl = `/get_professor_attendance_history/?professor_uid=${professorUid}&start_date=${startDate}&end_date=${endDate}`;
        console.log('📡 Fetching history from:', historyUrl);

        const historyResponse = await fetch(historyUrl);

        
        if (!historyResponse.ok) {
            throw new Error(`HTTP ${historyResponse.status}: ${historyResponse.statusText}`);
        }

        const historyData = await historyResponse.json();

        console.log('📦 History response:', historyData);

        if (historyData.success && historyData.history) {
            attendanceHistory = historyData.history;
            console.log('✅ Attendance history loaded:', attendanceHistory.length, 'records');
        } else {
            console.error('❌ History fetch failed:', historyData.error || 'No data returned');
            attendanceHistory = []; 
        }
    } catch (error) {
        console.error('❌ Error fetching attendance history:', error);
        attendanceHistory = []; 
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('📊 Final attendance history count:', attendanceHistory.length);


    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();


    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text(`${row.full_name}`, 105, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.text('Individual Attendance Report', 105, 25, { align: 'center' });

    doc.setFontSize(11);
    doc.text('CSCQC Faculty Attendance System', 105, 30, { align: 'center' });


    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Faculty Member Information', 14, 55);

    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    doc.text(`Employee ID: ${row.employID}`, 14, 65);
    doc.text(`Department: ${row.department}`, 14, 72);
    doc.text(`Report Period: ${formattedStart} to ${formattedEnd}`, 14, 79);


    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Percentage Breakdown', 14, 95);

    doc.autoTable({
        startY: 105,
        head: [['Category', 'Percentage', 'Count']],
        body: [
            ['Present', `${row.present_percentage}%`, `${presentDays} days`],
            ['Absent', `${row.absent_percentage}%`, `${absentDays} days`],
            ['Late', `${row.late_percentage}%`, `${lateDays} days`],
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
    doc.text(`TOTAL CLASSES: `, 14, 145);

    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text(`${row.total_classes}`, 52, 145);

    const classTextWidth = doc.getTextWidth(`${row.total_classes}`);
    doc.setDrawColor(51, 51, 51);
    doc.line(52, 146, 52 + classTextWidth, 146);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(12);
    doc.setTextColor(51, 51, 51);
    doc.text(`TOTAL HOURS: `, 14, 152);

    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text(`${row.total_hours}`, 48, 152);

    const hoursTextWidth = doc.getTextWidth(`${row.total_hours}`);
    doc.setDrawColor(51, 51, 51);
    doc.line(48, 153, 48 + hoursTextWidth, 153);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(12);
    doc.setTextColor(51, 51, 51);
    doc.text(`PERFORMANCE ANALYSIS: `, 14, 159);

    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(51, 51, 51);
    doc.text(`${row.performance.classification}`, 72, 159);

    const paTextWidth = doc.getTextWidth(`${row.performance.classification}`);
    doc.setDrawColor(51, 51, 51);
    doc.line(72, 160, 72 + paTextWidth, 160);

    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);

    if (attendanceHistory.length > 0) {

        let currentY = 173;
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        } else {
            currentY += 10;
        }

        const historyStartY = currentY + 10;

        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text('Detailed Attendance History', 14, 200);

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
                record.subject_code,
                record.subject_name,
                record.room,
                record.time_in,
                record.time_out,
                statusText,
                lateReason
            ];
        });

        doc.autoTable({
            startY: historyStartY,
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
                    if (status === 'approved' || status === 'present') {
                        data.cell.styles.textColor = [16, 185, 129];
                    } else if (status === 'pending') {
                        data.cell.styles.textColor = [245, 158, 11];
                    } else if (status === 'rejected' || status === 'absent') {
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

        const currentY = 173;
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text('Detailed Attendance History', 14, currentY);

        doc.setFontSize(11);
        doc.setTextColor(128, 128, 128);
        doc.text('No attendance records found for this period.', 14, currentY + 15);


        doc.setFontSize(9);
        doc.text(`Searched for UID: ${row.uid}`, 14, currentY + 25);
        doc.text(`Date range: ${startDate} to ${endDate}`, 14, currentY + 32);
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


    const filename = `${row.full_name.replace(/\s+/g, '_')}_Attendance_${startDate}_to_${endDate}.pdf`;
    doc.save(filename);

    console.log('Individual professor PDF with history exported:', filename);
}

function calculateTotalDays() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) return 1;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays;
}

async function generateReport() {
    const department = document.getElementById('department').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    console.log('Generating report with:', { startDate, endDate, department });

    if (!startDate || !endDate) {
        console.warn('Missing dates:', { startDate, endDate });
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        alert('Start date cannot be after end date');
        return;
    }

    const tableBody = document.getElementById('reportTableBody');
    const reportInfo = document.getElementById('reportInfo');
    const reportPeriod = document.getElementById('reportPeriod');

    if (!tableBody) {
        console.error('reportTableBody not found');
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">Loading...</td></tr>';

    try {
        const url = `/get_attendance_report/?start_date=${startDate}&end_date=${endDate}&department=${department}`;
        console.log('Fetching:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log("Data: ", data);

        console.log('Response received:', data);

        if (data.success) {
            currentReportData = data.data;

            console.log("Report Data", currentReportData);

            currentReportData = currentReportData.map(row => {
                const performance = calculatePerformance(
                    row.total_classes,
                    row.present_count,
                    row.absent_count,
                    row.late_count,
                    row.attendance_pattern
                );
                return { ...row, performance };
            });

            currentReportData.sort((a, b) => {
                const nameA = a.full_name.toLowerCase();
                const nameB = b.full_name.toLowerCase();
                return nameA.localeCompare(nameB);
            });
            
            if (reportPeriod && data.start_date && data.end_date) {
                const formattedStart = formatDateToReadable(data.start_date);
                const formattedEnd = formatDateToReadable(data.end_date);
                reportPeriod.textContent = `${formattedStart} to ${formattedEnd}`;
            }
            if (reportInfo) {
                reportInfo.style.display = 'flex';
            }


            if (data.data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">No data found for this period</td></tr>';
                return;
            }

            tableBody.innerHTML = '';
            currentReportData.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.style.transition = 'background 0.2s';

                tr.innerHTML = `
                    <td>${row.employID || 'N/A'}</td>
                    <td style="font-weight: 500;">${row.full_name}</td>
                    <td>${row.department}</td>
                    <td style="color: ${row.present_percentage > 0 ? ' #10b981' : '#000'}; font-weight: ${row.present_percentage > 0 ? '600' : '300'};">${row.present_percentage}%</td>
                    <td style="color: ${row.absent_percentage > 0 ? ' #ef4444' : '#000'}; font-weight: ${row.absent_percentage > 0 ? '600' : '300'};">${row.absent_percentage}%</td>
                    <td style="color: ${row.late_percentage > 0 ? ' #f59e0b' : '#000'}; font-weight: ${row.late_percentage > 0 ? '600' : '300'};">${row.late_percentage}%</td>
                    <td style="font-weight: 600;">${row.total_hours.toFixed(2)} hrs</td>
                    <td>
                        <div style="
                            display: inline-block;
                            padding: 6px 12px;
                            border-radius: 6px;
                            font-weight: 600;
                            font-size: 12px;
                            background: ${row.performance.bgColor};
                            color: ${row.performance.color};
                            border: 1px solid ${row.performance.color}33;
                        ">
                            ${row.performance.classification}
                            <span style="font-size: 10px; opacity: 0.8;">(${row.performance.score})</span>
                        </div>
                    </td>
                `;


                tr.addEventListener('click', () => toggleRowDetails(tr, row));


                tr.addEventListener('mouseenter', () => {
                    if (!tr.classList.contains('expanded')) {
                        tr.style.background = '#f8fafc';
                    }
                });
                tr.addEventListener('mouseleave', () => {
                    if (!tr.classList.contains('expanded')) {
                        tr.style.background = '';
                    }
                });

                tableBody.appendChild(tr);
            });

            console.log('Table populated with', data.data.length, 'rows');
        } else {
            alert('Error: ' + data.error);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">Error loading report</td></tr>';
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error generating report');
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">Error loading report</td></tr>';
    }
}

function exportToPDF() {
    if (currentReportData.length === 0) {
        alert('Please generate a report first');
        return;
    }

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const department = document.getElementById('department').value;

    const formattedStart = formatDateToReadable(startDate);
    const formattedEnd = formatDateToReadable(endDate);


    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');


    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('CSCQC Attendance Report', 14, 20);


    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    doc.text(`Report Period: ${formattedStart} to ${formattedEnd}`, 14, 30);
    doc.text(`Department: ${department === 'all' ? 'All Departments' : department}`, 14, 37);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`, 14, 44);


    const tableData = currentReportData.map(row => [
        row.employID || 'N/A',
        row.full_name,
        row.department,
        `${row.present_percentage}%`,
        `${row.absent_percentage}%`,
        `${row.late_percentage}%`,
        `${row.total_hours.toFixed(2)} hrs`,
        `${row.performance.classification}`
    ]);


    doc.autoTable({
        head: [['Employee ID', 'Name', 'Department', 'Present %', 'Absent %', 'Late %', 'Total Hours', 'Performance Analysis']],
        body: tableData,
        startY: 52,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 4,
        },
        headStyles: {
            fillColor: [37, 99, 235],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 25 },
            1: { halign: 'left', cellWidth: 45 },
            2: { halign: 'left', cellWidth: 35 },
            3: { halign: 'center', textColor: [16, 185, 129], cellWidth: 22 },
            4: { halign: 'center', textColor: [239, 68, 68], cellWidth: 22 },
            5: { halign: 'center', textColor: [245, 158, 11], cellWidth: 22 },
            6: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
            7: { halign: 'center', fontStyle: 'bold', cellWidth: 38 }
        },
        didParseCell: function (data) {
            if (data.column.index === 7 && data.section === 'body') {
                const text = data.cell.text[0];
                if (text.includes('Excellent')) {
                    data.cell.styles.textColor = [5, 150, 105];
                } else if (text.includes('Good')) {
                    data.cell.styles.textColor = [8, 145, 178];
                } else if (text.includes('Average')) {
                    data.cell.styles.textColor = [217, 119, 6];
                } else if (text.includes('Needs Improvement')) {
                    data.cell.styles.textColor = [220, 38, 38];
                }
            }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        margin: { top: 52, left: 14, right: 14 }
    });


    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Page ${i} of ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }


    const filename = `Attendance_Report_${startDate}_to_${endDate}.pdf`;
    doc.save(filename);

    console.log('PDF exported:', filename);
}


window.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing reports page...');
    initializeDatePickers();


    setTimeout(() => {
        generateReport();
    }, 100);
});

function calculatePerformance(total_classes, present_count, absent_count, late_count, attendance_pattern) {
    
    total_classes = Number(total_classes) || 0;
    present_count = Number(present_count) || 0;
    late_count = Number(late_count) || 0;
    absent_count = Number(absent_count) || 0;

    if (total_classes === 0) {
        return {
            score: '0.0',
            classification: 'No Data',
            color: '#6b7280',
            bgColor: '#f3f4f6',
            breakdown: {
                attendance: '0.0',
                punctuality: '0.0',
                consistency: '0.0'
            }
        };
    }

    if (!attendance_pattern || attendance_pattern.length === 0) {
        attendance_pattern = Array(total_classes).fill('absent');
    }

    const totalAttendedClass = present_count + late_count;

    
    const attendanceRate = (totalAttendedClass / total_classes) * 100;

    
    const punctualityRate = totalAttendedClass > 0
        ? (present_count / totalAttendedClass) * 100
        : 0;

    
    const consistencyScore = calculateConsistency(attendance_pattern);

    const score = (attendanceRate * 0.5) +
        (punctualityRate * 0.3) +
        (consistencyScore * 0.2);

    let classification = '';
    let color = '';
    let bgColor = '';

    if (score >= 90) {
        classification = 'Excellent';
        color = '#059669';
        bgColor = '#d1fae5';
    } else if (score >= 75) {
        classification = 'Good';
        color = '#0891b2';
        bgColor = '#cffafe';
    } else if (score >= 60) {
        classification = 'Average';
        color = '#d97706';
        bgColor = '#fef3c7';
    } else {
        classification = 'Needs Improvement';
        color = '#dc2626';
        bgColor = '#fee2e2';
    }

    return {
        score: score.toFixed(1),
        classification: classification,
        color: color,
        bgColor: bgColor,
        breakdown: {
            attendance: attendanceRate.toFixed(1),
            punctuality: punctualityRate.toFixed(1),
            consistency: consistencyScore.toFixed(1)
        }
    };
}

function calculateConsistency(attendancePattern) {
    if (!attendancePattern || attendancePattern.length === 0) {
        return 0;
    }

    
    let currentStreak = 0;
    let streaks = [];
    let absenceCount = 0;

    for (let i = 0; i < attendancePattern.length; i++) {
        const status = attendancePattern[i];

        if (status === 'present' || status === 'late') {
            currentStreak++;
        } else if (status === 'absent') {
            if (currentStreak > 0) {
                streaks.push(currentStreak);
                currentStreak = 0;
            }
            absenceCount++;
        }
    }

    
    if (currentStreak > 0) {
        streaks.push(currentStreak);
    }

    
    if (absenceCount === 0) {
        return 100;
    }

    const absenceRate = (absenceCount / attendancePattern.length) * 100;
    const absenceScore = 100 - absenceRate;

    const avgStreak = streaks.length > 0
        ? streaks.reduce((sum, s) => sum + s, 0) / streaks.length
        : 0;

    const maxPossibleStreak = attendancePattern.length;
    const streakScore = (avgStreak / maxPossibleStreak) * 100;

    const consistencyScore = (absenceScore * 0.7) + (streakScore * 0.3);

    return Math.min(100, Math.max(0, consistencyScore));
}