// Dashboard JavaScript

const apiRequest = (endpoint, options) => {
    const impl = globalThis.apiRequest;
    if (typeof impl !== 'function') {
        throw new Error('apiRequest is not registered; load main.js before dashboard.js.');
    }
    return impl(endpoint, options);
};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardSummary();
    loadUpcomingItems();
});

async function loadDashboardSummary() {
    try {
        const [bookings, reservations, overtimeRecords] = await Promise.all([
            apiRequest('/api/bookings/my-bookings').catch(() => []),
            apiRequest('/api/parking-reservations/my-reservations').catch(() => []),
            apiRequest('/api/overtime/my-overtime').catch(() => []),
        ]);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const activeBookings = bookings.filter(b => {
            if (b.status !== 'active') return false;
            const endDate = new Date(b.endDate);
            endDate.setHours(0, 0, 0, 0);
            return endDate >= today;
        });
        
        const activeReservations = reservations.filter(r => {
            if (r.status !== 'active') return false;
            const resDate = new Date(r.reservationDate);
            resDate.setHours(0, 0, 0, 0);
            return resDate >= today;
        });
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyOvertime = overtimeRecords
            .filter(r => {
                const recordDate = new Date(r.recordDate);
                return recordDate.getMonth() === currentMonth && 
                       recordDate.getFullYear() === currentYear &&
                       r.status === 'approved';
            })
            .reduce((sum, r) => sum + parseFloat(r.totalHours || 0), 0);
        
        document.getElementById('active-bookings-count').textContent = activeBookings.length;
        document.getElementById('active-reservations-count').textContent = activeReservations.length;
        document.getElementById('total-overtime-hours').textContent = monthlyOvertime.toFixed(1);
    } catch (error) {
        console.error('Failed to load dashboard summary:', error);
        document.getElementById('active-bookings-count').textContent = '0';
        document.getElementById('active-reservations-count').textContent = '0';
        document.getElementById('total-overtime-hours').textContent = '0';
    }
}

async function loadUpcomingItems() {
    const container = document.getElementById('upcoming-list');
    
    try {
        const [bookings, reservations] = await Promise.all([
            apiRequest('/api/bookings/my-bookings').catch(() => []),
            apiRequest('/api/parking-reservations/my-reservations').catch(() => []),
        ]);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingItems = [];
        
        bookings
            .filter(b => b.status === 'active')
            .forEach(b => {
                const startDate = new Date(b.startDate);
                startDate.setHours(0, 0, 0, 0);
                if (startDate >= today) {
                    upcomingItems.push({
                        type: 'booking',
                        date: b.startDate,
                        title: `Desk ${b.deskNumber}`,
                        location: b.location || 'Office',
                    });
                }
            });
        
        reservations
            .filter(r => r.status === 'active')
            .forEach(r => {
                const resDate = new Date(r.reservationDate);
                resDate.setHours(0, 0, 0, 0);
                if (resDate >= today) {
                    upcomingItems.push({
                        type: 'reservation',
                        date: r.reservationDate,
                        title: `Parking Space ${r.spaceNumber}`,
                        location: r.location || 'Parking Lot',
                        timePeriod: r.timePeriod,
                    });
                }
            });
        
        upcomingItems.sort((a, b) => new Date(a.date) - new Date(b.date));
        upcomingItems.splice(5);
        
        if (upcomingItems.length === 0) {
            container.innerHTML = '<p>No upcoming bookings or reservations.</p>';
            return;
        }
        
        const itemsHTML = `
            <ul class="upcoming-list">
                ${upcomingItems.map(item => `
                    <li class="upcoming-item">
                        <div class="upcoming-date">${formatDate(item.date)}</div>
                        <div class="upcoming-details">
                            <strong>${item.title}</strong>
                            <span class="upcoming-location">${item.location}</span>
                            ${item.timePeriod ? `<span class="upcoming-period">${formatTimePeriod(item.timePeriod)}</span>` : ''}
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
        
        container.innerHTML = itemsHTML;
    } catch (error) {
        container.innerHTML = '<p>Failed to load upcoming items.</p>';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === today.getTime()) {
        return 'Today';
    }
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateOnly.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimePeriod(period) {
    const labels = {
        morning: 'Morning',
        afternoon: 'Afternoon',
        full_day: 'Full Day',
    };
    return labels[period] || period;
}

