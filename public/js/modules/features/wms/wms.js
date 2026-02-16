import { state } from '../../core/state';

export async function getWmsSyncButton(ts) {
    const currentUser = state.get('currentUser');

    // For the current user's own timesheets, check if they have a DE role
    const isOwnTimesheet = currentUser && currentUser.employeeId &&
        ts.employee && ts.employee.id === currentUser.employeeId;

    if (isOwnTimesheet) {
        const emp = currentUser.employee;
        if (!emp || !employeeHasWmsSyncRole(emp)) {
            return ''; // No button if user has no WMS-sync-enabled role
        }
    }

    // Check if timesheet has WMS-syncable entries
    const hasWmsEntries = timesheetHasWmsSyncEntries(ts);

    if (!hasWmsEntries) {
        if (isOwnTimesheet) {
            // Show disabled button for own timesheets so they know it exists
            return `<button class="btn btn-sm btn-info" disabled title="No WMS-syncable entries to sync" style="opacity: 0.5; cursor: not-allowed;">Sync to WMS</button>`;
        }
        return ''; // Hide entirely for admin viewing others with no WMS entries
    }

    return `<button class="btn btn-sm btn-info" onclick="syncToWms(${ts.id})">Sync to WMS</button>`;
}


/**
 * Check if an employee has a role in any company with WMS sync enabled.
 */
export async function employeeHasWmsSyncRole(employee) {
    if (!employee || !employee.roles) return false;
    return employee.roles.some(r =>
        r.company && r.company.wmsSyncEnabled
    );
}

/**
 * Check if a timesheet has any entries for a WMS-sync-enabled company.
 */
function timesheetHasWmsSyncEntries(ts) {
    if (!ts.entries || ts.entries.length === 0) return false;
    return ts.entries.some(e =>
        e.company && e.company.wmsSyncEnabled
    );
}