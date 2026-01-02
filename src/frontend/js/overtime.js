// Overtime Tracking JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication before allowing overtime submission
    if (typeof requireAuth !== 'undefined' && !requireAuth()) {
        return; // Will redirect to login
    }

    const recordDateInput = document.getElementById('recordDate');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const totalHoursInput = document.getElementById('totalHours');
    const submitBtn = document.getElementById('submitOvertimeBtn');
    
    if (!recordDateInput || !startTimeInput || !endTimeInput || !submitBtn) {
        console.error('Overtime form elements not found');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    recordDateInput.setAttribute('max', today);
    recordDateInput.value = today;
    
    function calculateHours() {
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;
        
        if (startTime && endTime) {
            const start = parseTime(startTime);
            const end = parseTime(endTime);
            
            if (start && end && end > start) {
                const diffMs = end - start;
                const diffHours = diffMs / (1000 * 60 * 60);
                totalHoursInput.value = diffHours.toFixed(2) + ' hours';
            } else if (start && end && end <= start) {
                totalHoursInput.value = 'Invalid: End time must be after start time';
            } else {
                totalHoursInput.value = '';
            }
        } else {
            totalHoursInput.value = '';
        }
    }
    
    function parseTime(timeString) {
        if (!timeString) return null;
        const parts = timeString.split(':');
        if (parts.length < 2) return null;
        
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        
        if (isNaN(hours) || isNaN(minutes)) return null;
        
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    }
    
    startTimeInput.addEventListener('change', calculateHours);
    endTimeInput.addEventListener('change', calculateHours);
    
    submitBtn.addEventListener('click', submitOvertime);
    
    loadOvertimeHistory();
});

async function submitOvertime() {
    // Check authentication before submitting
    if (typeof requireAuth !== 'undefined' && !requireAuth()) {
        return; // Will redirect to login
    }

    const recordDate = document.getElementById('recordDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const description = document.getElementById('description').value;
    const messageDiv = document.getElementById('overtime-message');
    const submitBtn = document.getElementById('submitOvertimeBtn');
    
    if (!recordDate || !startTime || !endTime) {
        showError('Please fill in date, start time, and end time');
        return;
    }
    
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    if (!start || !end) {
        showError('Invalid time format');
        return;
    }
    
    if (end <= start) {
        showError('End time must be after start time');
        return;
    }
    
    // Disable submit button during request
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }
    
    try {
        const response = await apiRequest('/api/overtime', {
            method: 'POST',
            body: {
                recordDate: recordDate,
                startTime: startTime,
                endTime: endTime,
                description: description || null,
            },
        });
        
        showSuccess('Overtime recorded successfully!');
        
        document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
        document.getElementById('totalHours').value = '';
        document.getElementById('description').value = '';
        
        setTimeout(() => {
            loadOvertimeHistory();
        }, 500);
    } catch (error) {
        console.error('Overtime submission error:', error);
        showError('Failed to record overtime: ' + (error.message || 'Unknown error'));
    } finally {
        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Record Overtime';
        }
    }
}

function parseTime(timeString) {
    if (!timeString) return null;
    const parts = timeString.split(':');
    if (parts.length < 2) return null;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

async function loadOvertimeHistory() {
    // Check authentication before loading history
    if (typeof requireAuth !== 'undefined' && !requireAuth()) {
        return; // Will redirect to login
    }

    const container = document.getElementById('overtime-history-container');
    if (!container) {
        return;
    }
    
    container.innerHTML = '<h3>Overtime History</h3><p>Loading overtime records...</p>';
    
    try {
        const records = await apiRequest('/api/overtime/my-overtime');
        
        if (records.length === 0) {
            container.innerHTML = '<h3>Overtime History</h3><p>No overtime records found.</p>';
            return;
        }
        
        displayOvertimeHistory(records);
    } catch (error) {
        console.error('Failed to load overtime history:', error);
        showError('Failed to load overtime history: ' + (error.message || 'Unknown error'));
        container.innerHTML = '<h3>Overtime History</h3><p>Failed to load overtime records.</p>';
    }
}

function displayOvertimeHistory(records) {
    const container = document.getElementById('overtime-history-container');
    
    const historyHTML = `
        <h3>Overtime History</h3>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Total Hours</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${records.map(record => `
                    <tr>
                        <td>${formatDate(record.recordDate)}</td>
                        <td>${formatTime(record.startTime)}</td>
                        <td>${formatTime(record.endTime)}</td>
                        <td>${record.totalHours} hours</td>
                        <td>${record.description || 'N/A'}</td>
                        <td>
                            <span class="status-badge status-${record.status}">${record.status}</span>
                        </td>
                        <td>
                            ${record.status === 'pending' ? `
                                <button class="btn-danger delete-overtime-btn" data-record-id="${record.id}">
                                    Delete
                                </button>
                            ` : '<span class="text-muted">-</span>'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = historyHTML;
    
    document.querySelectorAll('.delete-overtime-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const recordId = btn.getAttribute('data-record-id');
            deleteOvertimeRecord(recordId);
        });
    });
}

async function deleteOvertimeRecord(recordId) {
    if (!confirm('Are you sure you want to delete this overtime record?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/overtime/${recordId}`, {
            method: 'DELETE',
        });
        
        showSuccess('Overtime record deleted successfully!');
        loadOvertimeHistory();
    } catch (error) {
        showError('Failed to delete overtime record: ' + error.message);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(timeString) {
    if (!timeString) return 'N/A';
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${minutes} ${ampm}`;
}

function showError(message) {
    const messageDiv = document.getElementById('overtime-message');
    messageDiv.innerHTML = `<div class="error">${message}</div>`;
}

function showSuccess(message) {
    const messageDiv = document.getElementById('overtime-message');
    messageDiv.innerHTML = `<div class="success">${message}</div>`;
}

