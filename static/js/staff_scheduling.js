const calendarData = document.getElementById('calendarData');
let currentYear = parseInt(calendarData?.dataset.year) || new Date().getFullYear();
let currentMonth = parseInt(calendarData?.dataset.month) || (new Date().getMonth() + 1);

let selectedDate = null;
let allSchedules = {};
let currentProfessors = [];
let statusRefreshInterval = null;
let monthStatuses = {};
let currentSelectedDate = null;


async function fetchAllClasses(department = "all") {
    try {
        console.log("🔍 Fetching all classes for calendar...");
        const response = await fetch(`staff_scheduling/get_classes_list/?department=${department}`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ Classes fetched (${data.classes.length})`);
            console.log("📦 Classes data:", data.classes);

            const enrichedClasses = await enrichClassesWithTeacherNames(data.classes);
            return enrichedClasses;
        } else {
            console.error("❌ Error fetching classes:", data.error);
            return [];
        }
    } catch (err) {
        console.error("⚠️ Fetch error:", err);
        return [];
    }
}


async function enrichClassesWithTeacherNames(classes) {
    console.log("👥 Starting to enrich classes with teacher names...");

    const teacherIds = [...new Set(classes.map(cls => cls.teacherUid).filter(id => id))];
    console.log(`📋 Found ${teacherIds.length} unique teachers:`, teacherIds);

    const teacherMap = {};
    for (const teacherId of teacherIds) {
        try {
            const response = await fetch(`staff_scheduling/get_user_profile/?uid=${teacherId}`);
            const data = await response.json();
            if (data.success && data.user) {
                const user = data.user;
                const firstName = user.firstName || '';
                const midName = user.midName || '';
                const lastName = user.lastName || '';
                const middleInitial = midName ? ` ${midName[0]}.` : '';
                teacherMap[teacherId] = `${firstName}${middleInitial} ${lastName}`.trim();
                console.log(`✅ Teacher ${teacherId}: ${teacherMap[teacherId]}`);
            }
        } catch (err) {
            console.warn(`⚠️ Could not fetch teacher name for ${teacherId}`);
        }
    }

    const enrichedClasses = classes.map(cls => ({
        ...cls,
        teacher_name: teacherMap[cls.teacherUid] || cls.teacher_name || cls.teacherUid
    }));

    console.log("✅ Enrichment complete!");
    return enrichedClasses;
}


async function loadCalendarSchedules() {
    const classes = await fetchAllClasses();
    console.log("🗓️ Grouping classes by date...");
    allSchedules = groupClassesByDate(classes);
    console.log("📊 Grouped schedules:", allSchedules);
    displaySchedulesOnCalendar(allSchedules);

    await loadMonthStatuses();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    
    if (todayYear === currentYear && todayMonth === currentMonth) {
        const todayCell = document.querySelector(`td[data-date="${todayStr}"]`);
        if (todayCell) {
            todayCell.style.border = '2px solid #9db5eb';
            todayCell.style.fontWeight = 'bold';
            todayCell.style.backgroundColor = '#9db5ebff';
        }
        
        showDaySchedule(todayDayName, todayStr);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log("📅 Calendar initialized");
    loadCalendarSchedules();
    setupEventListeners();
});


function setupEventListeners() {
    const filterBtn = document.getElementById('filterBtn');
    const filterDropdown = document.getElementById('filterDropdown');

    if (filterBtn && filterDropdown) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterDropdown.classList.toggle('show');
            console.log('🎛️ Filter dropdown toggled');
        });

        document.addEventListener('click', (e) => {
            if (!filterDropdown.contains(e.target) && e.target !== filterBtn) {
                filterDropdown.classList.remove('show');
            }
        });
    } else {
        console.warn('⚠️ Filter button or dropdown not found');
    }

    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            if (currentMonth === 1) {
                currentMonth = 12;
                currentYear--;
            } else currentMonth--;
            console.log(`⬅️ Previous month: ${currentYear}-${currentMonth}`);
            window.location.href = `?year=${currentYear}&month=${currentMonth}`;
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            if (currentMonth === 12) {
                currentMonth = 1;
                currentYear++;
            } else currentMonth++;
            console.log(`➡️ Next month: ${currentYear}-${currentMonth}`);
            window.location.href = `?year=${currentYear}&month=${currentMonth}`;
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            console.log(`🔎 Search input: "${e.target.value}"`);
            applyFilters();
        });
        console.log('✅ Search input listener added');
    } else {
        console.warn('⚠️ Search input not found');
    }

    const sortRadios = document.querySelectorAll('input[name="sort"]');
    if (sortRadios.length > 0) {
        sortRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                console.log(`🔄 Sort changed to: ${e.target.value}`);
                applyFilters();
            });
        });
        console.log(`✅ Sort radio listeners added (${sortRadios.length} radios)`);
    } else {
        console.warn('⚠️ Sort radio buttons not found');
    }
}


function groupClassesByDate(classes) {
    const grouped = {};

    const dayNumberToName = {
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
        7: 'Sunday',
        0: 'Sunday'
    };

    classes.forEach(cls => {
        let classDay = cls.day;
        const teacher_uid = cls.teacherUid;

        if (!classDay && classDay !== 0) {
            console.warn("⚠️ Class without day:", cls);
            return;
        }

        let dayName;
        if (typeof classDay === 'number' || !isNaN(classDay)) {
            dayName = dayNumberToName[parseInt(classDay)];
            if (!dayName) {
                console.warn(`⚠️ Unknown day number: ${classDay}`);
                return;
            }
        } else if (typeof classDay === 'string') {
            dayName = classDay;
        } else {
            console.warn(`⚠️ Unknown day format: ${classDay}`);
            return;
        }

        console.log(`✅ Mapped day ${classDay} -> ${dayName}`);

        if (!grouped[dayName]) grouped[dayName] = [];

        let teacherEntry = grouped[dayName].find(t => t.teacherUid === teacher_uid);
        if (!teacherEntry) {
            teacherEntry = {
                teacherUid: teacher_uid,
                teacher_name: cls.teacher_name || teacher_uid,
                classes: []
            };
            grouped[dayName].push(teacherEntry);
        }

        teacherEntry.classes.push(cls);
    });

    console.log("📅 Grouped classes by day:", grouped);
    return grouped;
}


function displaySchedulesOnCalendar(scheduleMap) {
    const calendarDays = document.querySelectorAll('td[data-date]');
    console.log(`🔍 Found ${calendarDays.length} calendar day cells`);

    calendarDays.forEach(td => {
        const dateStr = td.getAttribute('data-date');
        if (!dateStr) return;

        const dayName = getDayNameFromDate(dateStr);

        if (scheduleMap[dayName] && scheduleMap[dayName].length > 0) {
            td.querySelector('.schedule-info')?.remove();

            const scheduleDiv = document.createElement('div');
            scheduleDiv.className = 'schedule-info';
            scheduleDiv.style.cssText = `
                margin-top: 5px;
                font-size: 11px;
                color: #2563eb;
                backgroundcolor: #9db5eb;
                font-weight: 500;
            `;
            const teacherCount = scheduleMap[dayName].length;
            scheduleDiv.textContent = `${teacherCount} teacher${teacherCount > 1 ? 's' : ''}`;

            td.appendChild(scheduleDiv);
            td.style.cursor = 'pointer';
            td.style.backgroundColor = '#eff6ff';

            td.addEventListener('click', () => {
                showDaySchedule(dayName, dateStr);
            });

            console.log(`✅ Added schedule indicator to ${dateStr} (${dayName}): ${teacherCount} teachers`);
        }
    });
}


function showDaySchedule(dayKey, dateStr) {
    console.log('='.repeat(80));
    console.log('📅 DAY SCHEDULE CLICKED');
    console.log('   Day:', dayKey);
    console.log('   Date:', dateStr);
    console.log('='.repeat(80));

    selectedDate = dateStr;

    const scheduleDateElement = document.getElementById('scheduleDate');
    if (scheduleDateElement) {
        scheduleDateElement.textContent = `${dayKey} - ${dateStr}`;
    }

    const teachers = allSchedules[dayKey] || [];
    console.log(`📋 Showing schedule for ${dayKey}:`, teachers);
    console.log(`📊 Number of teachers: ${teachers.length}`);

    currentProfessors = teachers;
    applyFilters();
}


function applyFilters() {
    if (!currentProfessors || currentProfessors.length === 0) {
        displayFilteredResults([]);
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const sortRadio = document.querySelector('input[name="sort"]:checked');
    const sortOrder = sortRadio ? sortRadio.value : 'latest';

    console.log(`🔍 Applying filters - Search: "${searchTerm}", Sort: ${sortOrder}`);

    let filteredTeachers = [...currentProfessors];

    if (searchTerm) {
        filteredTeachers = filteredTeachers.filter(t => {
            const nameMatch = (t.teacher_name || '').toLowerCase().includes(searchTerm);
            const idMatch = (t.teacherUid || '').toLowerCase().includes(searchTerm);
            const classMatch = t.classes.some(cls => {
                const codeMatch = (cls.subjectCode || '').toLowerCase().includes(searchTerm);
                const nameMatch = (cls.subjectName || '').toLowerCase().includes(searchTerm);
                const roomMatch = (cls.room || '').toLowerCase().includes(searchTerm);
                return codeMatch || nameMatch || roomMatch;
            });

            const dateMatch = selectedDate && selectedDate.toLowerCase().includes(searchTerm);
            const match = nameMatch || idMatch || classMatch || dateMatch;

            if (match) {
                console.log(`✅ Match found for "${searchTerm}" in teacher: ${t.teacher_name}`);
            }

            return match;
        });

        console.log(`🔍 Search results: ${filteredTeachers.length} of ${currentProfessors.length} teachers`);
    }

    if (sortOrder === 'latest') {
        filteredTeachers = filteredTeachers.reverse();
        console.log('🔄 Sorted: Latest first');
    } else if (sortOrder === 'oldest') {
        console.log('🔄 Sorted: Oldest first');
    } else if (sortOrder === 'name') {
        filteredTeachers.sort((a, b) => {
            const nameA = (a.teacher_name || a.teacherUid || '').toLowerCase();
            const nameB = (b.teacher_name || b.teacherUid || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        console.log('🔄 Sorted: By name A-Z');
    }

    displayFilteredResults(filteredTeachers);
}

async function displayFilteredResults(teachers) {
    const scheduleList = document.getElementById('facultyScheduleList');
    const resultsCount = document.getElementById('resultsCount');

    if (!scheduleList) {
        console.error("❌ facultyScheduleList element not found");
        return;
    }

    scheduleList.innerHTML = '';

    if (teachers.length === 0) {
        scheduleList.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:20px;">No results found</p>`;
        if (resultsCount) resultsCount.textContent = 'No results';

        
        if (selectedDate) {
            addDayStatusButtons(scheduleList);
        }

        stopStatusAutoRefresh(); 
        return;
    }

    const totalClasses = teachers.reduce((sum, t) => sum + t.classes.length, 0);
    if (resultsCount) {
        resultsCount.textContent = `Showing ${teachers.length} teacher${teachers.length > 1 ? 's' : ''} with ${totalClasses} class${totalClasses > 1 ? 'es' : ''}`;
    }

    
    for (const teacher of teachers) {
        const card = await createTeacherCard(teacher);
        scheduleList.appendChild(card);
    }

    
    if (selectedDate) {
        addDayStatusButtons(scheduleList);
    }

    
    startStatusAutoRefresh();
}

async function createTeacherCard(teacher) {
    const card = document.createElement('div');
    card.className = 'professor-schedule-card';
    card.dataset.teacherUid = teacher.teacherUid;
    card.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-left: 4px solid #2563eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    `;


    const leftSection = document.createElement('div');
    leftSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 1;';

    const status = await getTeacherAttendanceStatus(teacher.teacherUid, teacher.classes, selectedDate);

    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator';
    statusIndicator.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${status.color};
        box-shadow: 0 0 8px ${status.color};
        ${status.shouldBlink ? 'animation: blink 1s infinite;' : ''}
        flex-shrink: 0;
    `;
    statusIndicator.title = status.message;


    const nameContainer = document.createElement('div');
    nameContainer.style.cssText = 'flex: 1;';

    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = `
        font-weight: 600;
        font-size: 16px;
        color: #1e293b;
    `;
    nameDiv.textContent = teacher.teacher_name || teacher.teacherUid;

    const statusText = document.createElement('div');
    statusText.style.cssText = `
        font-size: 12px;
        color: #64748b;
        margin-top: 2px;
    `;
    statusText.textContent = status.message;

    nameContainer.appendChild(nameDiv);
    nameContainer.appendChild(statusText);

    leftSection.appendChild(statusIndicator);
    leftSection.appendChild(nameContainer);


    const rightSection = document.createElement('div');
    rightSection.style.cssText = 'display: flex; align-items: center;';


    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'View Schedule';
    viewBtn.style.cssText = `
        background: #2563eb;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.2s;
        white-space: nowrap;
    `;
    viewBtn.onmouseover = () => viewBtn.style.background = '#1d4ed8';
    viewBtn.onmouseout = () => viewBtn.style.background = '#2563eb';
    viewBtn.onclick = () => showTeacherScheduleModal(teacher);

    rightSection.appendChild(viewBtn);


    card.appendChild(leftSection);
    card.appendChild(rightSection);

    return card;
}

async function getTeacherAttendanceStatus(teacherUid, classes, selectedDateStr) {

    const defaultStatus = {
        color: '#9ca3af',
        message: 'No class scheduled',
        shouldBlink: false
    };

    if (!classes || classes.length === 0) {
        return defaultStatus;
    }


    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const isToday = selectedDateStr === todayStr;

    if (!isToday) {
        return defaultStatus;
    }


    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();


    for (const cls of classes) {
        try {

            const endTime = parseTimeToMinutes(cls.endTime);


            if (endTime && currentTime > endTime) {
                continue;
            }

            const attendance = await fetchAttendanceForClass(cls.id, teacherUid, selectedDateStr);

            if (attendance) {
                const hasTimeIn = attendance.timeIn || attendance.timeInTime;
                const hasTimeOut = attendance.timeOut || attendance.timeOutTime;


                if (hasTimeIn && !hasTimeOut) {
                    return {
                        color: '#22c55e',
                        message: 'On going class',
                        shouldBlink: false
                    };
                }


                if (hasTimeIn && hasTimeOut) {
                    return {
                        color: '#ef4444',
                        message: 'Time out',
                        shouldBlink: true
                    };
                }
            }
        } catch (error) {
            console.error('Error checking attendance for class:', cls.id, error);
        }
    }
    return defaultStatus;
}

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;

    try {
        
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;

        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const period = match[3].toUpperCase();

        
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    } catch (e) {
        console.error('Error parsing time:', timeStr, e);
        return null;
    }
}


if (!document.getElementById('status-indicator-styles')) {
    const style = document.createElement('style');
    style.id = 'status-indicator-styles';
    style.textContent = `
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
    `;
    document.head.appendChild(style);
}

function startStatusAutoRefresh() {
    
    if (statusRefreshInterval) {
        clearInterval(statusRefreshInterval);
    }

    
    statusRefreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing status indicators...');
        refreshAllStatusIndicators();
    }, 30000); 

    console.log('✅ Status auto-refresh started (every 30 seconds)');
}

function stopStatusAutoRefresh() {
    if (statusRefreshInterval) {
        clearInterval(statusRefreshInterval);
        statusRefreshInterval = null;
        console.log('⏹️ Status auto-refresh stopped');
    }
}

async function refreshAllStatusIndicators() {
    if (!currentProfessors || currentProfessors.length === 0) {
        return;
    }

    
    for (const teacher of currentProfessors) {
        await updateTeacherCardStatus(teacher.teacherUid, teacher.classes);
    }
}

async function updateTeacherCardStatus(teacherUid, classes) {
    
    const cards = document.querySelectorAll('.professor-schedule-card');

    for (const card of cards) {
        
        if (card.dataset.teacherUid !== teacherUid) {
            continue;
        }

        const statusIndicator = card.querySelector('.status-indicator');
        const statusText = card.querySelector('div[style*="font-size:12px"]');

        if (!statusIndicator || !statusText) continue;

        
        const status = await getTeacherAttendanceStatus(teacherUid, classes, selectedDate);

        
        statusIndicator.style.background = status.color;
        statusIndicator.style.boxShadow = `0 0 8px ${status.color}`;
        statusIndicator.title = status.message;

        if (status.shouldBlink) {
            statusIndicator.style.animation = 'blink 1s infinite';
        } else {
            statusIndicator.style.animation = 'none';
        }

        
        statusText.textContent = status.message;

        console.log(`✅ Updated status for ${teacherUid}: ${status.message}`);
    }
}


function cleanupStatusRefresh() {
    stopStatusAutoRefresh();
    console.log('🧹 Status refresh cleanup complete');
}

async function showTeacherScheduleModal(teacher) {
    console.log('📋 Opening schedule modal for:', teacher.teacher_name);

    let modal = document.getElementById('teacherScheduleModal');
    if (!modal) {
        modal = createScheduleModal();
        document.body.appendChild(modal);
    }

    
    let hasLeaveStatus = false;
    if (teacher.classes && teacher.classes.length > 0) {
        for (const cls of teacher.classes) {
            const attendance = await fetchAttendanceForClass(cls.id, teacher.teacherUid, selectedDate);
            if (attendance && attendance.lateReasons) {
                hasLeaveStatus = true;
                break;
            }
        }
    }

    const modalHeader = modal.querySelector('.modal-header-content');
    if (modalHeader) {
        modalHeader.innerHTML = `
            <div style="flex: 1;">
                <h2 style="margin:0;font-size:20px;font-weight:600;">${teacher.teacher_name || teacher.teacherUid}</h2>
                <p style="margin:4px 0 0 0;font-size:14px;opacity:0.9;">Class Schedule</p>
            </div>
            
            <!-- Mark All Classes Dropdown -->
            <div style="display: flex; align-items: center; gap: 8px; margin-right: 12px;">
                <select id="modalAllClassesLeave_${teacher.teacherUid}" style="
                    padding: 8px 12px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    font-weight: 500;
                ">
                    <option value="" style="color: #1e293b;">-- Mark All Classes --</option>
                    <option value="On Leave" style="color: #1e293b;">On Leave</option>
                    <option value="Sick Leave" style="color: #1e293b;">Sick Leave</option>
                    <option value="Emergency Leave" style="color: #1e293b;">Emergency Leave</option>
                    <option value="Official Business" style="color: #1e293b;">Official Business</option>
                </select>
                <button 
                    onclick="markAllClassesLeaveFromModal('${teacher.teacherUid}')"
                    style="
                        padding: 8px 16px;
                        background: rgba(255,255,255,0.2);
                        color: white;
                        border: 2px solid rgba(255,255,255,0.3);
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        white-space: nowrap;
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.2)'"
                >
                    Apply to All
                </button>
                
                ${hasLeaveStatus ? `
                <button 
                    onclick="clearAllClassesLeave('${teacher.teacherUid}')"
                    style="
                        padding: 8px 16px;
                        background: rgba(239, 68, 68, 0.8);
                        color: white;
                        border: 2px solid rgba(255,255,255,0.3);
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        white-space: nowrap;
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.background='rgba(220, 38, 38, 0.9)'"
                    onmouseout="this.style.background='rgba(239, 68, 68, 0.8)'"
                >
                    Clear All Leaves
                </button>
                ` : ''}
            </div>
        `;
    }

    const modalClassesList = document.getElementById('modalClassesList');

    if (modalClassesList) {
        modalClassesList.innerHTML = '<div style="text-align:center;padding:20px;">Loading...</div>';

        if (teacher.classes && teacher.classes.length > 0) {
            modalClassesList.innerHTML = '';

            for (const cls of teacher.classes) {
                const classCard = await createModalClassCard(cls, teacher.teacherUid, selectedDate);
                modalClassesList.appendChild(classCard);
            }
        } else {
            modalClassesList.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">No classes scheduled</p>';
        }
    }

    modal.style.display = 'flex';
}


async function createModalClassCard(cls, teacherUid, selectedDate) {
    console.log('='.repeat(80));
    console.log('🎨 CREATING CARD FOR CLASS');
    console.log('   Subject:', cls.subjectCode, '-', cls.subjectName);
    console.log('   Class ID:', cls.id);
    console.log('   Teacher UID:', teacherUid);
    console.log('   Selected Date:', selectedDate);


    const NOW = new Date();
    const NOW_TIME_MINUTES = NOW.getHours() * 60 + NOW.getMinutes();
    console.log('   🕐 Current Time:', NOW.toLocaleTimeString(), `(${NOW_TIME_MINUTES} minutes)`);
    console.log('='.repeat(80));

    const card = document.createElement('div');
    card.className = 'modal-class-card';
    card.dataset.classId = cls.id;
    card.dataset.endTime = cls.endTime;
    card.dataset.teacherUid = teacherUid;
    card.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    const attendance = await fetchAttendanceForClass(cls.id, teacherUid, selectedDate);


    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    selectedDateObj.setHours(0, 0, 0, 0);
    const isPast = selectedDateObj < today;
    const isToday = selectedDateObj.getTime() === today.getTime();
    const isFuture = selectedDateObj > today;

    const hasTimeIn = attendance?.timeInImageUrl;
    const hasTimeOut = attendance?.timeOutImageUrl;
    const bothComplete = hasTimeIn && hasTimeOut;


    let classHasPassed = false;
    let classEndTimeMinutes = null;

    if (isToday) {
        classEndTimeMinutes = parseTimeToMinutes(cls.endTime);

        if (classEndTimeMinutes !== null) {
            classHasPassed = NOW_TIME_MINUTES >= classEndTimeMinutes;

            console.log('   ⏰ Class End Time:', cls.endTime, `(${classEndTimeMinutes} minutes)`);
            console.log('   ⏰ Current Time:', NOW.toLocaleTimeString(), `(${NOW_TIME_MINUTES} minutes)`);
            console.log('   ⏰ Class Has Passed?', classHasPassed);
            console.log('   ⏰ Difference:', NOW_TIME_MINUTES - classEndTimeMinutes, 'minutes');
        }
    }

    const isAbsent = (isPast || (isToday && classHasPassed)) && !hasTimeIn;
    const isPending = (isFuture || (isToday && !classHasPassed)) && !hasTimeIn && !hasTimeOut;

    console.log('   📊 Final Status:');
    console.log('      - Is Past Date?', isPast);
    console.log('      - Is Today?', isToday);
    console.log('      - Is Future?', isFuture);
    console.log('      - Class Has Passed?', classHasPassed);
    console.log('      - Has Time In?', hasTimeIn);
    console.log('      - Has Time Out?', hasTimeOut);
    console.log('      - IS ABSENT?', isAbsent);
    console.log('      - IS PENDING?', isPending);

    const isValidated = attendance?.remarks !== null && attendance?.remarks !== undefined;
    const remarks = attendance?.remarks || '';
    const validationStatus = attendance?.validationStatus || '';
    const lateReasons = attendance?.lateReasons || '';
    const isCompensated = attendance?.isCompensated || false;
    const compensationNote = attendance?.compensationNote || '';

    const timeInActual = attendance?.timeInActual || attendance?.timeIn || '--:--';
    const timeOutActual = attendance?.timeOutActual || attendance?.timeOut || '--:--';

    card.innerHTML = `
        <div style="margin-bottom: 24px;">
            <div style="font-weight:600;color:#1e293b;font-size:20px;margin-bottom:16px;">
                ${cls.subjectCode || 'N/A'} - ${cls.subjectName || 'N/A'}
            </div>
            <div style="font-size:16px;color:#475569;line-height:1.8;">
                <div style="margin-bottom:8px;">
                    <strong>Time / Day:</strong> ${formatTimeTo12Hour(cls.startTime)} - ${formatTimeTo12Hour(cls.endTime)} (${getDayAbbreviation(cls.day)})
                    ${isToday ? (classHasPassed ? `
                        <span style="
                            display: inline-block;
                            margin-left: 12px;
                            padding: 4px 12px;
                            background: #fee2e2;
                            color: #991b1b;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                        ">⏰ Class ended</span>
                    ` : `
                        <span id="countdown_${cls.id}" style="
                            display: inline-block;
                            margin-left: 12px;
                            padding: 4px 12px;
                            background: #dbeafe;
                            color: #1e40af;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                        ">⏳ Ongoing</span>
                    `) : ''}
                </div>
                <div>
                    <strong>Room / Section:</strong> ${cls.room || 'TBA'} - ${cls.section || 'N/A'}
                </div>
            </div>
        </div>
        
        <!-- Leave Status Dropdown -->
        <div style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <label style="display: block; font-weight: 600; color: #1e293b; margin-bottom: 8px; font-size: 14px;">
                Mark Teacher Status:
            </label>
            <div style="display: flex; gap: 12px; align-items: center;">
                <select id="leaveStatus_${cls.id}" style="
                    flex: 1;
                    padding: 10px 12px;
                    border: 2px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    background: white;
                " ${lateReasons ? 'disabled' : ''}>
                    <option value="">-- Select Status --</option>
                    <option value="On Leave" ${lateReasons === 'On Leave' ? 'selected' : ''}>On Leave</option>
                    <option value="Sick Leave" ${lateReasons === 'Sick Leave' ? 'selected' : ''}>Sick Leave</option>
                    <option value="Emergency Leave" ${lateReasons === 'Emergency Leave' ? 'selected' : ''}>Emergency Leave</option>
                    <option value="Official Business" ${lateReasons === 'Official Business' ? 'selected' : ''}>Official Business</option>
                </select>
                <button 
                    onclick="markTeacherLeave('${attendance?.id || ''}', '${cls.id}', '${teacherUid}', '${selectedDate}')"
                    ${lateReasons ? 'disabled' : ''}
                    style="
                        padding: 10px 20px;
                        background: ${lateReasons ? '#94a3b8' : '#f59e0b'};
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 14px;
                        cursor: ${lateReasons ? 'not-allowed' : 'pointer'};
                        white-space: nowrap;
                        transition: background 0.2s;
                    "
                    onmouseover="if(!this.disabled) this.style.background='#d97706'"
                    onmouseout="if(!this.disabled) this.style.background='#f59e0b'"
                >
                    ${lateReasons ? 'Already Marked' : 'Apply Status'}
                </button>
            </div>
            ${lateReasons ? `
                <div style="margin-top: 12px; display: flex; align-items: center; gap: 12px;">
                    <span style="
                        display: inline-block;
                        padding: 6px 12px;
                        background: #fef3c7;
                        color: #92400e;
                        border-radius: 6px;
                        font-size: 12px;
                        font-weight: 600;
                    ">
                        Current Status: ${lateReasons}
                    </span>
                    <button 
                        onclick="clearTeacherLeave('${attendance?.id || ''}')"
                        style="
                            padding: 6px 12px;
                            background: #dc2626;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: background 0.2s;
                        "
                        onmouseover="this.style.background='#b91c1c'"
                        onmouseout="this.style.background='#dc2626'"
                    >
                        Clear Status
                    </button>
                </div>
            ` : ''}
        </div>
        
        <!-- Attendance Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px;">
            <!-- Time In -->
            <div class="attendance-section">
                <div style="text-align: center; margin-bottom: 12px;">
                    <div style="
                        background: ${isPending ? '#94a3b8' : isAbsent ? '#ef4444' : '#3b82f6'};
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 14px;
                        display: inline-block;
                    ">
                        Time In: ${isPending ? '---' : isAbsent ? 'ABSENT' : timeInActual}
                    </div>
                </div>
                
                <div class="image-container" style="
                    width: 100%;
                    height: 200px;
                    border: 2px solid ${isPending ? '#cbd5e0' : isAbsent ? '#ef4444' : '#e2e8f0'};
                    border-radius: 8px;
                    overflow: hidden;
                    background: ${isPending ? '#f1f5f9' : isAbsent ? '#fee2e2' : '#f8fafc'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    ${hasTimeIn ?
            `<img src="${attendance.timeInImageUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Time In Photo" />`
            :
            `<span style="color: ${isAbsent ? '#dc2626' : '#64748b'}; font-size: ${isAbsent ? '16px' : '14px'}; font-weight: ${isAbsent ? '600' : 'normal'};">No photo</span>`
        }
                </div>
            </div>
            
            <!-- Time Out -->
            <div class="attendance-section">
                <div style="text-align: center; margin-bottom: 12px;">
                    <div style="
                        background: ${isPending ? '#94a3b8' : isAbsent ? '#ef4444' : '#ef4444'};
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 14px;
                        display: inline-block;
                    ">
                        Time Out: ${isPending ? '---' : isAbsent ? 'ABSENT' : timeOutActual}
                    </div>
                </div>
                
                <div class="image-container" style="
                    width: 100%;
                    height: 200px;
                    border: 2px solid ${isPending ? '#cbd5e0' : isAbsent ? '#ef4444' : '#e2e8f0'};
                    border-radius: 8px;
                    overflow: hidden;
                    background: ${isPending ? '#f1f5f9' : isAbsent ? '#fee2e2' : '#f8fafc'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    ${hasTimeOut ?
            `<img src="${attendance.timeOutImageUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Time Out Photo" />`
            :
            `<span style="color: ${isAbsent ? '#dc2626' : '#64748b'}; font-size: ${isAbsent ? '16px' : '14px'}; font-weight: ${isAbsent ? '600' : 'normal'};">No photo</span>`
        }
                </div>
            </div>
        </div>
        
        <!-- Action Buttons Section -->
        <div style="margin-top: 24px;">
            ${isPending ? `
                <div style="text-align: center;">
                    <div style="
                        display: inline-block;
                        padding: 12px 24px;
                        background: #f1f5f9;
                        border-radius: 6px;
                        color: #64748b;
                        font-weight: 600;
                        font-size: 14px;
                    ">
                        ${isToday ? 'Class in progress - waiting for completion' : 'Scheduled for future date'}
                    </div>
                </div>
            ` : isAbsent && !lateReasons ? `
                <!-- Compensation Section -->
                <div id="compensationSection_${cls.id}" style="margin-bottom: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
                    ${!isCompensated ? `
                        <div id="compensationButton_${cls.id}">
                            <button 
                                onclick="showCompensationInput('${cls.id}', '${attendance?.id || ''}', '${teacherUid}', '${selectedDate}')"
                                style="
                                    width: 100%;
                                    background: #10b981;
                                    color: white;
                                    border: none;
                                    padding: 12px 24px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-weight: 600;
                                    font-size: 14px;
                                    transition: all 0.2s;
                                "
                                onmouseover="this.style.background='#059669'"
                                onmouseout="this.style.background='#10b981'"
                            >
                                ✓ Mark as Compensated
                            </button>
                        </div>
                        <div id="compensationInput_${cls.id}" style="display: none;">
                            <label style="display: block; font-weight: 600; color: #1e293b; margin-bottom: 8px; font-size: 14px;">
                                Compensation Note:
                            </label>
                            <textarea 
                                id="compensationNote_${cls.id}" 
                                placeholder="Enter compensation details (optional)..."
                                style="
                                    width: 95%;
                                    min-height: 45px;
                                    max-height: 80px;
                                    padding: 10px 12px;
                                    border: 2px solid #10b981;
                                    border-radius: 6px;
                                    font-size: 13px;
                                    resize: vertical;
                                    font-family: inherit;
                                    margin-bottom: 12px;
                                    display: block;
                                "
                            ></textarea>
                            <div style="display: flex; gap: 12px;">
                                <button 
                                    onclick="submitCompensation('${cls.id}', '${attendance?.id || ''}', '${teacherUid}', '${selectedDate}')"
                                    style="
                                        flex: 1;
                                        background: #10b981;
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-weight: 600;
                                        font-size: 14px;
                                    "
                                >
                                    Submit
                                </button>
                                <button 
                                    onclick="cancelCompensationInput('${cls.id}')"
                                    style="
                                        background: #94a3b8;
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-weight: 600;
                                        font-size: 14px;
                                    "
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div>
                            <label style="display: block; font-weight: 600; color: #065f46; margin-bottom: 8px; font-size: 14px;">
                                ✓ Compensated
                            </label>
                            <textarea 
                                readonly
                                disabled
                                style="
                                    width: 95%;
                                    min-height: 45px;
                                    padding: 10px 12px;
                                    border: 2px solid #d1fae5;
                                    border-radius: 6px;
                                    font-size: 13px;
                                    background: #e5e7eb;
                                    color: #1e293b;
                                    cursor: not-allowed;
                                    margin-bottom: 12px;
                                "
                            >${compensationNote || 'No note provided'}</textarea>
                        </div>
                    `}
                </div>
            ` : bothComplete && !lateReasons ? `
                <!-- Validation Buttons for Present/Late -->
                    <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: center;">
                        <button
                            onclick="validateAttendanceSingle('${attendance.id}', true)"
                            ${isValidated ? 'disabled' : ''}
                            style="
                                flex: 1;
                                max-width: 200px;
                                background: ${remarks === 'approved' ? '#04a26eff' : '#09a943ff'};
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                border-radius: 6px;
                                cursor: ${isValidated ? 'not-allowed' : 'pointer'};
                                font-weight: 600;
                                font-size: 14px;
                                transition: all 0.2s;
                                opacity: ${isValidated ? '0.6' : '1'};
                            ">
                            ${remarks === 'approved' ? 'Approved' : 'Approve'}
                        </button>
                        <button 
                            onclick="validateAttendanceSingle('${attendance.id}', false)"
                            ${isValidated ? 'disabled' : ''}
                            style="
                                flex: 1;
                                max-width: 200px;
                                background: ${remarks === 'declined' ? '#c60404ff' : '#bb1010ff'};
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                border-radius: 6px;
                                cursor: ${isValidated ? 'not-allowed' : 'pointer'};
                                font-weight: 600;
                                font-size: 14px;
                                transition: all 0.2s;
                                opacity: ${isValidated ? '0.6' : '1'};
                            ">
                            ${remarks === 'declined' ? 'Declined' : 'Decline'}
                        </button>
                    </div>
            ` : lateReasons ? `
            ` : ''}
        </div>
        
        <!-- Status Badge -->
        <div style="margin-top: 16px; text-align: center;">
            <span style="
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                background: ${lateReasons ? '#fef3c7' :
            isAbsent ? (isCompensated ? '#d1fae5' : '#fee2e2') :
                validationStatus === 'approved' ? '#d1fae5' :
                    validationStatus === 'declined' ? '#fee2e2' :
                        isPending ? '#fef3c7' : '#d1fae5'
        };
                color: ${lateReasons ? '#92400e' :
            isAbsent ? (isCompensated ? '#065f46' : '#991b1b') :
                validationStatus === 'approved' ? '#065f46' :
                    validationStatus === 'declined' ? '#991b1b' :
                        isPending ? '#92400e' : '#065f46'
        };
            ">
                ${lateReasons ? lateReasons.toUpperCase() :
            isAbsent ? (isCompensated ? 'ABSENT (COMPENSATED)' : 'ABSENT') :
                validationStatus ? validationStatus.toUpperCase() :
                    isPending ? 'PENDING' : 'PRESENT'
        }
            </span>
        </div>
    `;

    return card;
}

function showCompensationInput(classId, attendanceId, teacherUid, date) {
    console.log('🎯 Showing compensation input for class:', classId);


    const buttonDiv = document.getElementById(`compensationButton_${classId}`);
    const inputDiv = document.getElementById(`compensationInput_${classId}`);

    if (buttonDiv && inputDiv) {
        buttonDiv.style.display = 'none';
        inputDiv.style.display = 'block';


        const textarea = document.getElementById(`compensationNote_${classId}`);
        if (textarea) {
            textarea.focus();
        }
    }
}

function cancelCompensationInput(classId) {
    console.log('❌ Canceling compensation input for class:', classId);


    const buttonDiv = document.getElementById(`compensationButton_${classId}`);
    const inputDiv = document.getElementById(`compensationInput_${classId}`);

    if (buttonDiv && inputDiv) {
        buttonDiv.style.display = 'block';
        inputDiv.style.display = 'none';


        const textarea = document.getElementById(`compensationNote_${classId}`);
        if (textarea) {
            textarea.value = '';
        }
    }
}

async function submitCompensation(classId, attendanceId, teacherUid, date) {
    const textarea = document.getElementById(`compensationNote_${classId}`);
    const note = textarea ? textarea.value.trim() : '';

    console.log('📝 Submitting compensation with note:', note);
    console.log('📝 AttendanceId:', attendanceId);
    console.log('📝 TeacherUid:', teacherUid);
    console.log('📝 Date:', date);

    try {

        if (!attendanceId) {
            console.log('⚠️ No attendance ID, creating new record...');

            const createResponse = await fetch('/create_attendance/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    classId: classId,
                    teacherUid: teacherUid,
                    date: date,
                    status: 'absent'
                })
            });

            console.log('Create response status:', createResponse.status);
            const createData = await createResponse.json();
            console.log('Create response data:', createData);

            if (createData.success) {
                attendanceId = createData.attendanceId;
                console.log('✅ Created attendance record:', attendanceId);
            } else {
                alert('Error creating attendance record: ' + (createData.error || 'Unknown error'));
                return;
            }
        }

        console.log('📤 Sending compensation request...');


        const response = await fetch('/mark_compensated/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attendanceId: attendanceId,
                isCompensated: true,
                note: note || 'No note provided'
            })
        });

        console.log('Compensation response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Compensation response data:', data);

        if (data.success) {
            alert('✅ Marked as compensated');


            const teacher = currentProfessors.find(t => t.teacherUid === teacherUid);


            closeTeacherScheduleModal();

            if (teacher) {

                setTimeout(() => {
                    showTeacherScheduleModal(teacher);
                }, 100);
            } else {
                console.warn('⚠️ Teacher not found in currentProfessors');
                applyFilters();
            }
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('❌ Error submitting compensation:', err);
        alert('Error submitting compensation: ' + err.message);
    }
}

async function removeCompensation(attendanceId) {
    if (!attendanceId) {
        alert('No attendance record found');
        return;
    }

    if (!confirm('Remove compensation status?')) {
        return;
    }

    try {
        const response = await fetch('/mark_compensated/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attendanceId: attendanceId,
                isCompensated: false,
                note: ''
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Compensation removed');


            closeTeacherScheduleModal();

            if (currentModalTeacher) {

                setTimeout(() => {
                    showTeacherScheduleModal(currentModalTeacher);
                }, 100);
            }
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error removing compensation:', err);
        alert('Error removing compensation');
    }
}


async function clearAllClassesLeave(teacherUid) {
    if (!confirm('Clear leave status for ALL classes of this teacher?')) {
        return;
    }

    try {
        const response = await fetch('staff_scheduling/clear_all_classes_leave/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                teacherUid: teacherUid,
                date: selectedDate
            })
        });

        const data = await response.json();

        if (data.success) {
            const count = data.clearedCount || 0;
            alert(`✅ ${count} class(es) leave status cleared`);

            
            closeTeacherScheduleModal();
            const teacher = currentProfessors.find(t => t.teacherUid === teacherUid);
            if (teacher) {
                showTeacherScheduleModal(teacher);
            }
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error clearing all leaves:', err);
        alert('Error clearing all leaves');
    }
}


async function markAllClassesLeave(teacherUid, date) {
    const selectElement = document.getElementById(`allClassesLeave_${teacherUid}`);
    const leaveReason = selectElement.value;

    if (!leaveReason) {
        alert('Please select a leave status');
        return;
    }

    if (!confirm(`Mark ALL classes for this teacher as "${leaveReason}"?`)) {
        return;
    }

    try {
        const response = await fetch('staff_scheduling/mark_all_classes_leave/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                teacherUid: teacherUid,
                date: date,
                lateReasons: leaveReason
            })
        });

        const data = await response.json();

        if (data.success) {
            const count = data.updatedCount || 0;
            alert(`✅ ${count} class(es) marked as ${leaveReason}`);

            
            selectElement.value = '';

            
            applyFilters();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error marking all classes:', err);
        alert('Error marking all classes');
    }
}

async function markAllClassesLeaveFromModal(teacherUid) {
    const selectElement = document.getElementById(`modalAllClassesLeave_${teacherUid}`);
    const leaveReason = selectElement.value;

    if (!leaveReason) {
        alert('Please select a leave status');
        return;
    }

    if (!confirm(`Mark ALL classes for this teacher as "${leaveReason}"?`)) {
        return;
    }

    try {
        const response = await fetch('staff_scheduling/mark_all_classes_leave/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                teacherUid: teacherUid,
                date: selectedDate,
                lateReasons: leaveReason
            })
        });

        const data = await response.json();

        if (data.success) {
            const count = data.updatedCount || 0;
            alert(`✅ ${count} class(es) marked as ${leaveReason}`);

            
            closeTeacherScheduleModal();
            const teacher = currentProfessors.find(t => t.teacherUid === teacherUid);
            if (teacher) {
                showTeacherScheduleModal(teacher);
            }
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error marking all classes:', err);
        alert('Error marking all classes');
    }
}

async function markTeacherLeave(attendanceId, classId, teacherUid, date) {
    const selectElement = document.getElementById(`leaveStatus_${classId}`);
    const leaveReason = selectElement.value;

    if (!leaveReason) {
        alert('Please select a leave status');
        return;
    }

    if (!confirm(`Mark this teacher as "${leaveReason}"?`)) {
        return;
    }

    try {
        
        if (!attendanceId) {
            const createResponse = await fetch('staff_scheduling/create_attendance/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    classId: classId,
                    teacherUid: teacherUid,
                    date: date,
                    lateReasons: leaveReason,
                    status: 'on_leave'
                })
            });

            const createData = await createResponse.json();
            if (createData.success) {
                attendanceId = createData.attendanceId;
            } else {
                alert('Error creating attendance record');
                return;
            }
        }

        
        const response = await fetch('staff_scheduling/mark_teacher_leave/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attendanceId: attendanceId,
                lateReasons: leaveReason
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ Teacher marked as ${leaveReason}`);

            
            closeTeacherScheduleModal();
            const teacherName = document.getElementById('modalTeacherName')?.textContent;
            const teacher = currentProfessors.find(t => t.teacher_name === teacherName);
            if (teacher) {
                showTeacherScheduleModal(teacher);
            }
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error marking leave:', err);
        alert('Error marking teacher leave');
    }
}

async function clearTeacherLeave(attendanceId) {
    if (!attendanceId) {
        alert('No attendance record found');
        return;
    }

    if (!confirm('Clear leave status?')) {
        return;
    }

    try {
        const response = await fetch('staff_scheduling/clear_teacher_leave/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attendanceId: attendanceId
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Leave status cleared');

            
            closeTeacherScheduleModal();
            const teacherName = document.getElementById('modalTeacherName')?.textContent;
            const teacher = currentProfessors.find(t => t.teacher_name === teacherName);
            if (teacher) {
                showTeacherScheduleModal(teacher);
            }
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error clearing leave:', err);
        alert('Error clearing leave status');
    }
}

async function fetchAttendanceForClass(classId, teacherUid, date) {
    try {
        console.log('🔍 FETCHING ATTENDANCE:');
        console.log('   ClassID:', classId);
        console.log('   TeacherUID:', teacherUid);
        console.log('   Date:', date);

        const url = `staff_scheduling/get_attendance_by_class/?classId=${classId}&teacherUid=${teacherUid}&date=${date}`;
        console.log('   URL:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log('📦 API Response:', data);

        if (data.success) {
            if (data.attendance) {
                console.log('✅ Attendance found!');
                console.log('   Full object:', data.attendance);
                console.log('   Available fields:', Object.keys(data.attendance));
                console.log('   timeIn:', data.attendance.timeIn);
                console.log('   timeOut:', data.attendance.timeOut);
                console.log('   timeInImageUrl:', data.attendance.timeInImageUrl ? 'Present' : 'Missing');
                console.log('   timeOutImageUrl:', data.attendance.timeOutImageUrl ? 'Present' : 'Missing');
            } else {
                console.log('⚠️ No attendance record found for these parameters');
                console.log('   This means either:');
                console.log('   1. No attendance was created from mobile app');
                console.log('   2. ClassID/TeacherUID/Date doesn\'t match');
                console.log('   3. Check Firebase "attendance" collection');
            }
            return data.attendance;
        } else {
            console.error('❌ API Error:', data.error);
            return null;
        }
    } catch (err) {
        console.error('❌ Fetch Error:', err);
        return null;
    }
}


async function validateAttendance(attendanceId, isApproved) {
    try {
        if (!confirm(`Are you sure you want to ${isApproved ? 'approve' : 'decline'} this attendance?`)) {
            return;
        }
        
        const response1 = await fetch('staff_scheduling/validate_attendance/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attendanceId: attendanceId,
                isApproved: isApproved
            })
        });

        const data = await response.json();
        console.log('Response:', data);

        if (data.success) {
            alert(`✅ Attendance ${isApproved ? 'approved' : 'declined'} successfully!`);

            
            closeTeacherScheduleModal();
            const teacherName = document.getElementById('modalTeacherName')?.textContent;
            const teacher = currentProfessors.find(t => t.teacher_name === teacherName);
            if (teacher) {
                showTeacherScheduleModal(teacher);
            }
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('❌ Validation error:', err);
        alert('Error validating attendance');
    }
}

async function validateAttendanceSingle(attendanceId, isApproved) {
    try {
        if (!confirm(`Are you sure you want to ${isApproved ? 'approve' : 'decline'} this attendance?`)) {
            return;
        }

        console.log('🔍 Validating attendance:', attendanceId, isApproved);


        const clickedButton = event?.target;
        const buttonContainer = clickedButton?.parentElement;
        const allButtons = buttonContainer?.querySelectorAll('button') || [];


        allButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.style.pointerEvents = 'none';
        });


        if (clickedButton) {
            const originalText = clickedButton.textContent;
            clickedButton.textContent = isApproved ? '⏳ Approving...' : '⏳ Declining...';
        }


        const response = await fetch('/validate_attendance/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attendanceId: attendanceId,
                isApproved: isApproved
            })
        });

        const data = await response.json();
        console.log('✅ Validation response:', data);

        if (data.success) {

            alert(`✅ Attendance ${isApproved ? 'approved' : 'declined'} successfully!`);


            const modal = document.getElementById('teacherScheduleModal');
            const modalHeader = modal?.querySelector('.modal-header-content h2');
            const teacherName = modalHeader?.textContent?.trim();

            console.log('🔍 Looking for teacher:', teacherName);
            console.log('📋 Available teachers:', currentProfessors.map(t => t.teacher_name));


            const teacher = currentProfessors.find(t => t.teacher_name === teacherName);

            if (teacher) {
                console.log('✅ Found teacher, refreshing modal...');


                closeTeacherScheduleModal();


                await new Promise(resolve => setTimeout(resolve, 200));


                await showTeacherScheduleModal(teacher);

            } else {
                console.warn('⚠️ Teacher not found, reloading page...');
                window.location.reload();
            }

        } else {

            alert('❌ Error: ' + (data.error || 'Unknown error'));


            allButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.style.pointerEvents = 'auto';
            });


            if (clickedButton) {
                clickedButton.textContent = isApproved ? 'Approve' : 'Decline';
            }
        }

    } catch (err) {
        console.error('❌ Validation error:', err);
        alert('Error validating attendance: ' + err.message);


        window.location.reload();
    }
}

function createScheduleModal() {
    const modal = document.createElement('div');
    modal.id = 'teacherScheduleModal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        justify-content: center;
        align-items: center;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        ">
            <!-- Header -->
            <div style="
                padding: 20px 24px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: white;
            ">
                <div class="modal-header-content" style="display: flex; align-items: center; flex: 1; gap: 16px;">
                    <!-- Content will be inserted here by showTeacherScheduleModal -->
                </div>
                <button onclick="closeTeacherScheduleModal()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                    flex-shrink: 0;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    ×
                </button>
            </div>
            
            <!-- Body -->
            <div style="
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            " id="modalClassesList">
                <!-- Classes will be inserted here -->
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeTeacherScheduleModal();
        }
    });

    return modal;
}


function closeTeacherScheduleModal() {
    const modal = document.getElementById('teacherScheduleModal');
    if (modal) {
        modal.style.display = 'none';
    }
}


function getDayAbbreviation(day) {
    if (!day) return 'N/A';

    const dayMap = {
        'Monday': 'Mon',
        'Tuesday': 'Tue',
        'Wednesday': 'Wed',
        'Thursday': 'Thu',
        'Friday': 'Fri',
        'Saturday': 'Sat',
        'Sunday': 'Sun'
    };

    return dayMap[day] || day;
}


function formatTimeTo12Hour(time24) {
    if (!time24) return '--:--';

    let timeStr = time24.toString().trim();

    if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
        return timeStr;
    }

    let [hours, minutes] = timeStr.split(':');
    hours = parseInt(hours);
    minutes = minutes || '00';

    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${period}`;
}


function getDayNameFromDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`📅 Date ${dateStr} -> ${dayName}`);
    return dayName;
}


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


document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTeacherScheduleModal();
    }
});

async function loadMonthStatuses() {
    try {
        const response = await fetch(`staff_scheduling/get_month_statuses/?year=${currentYear}&month=${currentMonth}`);
        const data = await response.json();

        if (data.success) {
            monthStatuses = data.statuses;
            applyStatusColors();
            console.log("✅ Month statuses loaded:", monthStatuses);
        }
    } catch (err) {
        console.error("❌ Error loading month statuses:", err);
    }
}

function applyStatusColors() {
    const calendarDays = document.querySelectorAll('td[data-date]');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    calendarDays.forEach(td => {
        const dateStr = td.getAttribute('data-date');
        if (!dateStr) return;

        
        td.style.backgroundColor = '';
        td.style.color = '';  

        const cellDate = new Date(dateStr + 'T00:00:00');
        const todayDate = new Date(todayStr + 'T00:00:00');
        const isPastDate = cellDate < todayDate;
        const isFutureDate = cellDate > todayDate;

        
        if (monthStatuses[dateStr]) {
            const status = monthStatuses[dateStr].status;
            if (status === 'suspended') {
                td.style.backgroundColor = '#ff6b6b';  
                td.style.color = 'black';
            } else if (status === 'holiday') {
                td.style.backgroundColor = '#11c7118b';  
                td.style.color = 'black';
            }
        } else if (isPastDate) {
            td.style.backgroundColor = '#e2e8f0';  
            td.style.color = '#000000ff';
        } else if (isFutureDate) {
            td.style.backgroundColor = '#eff6ff';  
            td.style.color = '#64748b';
        } else {
            
            td.style.color = '#000000';
        }
    });
}

function addDayStatusButtons(container) {
    if (!selectedDate || !container) {
        console.log("No selected date or container for status buttons");
        return;
    }

    
    const existingButtons = document.getElementById('dayStatusButtons');
    if (existingButtons) {
        existingButtons.remove();
    }

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'dayStatusButtons';
    buttonContainer.style.cssText = `
        margin-top: 24px;
        padding: 20px;
        background: #f8fafc;
        border-radius: 8px;
        display: flex;
        gap: 12px;
        justify-content: center;
        border-top: 2px solid #e2e8f0;
    `;

    
    const currentStatus = monthStatuses[selectedDate];

    if (currentStatus) {
        
        const clearBtn = document.createElement('button');
        clearBtn.textContent = `Clear ${currentStatus.status.toUpperCase()} Status`;
        clearBtn.style.cssText = `
            background: #64748b;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
        `;
        clearBtn.onmouseover = () => clearBtn.style.background = '#475569';
        clearBtn.onmouseout = () => clearBtn.style.background = '#64748b';
        clearBtn.onclick = () => clearDayStatus();

        buttonContainer.appendChild(clearBtn);
    } else {
        
        const holidayBtn = document.createElement('button');
        holidayBtn.textContent = '🏖️ Mark as Holiday';
        holidayBtn.style.cssText = `
            background: #ff9f43;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
        `;
        holidayBtn.onmouseover = () => holidayBtn.style.background = '#ff8800';
        holidayBtn.onmouseout = () => holidayBtn.style.background = '#ff9f43';
        holidayBtn.onclick = () => setDayStatus('holiday');

        const suspendBtn = document.createElement('button');
        suspendBtn.textContent = '⚠️ Mark as Suspended';
        suspendBtn.style.cssText = `
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
        `;
        suspendBtn.onmouseover = () => suspendBtn.style.background = '#ee5a52';
        suspendBtn.onmouseout = () => suspendBtn.style.background = '#ff6b6b';
        suspendBtn.onclick = () => setDayStatus('suspended');

        buttonContainer.appendChild(holidayBtn);
        buttonContainer.appendChild(suspendBtn);
    }

    
    try {
        container.appendChild(buttonContainer);
    } catch (error) {
        console.error("Error appending day status buttons:", error);
    }
}

async function setDayStatus(status) {
    if (!selectedDate) {
        alert('No date selected');
        return;
    }

    const confirmMessage = status === 'holiday'
        ? 'Are you sure this is a holiday?'
        : 'Are you sure this day is suspended?';

    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const response = await fetch('staff_scheduling/set_day_status/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: selectedDate,
                status: status
            })
        });

        const data = await response.json();

        if (data.success) {
            const attendanceCount = data.data?.attendanceUpdated || 0;
            let message = `✅ Day marked as ${status}`;
            if (attendanceCount > 0) {
                message += `\n${attendanceCount} attendance record(s) updated`;
            }
            alert(message);

            monthStatuses[selectedDate] = data.data;
            applyStatusColors();
            applyFilters();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error setting day status:', err);
        alert('Error setting day status');
    }
}

async function clearDayStatus() {
    if (!selectedDate) {
        alert('No date selected');
        return;
    }

    if (!confirm('Are you sure you want to clear this day\'s status?')) {
        return;
    }

    try {
        const response = await fetch('staff_scheduling/remove_day_status/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: selectedDate
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Day status cleared');

            
            delete monthStatuses[selectedDate];

            
            applyStatusColors();

            
            applyFilters();
        } else {
            alert('❌ Error: ' + data.error);
        }
    } catch (err) {
        console.error('❌ Error clearing day status:', err);
        alert('Error clearing day status');
    }
}