    let faceCurrentPage = 1;

    function logout() { window.location.href = '/logout'; }

    function showAlert(msg, type) {
        const c = document.getElementById('alertContainer');
        const el = document.createElement('div');
        const kind = type === 'success' ? 'ok' : type === 'danger' ? 'err' : 'warn';
        el.className = 'oa-toast show ' + kind;
        el.innerHTML = '<i class="fas fa-' +
            (type==='success'?'check-circle':type==='danger'?'circle-exclamation':'triangle-exclamation') +
            '"></i><span>' + msg + '</span>';
        document.body.appendChild(el);
        setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(), 300); }, 4200);
    }

    function switchTab(tab, event) {
        document.querySelectorAll('.ad-tab').forEach(t => t.classList.remove('on'));
        document.querySelectorAll('.ad-panel').forEach(c => c.classList.remove('on'));
        if (event && event.target.closest('.ad-tab')) event.target.closest('.ad-tab').classList.add('on');
        const panel = document.getElementById(tab + '-tab');
        if (panel) panel.classList.add('on');
        if (tab === 'early') loadEarlyLogouts();
        if (tab === 'locations') loadLocations();
        if (tab === 'face') loadFaceLogs(1);
        if (tab === 'analysis') loadAnalysisOverview();
    }

    // ── Dashboard Stats ──────────────────────────────────────────────────
    async function loadDashboardStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [locRes, leavesRes, earlyRes, faceRes] = await Promise.all([
                fetch(`/api/admin/user-locations/${today}`),
                fetch('/api/admin/leave-applications?status=pending'),
                fetch('/api/admin/early-logouts'),
                fetch('/api/admin/face-logs?per_page=1')
            ]);
            const [locData, leavesData, earlyData, faceData] = await Promise.all([locRes.json(), leavesRes.json(), earlyRes.json(), faceRes.json()]);
            document.getElementById('todayAttendance').textContent = locData.count || 0;
            document.getElementById('pendingLeaves').textContent = leavesData.applications?.length || 0;
            document.getElementById('earlyLogouts').textContent = earlyData.count || 0;
            document.getElementById('faceLogs24h').textContent = faceData.total || 0;

            const failRes = await fetch(`/api/admin/face-logs?match=false&date=${today}&per_page=1`);
            const failData = await failRes.json();
            document.getElementById('faceFailures').textContent = failData.total || 0;

            const allLoc = await fetch(`/api/admin/user-locations/${today}`);
            const allLocData = await allLoc.json();
            let html = '';
            (allLocData.locations || []).slice(0, 15).forEach(l => {
                html += `<tr>
                    <td><strong>${l.username}</strong></td>
                    <td>${l.date}</td>
                    <td>${l.shift_name}</td>
                    <td>${l.login_time}</td>
                    <td>${l.logout_time || '<span style="color:#34c759;">Active</span>'}</td>
                    <td>${l.hours} hrs</td>
                    <td style="font-size:0.8rem;color:#86868b;">${l.device_info?.device_name || '-'}</td>
                </tr>`;
            });
            document.getElementById('recentActivity').innerHTML = html || '<tr><td colspan="7" style="text-align:center;">No activity today</td></tr>';
        } catch (err) { console.error('Stats error:', err); }
    }


    // ═════════════════════════════════════
    //  BULK SHIFT CONTROL — turn shift attendance on/off for everyone
    // ═════════════════════════════════════
    async function setShiftForEveryone(enabled) {
        const word = enabled ? 'switch on' : 'switch off';
        if (!confirm('This will ' + word + ' shift attendance for every non-admin user. Continue?')) return;

        const btns = document.querySelectorAll('[data-bulk-shift]');
        btns.forEach(b => b.disabled = true);
        try {
            const res = await fetch('/api/admin/shift-login/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: enabled })
            });
            const data = await res.json();
            if (data.ok) {
                showAlert('Shift attendance ' + (enabled ? 'switched on' : 'switched off') +
                          ' for ' + data.modified + ' user' + (data.modified === 1 ? '' : 's'), 'success');
                document.querySelectorAll('input[data-shift-toggle]').forEach(t => { t.checked = enabled; });
                document.querySelectorAll('[id^="chip-shift-"]').forEach(chip => {
                    chip.className = 'oa-tag ' + (enabled ? 'ok' : '');
                    chip.innerHTML = '<i class="fas fa-' + (enabled ? 'layer-group' : 'ban') + '"></i> ' +
                                     (enabled ? 'Shifts on' : 'Shifts off');
                });
            } else {
                showAlert(data.error || 'Could not update', 'danger');
            }
        } catch (e) {
            showAlert('Network error: ' + e.message, 'danger');
        } finally {
            btns.forEach(b => b.disabled = false);
        }
    }

    // ── Face ID Toggle Controls ──────────────────────────────────────────
    async function toggleFaceSetting(userId, setting, value, username) {
        try {
            const body = {};
            body[setting] = value;
            const res = await fetch(`/api/admin/user/${userId}/face-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.ok) {
                // Pick the correct human-readable label
                let label;
                if (setting === 'face_required') label = 'Face ID Requirement';
                else if (setting === 'face_registration_enabled') label = 'Face Registration';
                else if (setting === 'shift_login_enabled') label = 'Shift Login';
                else label = setting;

                const state = value ? 'enabled' : 'disabled';
                showAlert(`${label} ${state} for ${username}`, 'success');

                // Update status chips (only for face-related settings)
                if (setting === 'face_required') {
                    const chip = document.getElementById(`chip-req-${userId}`);
                    if (chip) {
                        chip.className = 'oa-tag ' + (value ? 'ok' : '');
                        chip.innerHTML = '<i class="fas fa-' + (value ? 'lock' : 'lock-open') + '"></i> ' + (value ? 'Face ID on' : 'Face ID off');
                    }
                } else if (setting === 'face_registration_enabled') {
                    const chip = document.getElementById(`chip-reg-${userId}`);
                    if (chip) {
                        chip.className = 'oa-tag ' + (value ? 'ok' : '');
                        chip.innerHTML = '<i class="fas fa-' + (value ? 'check' : 'xmark') + '"></i> ' + (value ? 'Can register' : 'Cannot register');
                    }
                }
                } else if (setting === 'shift_login_enabled') {
                    const chip = document.getElementById(`chip-shift-${userId}`);
                    if (chip) {
                        chip.className = 'oa-tag ' + (value ? 'ok' : '');
                        chip.innerHTML = '<i class="fas fa-' + (value ? 'layer-group' : 'ban') + '"></i> ' + (value ? 'Shifts on' : 'Shifts off');
                    }
            } else {
                showAlert(data.error || 'Update failed', 'danger');
                // Revert toggle on failure — find the correct toggle by data-uid
                const allToggles = document.querySelectorAll(`input[data-uid="${userId}"]`);
                allToggles.forEach(t => {
                    const onchangeAttr = t.getAttribute('onchange') || '';
                    if (onchangeAttr.includes(`'${setting}'`)) t.checked = !value;
                });
            }
        } catch (e) {
            showAlert('Network error: ' + e.message, 'danger');
        }
    }

    async function clearFaceData(userId, username) {
        if (!confirm(`Reset face data for "${username}"?\n\nThis will delete all stored face photos and require them to re-register (if admin re-enables registration).`)) return;
        try {
            const res = await fetch(`/api/admin/user/${userId}/face-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear_face_data: true })
            });
            const data = await res.json();
            if (data.ok) {
                showAlert(`Face data cleared for ${username}`, 'success');
                setTimeout(() => location.reload(), 1200);
            } else showAlert(data.error, 'danger');
        } catch { showAlert('Error clearing face data', 'danger'); }
    }

    // ── Face Security Logs ────────────────────────────────────────────────
    async function loadFaceLogs(page = 1) {
        faceCurrentPage = page;
        const user = document.getElementById('filterUser').value.trim();
        const match = document.getElementById('filterMatch').value;
        const date = document.getElementById('filterDate').value;
        const shift = document.getElementById('filterShift').value;

        let url = `/api/admin/face-logs?page=${page}&per_page=12`;
        if (user) url += `&username=${encodeURIComponent(user)}`;
        if (match !== '') url += `&match=${match}`;
        if (date) url += `&date=${date}`;
        if (shift) url += `&shift=${shift}`;

        document.getElementById('faceLogsGrid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#86868b;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><br>Loading...</div>';

        try {
            const res = await fetch(url);
            const data = await res.json();
            document.getElementById('faceTotalBadge').textContent = `${data.total} Total Logs`;

            if (!data.logs || data.logs.length === 0) {
                document.getElementById('faceLogsGrid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#86868b;"><i class="fas fa-camera-slash" style="font-size:3rem;margin-bottom:16px;display:block;"></i>No face logs found</div>';
                document.getElementById('facePagination').innerHTML = '';
                return;
            }

            let html = '';
            data.logs.forEach(log => {
                const matched = log.match_result;
                const di = log.device_info || {};
                const thumbSrc = log.face_thumb_b64 ? `data:image/jpeg;base64,${log.face_thumb_b64}` : null;
                html += `<div class="face-log-card ${matched ? 'matched' : 'failed'}">
                    <div class="face-photo-container">
                        ${thumbSrc ? `<img src="${thumbSrc}" alt="Face capture" loading="lazy">` : '<div class="face-photo-placeholder"><i class="fas fa-user-circle"></i></div>'}
                        <div class="face-match-badge ${matched ? 'matched' : 'failed'}">${matched ? '✅ Matched' : '❌ Failed'}</div>
                    </div>
                    <div class="face-log-body">
                        <div class="face-log-username">${log.username}</div>
                        <div class="face-log-time">${log.timestamp_ist || 'N/A'}</div>
                        <div class="face-log-time" style="color: #0071e3; font-weight: bold; margin-top: 2px;">${log.shift_name || 'Normal Login'}</div>
                        <div class="device-info-grid">
                            <span class="di-label">Device</span><span class="di-value">${di.device_name || 'Unknown'}</span>
                            <span class="di-label">Browser</span><span class="di-value">${di.browser || 'Unknown'}</span>
                            <span class="di-label">IP</span><span class="di-value">${log.ip_address || 'N/A'}</span>
                            <span class="di-label">IMEI</span><span class="di-value" style="color:${di.imei && di.imei !== 'Not available (browser)' ? '#0071e3' : '#86868b'};">${di.imei || 'N/A'}</span>
                            <span class="di-label">Screen</span><span class="di-value">${di.screen || 'N/A'}</span>
                            <span class="di-label">Distance</span><span class="di-value">${log.match_distance ?? 'N/A'}</span>
                        </div>
                        <div class="face-log-actions">
                            <button class="view-full-btn" onclick="viewFaceLogDetail('${log.id}')"><i class="fas fa-expand"></i> View Full</button>
                            <button class="delete-log-btn" onclick="deleteFaceLog('${log.id}', this)"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            });

            document.getElementById('faceLogsGrid').innerHTML = html;

            const totalPages = Math.ceil(data.total / 12);
            let pag = '';
            if (totalPages > 1) {
                pag += `<button class="btn" onclick="loadFaceLogs(${Math.max(1, page-1)})" ${page===1?'disabled':''}>◀</button>`;
                for (let p = Math.max(1, page-2); p <= Math.min(totalPages, page+2); p++) {
                    pag += `<button class="btn ${p===page?'btn-primary':''}" onclick="loadFaceLogs(${p})">${p}</button>`;
                }
                pag += `<button class="btn" onclick="loadFaceLogs(${Math.min(totalPages, page+1)})" ${page===totalPages?'disabled':''}>▶</button>`;
                pag += `<span class="pagination-info">Page ${page} of ${totalPages} (${data.total} logs)</span>`;
            }
            document.getElementById('facePagination').innerHTML = pag;

        } catch (err) {
            document.getElementById('faceLogsGrid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:#ff3b30;">Error loading face logs: ${err.message}</div>`;
        }
    }

    async function viewFaceLogDetail(logId) {
        document.getElementById('fullFaceModal').classList.add('active');
        document.getElementById('fullFaceContent').innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i></div>';
        try {
            const res = await fetch(`/api/admin/face-logs/${logId}/image`);
            const data = await res.json();
            const di = data.device_info || {};
            const matched = data.match_result;
            document.getElementById('fullFaceTitle').textContent = `${data.username} – ${data.timestamp_ist}`;
            document.getElementById('fullFaceContent').innerHTML = `
                <div style="position:relative;border-radius:16px;overflow:hidden;background:#000;margin-bottom:20px;">
                    ${data.face_image_b64 ? `<img src="data:image/jpeg;base64,${data.face_image_b64}" class="full-face-img" alt="Face capture">` : '<div style="height:200px;display:flex;align-items:center;justify-content:center;color:#86868b;font-size:3rem;"><i class="fas fa-user-circle"></i></div>'}
                    <div style="position:absolute;top:14px;right:14px;padding:8px 18px;border-radius:30px;font-weight:700;background:${matched?'rgba(52,199,89,0.9)':'rgba(255,59,48,0.9)'};color:white;">
                        ${matched ? '✅ Face Matched' : '❌ Verification Failed'}
                    </div>
                </div>
                <div class="imei-highlight">
                    <div class="imei-label">IMEI / Device Identifier</div>
                    <div class="imei-value">${di.imei || 'Not available (browser-based login)'}</div>
                </div>
                <div class="full-device-grid">
                    <div class="full-device-item"><div class="label">Device Name</div><div class="value">${di.device_name || 'Unknown'}</div></div>
                    <div class="full-device-item"><div class="label">Browser</div><div class="value">${di.browser || 'Unknown'}</div></div>
                    <div class="full-device-item"><div class="label">Platform</div><div class="value">${di.platform || 'Unknown'}</div></div>
                    <div class="full-device-item"><div class="label">Screen Resolution</div><div class="value">${di.screen || 'N/A'}</div></div>
                    <div class="full-device-item"><div class="label">IP Address</div><div class="value">${data.ip_address || 'N/A'}</div></div>
                    <div class="full-device-item"><div class="label">Timezone</div><div class="value">${di.timezone || 'N/A'}</div></div>
                    <div class="full-device-item"><div class="label">RAM</div><div class="value">${di.device_memory ? di.device_memory + ' GB' : 'N/A'}</div></div>
                    <div class="full-device-item"><div class="label">CPU Cores</div><div class="value">${di.hardware_concurrency || 'N/A'}</div></div>
                </div>
                <div style="margin-top:20px;padding:16px;background:#f5f5f7;border-radius:12px;font-size:0.85rem;color:#86868b;">
                    <i class="fas fa-info-circle" style="color:#0071e3;"></i>
                    <strong>User Agent:</strong> ${di.user_agent || 'N/A'}
                </div>
                ${data.lat && data.lng ? `
                <div style="margin-top:16px;background:#f5f5f7;border-radius:14px;padding:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <strong><i class="fas fa-map-marked-alt" style="color:#0071e3;"></i> Verification Location & Google Map</strong>
                        <a href="https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}" target="_blank" style="font-size:0.8rem;color:#0071e3;font-weight:bold;text-decoration:none;">Open in Google Maps ➔</a>
                    </div>
                    <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e5e7;">
                        <iframe src="https://maps.google.com/maps?q=${data.lat},${data.lng}&z=16&output=embed" width="100%" height="160" style="border:0;display:block;" loading="lazy"></iframe>
                    </div>
                </div>` : ''}
                <div style="margin-top:20px;display:flex;gap:12px;">
                    <button class="btn btn-danger" onclick="deleteFaceLogFromModal('${logId}')"><i class="fas fa-trash"></i> Delete This Log</button>
                    <button class="btn btn-ghost" onclick="closeFaceImageModal()">Close</button>
                </div>`;
        } catch (err) {
            document.getElementById('fullFaceContent').innerHTML = `<div style="text-align:center;padding:40px;color:#ff3b30;">Error: ${err.message}</div>`;
        }
    }

    async function deleteFaceLog(logId, btnEl) {
        if (!confirm('Delete this face log? The image will be permanently removed.')) return;
        try {
            const res = await fetch(`/api/admin/face-logs/${logId}/delete`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) { showAlert('Face log deleted', 'success'); btnEl.closest('.face-log-card').remove(); }
            else showAlert(data.error, 'danger');
        } catch { showAlert('Delete failed', 'danger'); }
    }

    async function deleteFaceLogFromModal(logId) {
        if (!confirm('Delete this face log?')) return;
        try {
            const res = await fetch(`/api/admin/face-logs/${logId}/delete`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) { showAlert('Deleted', 'success'); closeFaceImageModal(); loadFaceLogs(faceCurrentPage); }
            else showAlert(data.error, 'danger');
        } catch { showAlert('Delete failed', 'danger'); }
    }

    async function purgeOldLogs() {
        const days = parseInt(document.getElementById('purgedays').value);
        if (!confirm(`Delete all face logs older than ${days} days? This cannot be undone.`)) return;
        try {
            const res = await fetch('/api/admin/face-logs/purge-old', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) });
            const data = await res.json();
            if (data.ok) { showAlert(data.message, 'success'); loadFaceLogs(1); }
            else showAlert(data.error, 'danger');
        } catch { showAlert('Purge failed', 'danger'); }
    }

    function clearFaceFilters() {
        document.getElementById('filterUser').value = '';
        document.getElementById('filterMatch').value = '';
        document.getElementById('filterDate').value = '';
        document.getElementById('filterShift').value = '';
        loadFaceLogs(1);
    }

    function closeFaceImageModal() { document.getElementById('fullFaceModal').classList.remove('active'); }

    // ── User Details Modal ────────────────────────────────────────────────
    async function viewUserDetails(userId) {
        try {
            const res = await fetch(`/api/admin/user-stats/${userId}`);
            const data = await res.json();
            const shiftTarget = data.work_hours_target / 2;
            let shiftHtml = '';
            if (data.shift_usage) {
                shiftHtml = '<h4 style="margin:20px 0 10px;">Shift Usage</h4>';
                Object.entries(data.shift_usage).forEach(([shift, stats]) => {
                    shiftHtml += `<div style="background:#f5f5f7;padding:16px;border-radius:12px;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;"><strong>${stats.name}</strong><span>${stats.count} sessions</span></div><div>Total Hours: ${stats.total_hours.toFixed(1)} hrs</div></div>`;
                });
            }

            // Face status section
            let faceHtml = `
                <div style="background:#f5f5f7;padding:16px;border-radius:12px;margin-top:16px;">
                    <div style="font-size:0.8rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#86868b;margin-bottom:12px;">
                        <i class="fas fa-camera" style="color:#0071e3;"></i> Face ID Status
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div>
                            <div style="font-size:0.75rem;color:#86868b;">Registration</div>
                            <div style="font-weight:700;">${data.face_registered ? '✅ Registered (' + (data.face_photo_count || 0) + ' photos)' : '❌ Not Registered'}</div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem;color:#86868b;">Face ID Required</div>
                            <div style="font-weight:700;">${data.face_required ? '🔒 Yes — enforced' : '🔓 No — optional'}</div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem;color:#86868b;">Registration Allowed</div>
                            <div style="font-weight:700;">${data.face_registration_enabled ? '✅ Admin enabled' : '❌ Admin blocked'}</div>
                        </div>
                    </div>
                    ${data.face_thumb ? `<img src="data:image/jpeg;base64,${data.face_thumb}" style="width:100%;border-radius:10px;margin-top:12px;max-height:160px;object-fit:cover;">` : ''}
                </div>`;

            document.getElementById('userDetails').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card"><div class="value">${data.total_working_days||0}</div><div class="label">Total Days</div></div>
                    <div class="stat-card"><div class="value">${data.attendance_this_month||0}</div><div class="label">This Month</div></div>
                    <div class="stat-card"><div class="value">${data.leaves_this_month||0}</div><div class="label">Leaves</div></div>
                </div>
                <div style="margin:20px 0;background:#f5f5f7;padding:16px;border-radius:12px;">
                    <p><strong>Email:</strong> ${data.email||'N/A'}</p>
                    <p style="margin-top:8px;"><strong>Target:</strong> ${data.work_hours_target} hrs/day (${shiftTarget} hrs per shift)</p>
                </div>
                ${faceHtml}
                <div style="margin-top:20px;">
                    <label><strong>Update Work Hours:</strong></label>
                    <div style="display:flex;gap:10px;margin-top:10px;">
                        <input type="number" id="newWorkHours" value="${data.work_hours_target}" step="0.5" style="flex:1;padding:10px;border-radius:8px;border:1px solid #e5e5e7;">
                        <button class="btn btn-primary" onclick="updateWorkHours('${userId}')">Update</button>
                    </div>
                </div>
                ${shiftHtml}`;
            document.getElementById('userModal').classList.add('active');
        } catch { showAlert('Failed to load user details', 'danger'); }
    }

    async function updateWorkHours(userId) {
        const newHours = document.getElementById('newWorkHours').value;
        try {
            const res = await fetch('/api/admin/update-user-work-hours', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: userId, work_hours: parseFloat(newHours) }) });
            const data = await res.json();
            if (data.ok) { showAlert(data.message, 'success'); closeUserModal(); }
            else showAlert(data.error, 'danger');
        } catch { showAlert('Failed to update', 'danger'); }
    }

    function closeUserModal() { document.getElementById('userModal').classList.remove('active'); }

    async function deleteUser(userId, username) {
        if (!confirm(`Delete user "${username}"? This removes all their attendance, leaves, and face data.`)) return;
        try {
            const res = await fetch(`/admin/delete_user/${userId}`, { method:'POST' });
            const data = await res.json();
            if (data.ok) { showAlert(data.message, 'success'); setTimeout(() => location.reload(), 1000); }
            else showAlert(data.error, 'danger');
        } catch { showAlert('Error deleting user', 'danger'); }
    }

    // ── Leaves ────────────────────────────────────────────────────────────
    function filterLeaves(status) { window.location.href = `/admin/dashboard?status=${status}`; }
    function reviewLeave(leaveId, action) {
        const comments = prompt(`Enter comments for ${action} leave:`);
        if (comments === null) return;
        fetch(`/api/admin/leave/${leaveId}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: action, admin_comments: comments }) })
        .then(r => r.json()).then(d => { if (d.ok) { showAlert(`Leave ${action}`, 'success'); setTimeout(() => location.reload(), 1000); } else showAlert(d.error, 'danger'); })
        .catch(() => showAlert('Failed to update', 'danger'));
    }

    // ── Locations & Google Maps ───────────────────────────────────────────
    let adminMap = null;
    let mapMarkers = [];

    async function loadLocations() {
        const date = document.getElementById('locationDate').value;
        if (!date) return;
        // Point the analysis range at the day being viewed (until the admin widens it).
        const anFrom = document.getElementById('anFrom');
        const anTo   = document.getElementById('anTo');
        if (anFrom && !anFrom.dataset.touched) anFrom.value = date;
        if (anTo && !anTo.dataset.touched)     anTo.value = date;
        try {
            const res = await fetch(`/api/admin/user-locations/${date}`);
            const data = await res.json();
            let html = '';
            
            const mapContainer = document.getElementById('adminLocationsMap');
            
            if (!data.locations || !data.locations.length) {
                html = '<div style="text-align:center;padding:40px;color:#86868b;"><i class="fas fa-map-marker-slash" style="font-size:3rem;margin-bottom:12px;display:block;"></i>No location records for this date</div>';
                mapContainer.style.display = 'none';
            } else {
                mapContainer.style.display = 'block';

                // Initialize or refresh main Leaflet Map
                const officeLat = data.office_lat || 12.9248224;
                const officeLng = data.office_lng || 77.5702351;

                if (!adminMap) {
                    adminMap = L.map('adminLocationsMap').setView([officeLat, officeLng], 14);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OpenStreetMap | JAIN Attendance'
                    }).addTo(adminMap);
                } else {
                    adminMap.setView([officeLat, officeLng], 14);
                    mapMarkers.forEach(m => adminMap.removeLayer(m));
                    mapMarkers = [];
                }

                // Add JAIN Head Office Campus boundary circle (500m radius)
                const campusCircle = L.circle([officeLat, officeLng], {
                    color: '#0071e3',
                    fillColor: '#0071e3',
                    fillOpacity: 0.1,
                    radius: 500
                }).addTo(adminMap).bindPopup('<strong>JAIN University Campus</strong><br>500m allowed radius zone');
                mapMarkers.push(campusCircle);

                const bounds = L.latLngBounds([[officeLat, officeLng]]);

                data.locations.forEach(l => {
                    const di = l.device_info || {};
                    const faceRequired = l.face_required;
                    const hasCoords = l.login_lat && l.login_lng;

                    if (hasCoords) {
                        const marker = L.marker([l.login_lat, l.login_lng]).addTo(adminMap)
                            .bindPopup(`
                                <div style="font-family:sans-serif;padding:4px;">
                                    <strong style="color:#0071e3;font-size:0.95rem;">${l.username}</strong><br>
                                    <span style="font-size:0.8rem;color:#555;">Shift: ${l.shift_name}</span><br>
                                    <span style="font-size:0.8rem;color:#555;">Login: ${l.login_time}</span><br>
                                    <div style="font-size:0.75rem;margin-top:4px;color:#333;">${l.login_address}</div>
                                    <a href="https://www.google.com/maps/search/?api=1&query=${l.login_lat},${l.login_lng}" target="_blank" style="font-size:0.75rem;color:#0071e3;display:inline-block;margin-top:6px;font-weight:bold;text-decoration:none;">View in Google Maps ➔</a>
                                </div>
                            `);
                        mapMarkers.push(marker);
                        bounds.extend([l.login_lat, l.login_lng]);
                    }

                    const googleMapsUrl = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${l.login_lat},${l.login_lng}` : '#';
                    const googleEmbedUrl = hasCoords ? `https://www.openstreetmap.org/export/embed.html?bbox=${l.login_lng-0.004},${l.login_lat-0.004},${l.login_lng+0.004},${l.login_lat+0.004}&layer=mapnik&marker=${l.login_lat},${l.login_lng}` : null;

                    html += `<div style="background:#ffffff;border:1px solid rgba(0,0,0,0.06);box-shadow:0 4px 15px rgba(0,0,0,0.03);border-radius:16px;padding:20px;margin-bottom:18px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;align-items:center;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <strong style="font-size:1.05rem;">${l.username}</strong>
                                <span class="badge" style="background:${l.at_office?'#34c759':'#ff9500'};color:white;">${l.at_office?'🏛️ On Campus':'📡 Remote'}</span>
                            </div>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <span class="badge" style="background:${l.shift_type==='shift1'?'#0071e3':l.shift_type==='shift2'?'#ff9500':'#86868b'};color:white;">${l.shift_name}</span>
                                ${faceRequired ? '<span class="badge" style="background:rgba(0,113,227,0.15);color:#0071e3;border:1px solid rgba(0,113,227,0.3);">🔒 Face ID</span>' : ''}
                                ${hasCoords ? `<a href="${googleMapsUrl}" target="_blank" class="btn btn-sm btn-primary" style="padding:4px 10px;font-size:0.75rem;text-decoration:none;"><i class="fas fa-map-marked-alt"></i> Open Google Maps</a>` : ''}
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">
                            <div>
                                <div style="font-size:0.78rem;color:#86868b;font-weight:700;">LOGIN LOCATION</div>
                                <div style="font-weight:600;margin-top:2px;">${l.login_time}</div>
                                <div style="font-size:0.82rem;margin-top:4px;color:#444;"><i class="fas fa-location-dot" style="color:#0071e3;"></i> ${l.login_address}${hasCoords ? ` <span style="font-size:0.75rem;color:#888;">(${l.login_lat.toFixed(6)}, ${l.login_lng.toFixed(6)})</span>` : ''}</div>
                            </div>
                            ${l.logout_time ? `<div>
                                <div style="font-size:0.78rem;color:#86868b;font-weight:700;">LOGOUT LOCATION</div>
                                <div style="font-weight:600;margin-top:2px;">${l.logout_time}</div>
                                <div style="font-size:0.82rem;margin-top:4px;color:#444;"><i class="fas fa-location-dot" style="color:#ff3b30;"></i> ${l.logout_address||'N/A'}${l.logout_lat && l.logout_lng ? ` <span style="font-size:0.75rem;color:#888;">(${l.logout_lat.toFixed(6)}, ${l.logout_lng.toFixed(6)})</span>` : ''}</div>
                            </div>` : ''}
                        </div>

                        ${googleEmbedUrl ? `
                        <div style="margin-top:12px;border-radius:12px;overflow:hidden;border:1px solid #e5e5e7;">
                            <iframe src="${googleEmbedUrl}" width="100%" height="180" style="border:0;" allowfullscreen="" loading="lazy"></iframe>
                        </div>` : ''}

                        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.82rem;border-top:1px solid #f0f0f2;padding-top:12px;margin-top:12px;color:#666;">
                            <span><i class="fas fa-mobile-alt" style="color:#0071e3;"></i> ${di.device_name||'Unknown'}</span>
                            <span><i class="fas fa-globe"></i> ${di.browser||'-'}</span>
                            <span><i class="fas fa-network-wired"></i> ${di.ip_address||'-'}</span>
                            <span><i class="fas fa-barcode"></i> IMEI: ${di.imei||'N/A'}</span>
                            <span style="margin-left:auto;font-weight:700;color:#0071e3;">${l.hours} hrs</span>
                        </div>
                    </div>`;
                });

                adminMap.fitBounds(bounds, { padding: [30, 30] });
                setTimeout(() => adminMap.invalidateSize(), 300);
            }
            document.getElementById('locationsList').innerHTML = html;
        } catch (err) {
            showAlert('Failed to load locations: ' + err.message, 'danger');
        }
    }

    // ── Analysis dashboard (Power-BI style) ───────────────────────────────
    const AN_CATS = {
        complete: { label: 'On track',       icon: 'fa-circle-check',        color: 'var(--ok)'   },
        active:   { label: 'Still active',    icon: 'fa-circle-play',         color: 'var(--info)' },
        early:    { label: 'Left early',      icon: 'fa-triangle-exclamation',color: 'var(--warn)' },
        absent:   { label: 'Missed sign-in',  icon: 'fa-user-xmark',          color: 'var(--bad)'  },
        on_leave: { label: 'On leave',        icon: 'fa-plane-departure',     color: 'var(--t3)'   },
    };
    // Concrete colours for the donut/legend (conic-gradient can't read CSS vars reliably).
    const AN_HEX = { complete:'#2E7D46', active:'#0071e3', early:'#C77700', absent:'#C0362C', on_leave:'#8F98A6' };

    async function loadAnalysisOverview() {
        const dateEl = document.getElementById('analysisDate');
        const day = dateEl ? dateEl.value : '';
        const cols = document.getElementById('anColumns');
        cols.innerHTML = '<div class="oa-empty"><i class="fas fa-circle-notch spin"></i><p>Loading analysis…</p></div>';
        try {
            const res = await fetch('/api/admin/analysis-overview?date=' + encodeURIComponent(day));
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load analysis');
            renderAnalysis(data);
        } catch (err) {
            cols.innerHTML = '<div class="oa-empty"><i class="fas fa-triangle-exclamation"></i><p>' + err.message + '</p></div>';
        }
    }

    function renderAnalysis(data) {
        const t = data.totals;
        // KPI tiles
        document.getElementById('kpiRegistered').textContent = t.registered;
        document.getElementById('kpiComplete').textContent   = t.complete;
        document.getElementById('kpiActive').textContent     = t.active;
        document.getElementById('kpiEarly').textContent      = t.early;
        document.getElementById('kpiAbsent').textContent     = t.absent;
        document.getElementById('kpiLeave').textContent      = t.on_leave;

        // Donut (conic-gradient of the five categories)
        const order = ['complete', 'active', 'early', 'absent', 'on_leave'];
        const denom = order.reduce((s, k) => s + (t[k] || 0), 0) || 1;
        let acc = 0;
        const stops = order.filter(k => t[k] > 0).map(k => {
            const start = acc / denom * 360;
            acc += t[k];
            const end = acc / denom * 360;
            return `${AN_HEX[k]} ${start}deg ${end}deg`;
        });
        const donut = document.getElementById('anDonut');
        donut.style.background = stops.length
            ? `conic-gradient(${stops.join(',')})`
            : 'var(--line)';
        document.getElementById('anDonutPct').textContent = data.rate + '%';

        // Legend
        document.getElementById('anLegend').innerHTML = order.map(k =>
            `<div class="an-leg-item"><span class="an-dot" style="background:${AN_HEX[k]}"></span>
               ${AN_CATS[k].label}<strong>${t[k] || 0}</strong></div>`
        ).join('');

        // Attendance rate bar
        document.getElementById('anRateFill').style.width = data.rate + '%';
        document.getElementById('anRateNote').textContent =
            `${data.signed_in} of ${data.expected} expected signed in`
            + (t.on_leave ? ` · ${t.on_leave} on leave` : '');

        // Category columns with per-user progress
        const cols = document.getElementById('anColumns');
        cols.innerHTML = order.map(k => {
            const people = (data.buckets[k] || []);
            const cat = AN_CATS[k];
            const rows = people.length ? people.map(p => anUserRow(p, k)).join('')
                : '<div class="an-empty-row">Nobody</div>';
            return `<section class="an-col">
                <div class="an-col-head" style="border-color:${AN_HEX[k]}">
                  <i class="fas ${cat.icon}" style="color:${AN_HEX[k]}"></i>
                  <span>${cat.label}</span>
                  <span class="an-col-count">${people.length}</span>
                </div>
                <div class="an-col-body">${rows}</div>
              </section>`;
        }).join('');
    }

    function anUserRow(p, cat) {
        const timeline = (cat === 'complete' || cat === 'early' || cat === 'active')
            ? `<div class="an-u-time">${p.login_time || '—'} → ${p.logout_time || (cat === 'active' ? 'active' : '—')} · ${p.hours}h${cat === 'early' ? ` (−${p.shortfall}h)` : ''}</div>`
            : '';
        const barColor = p.progress_pct >= 80 ? '#2E7D46' : p.progress_pct >= 50 ? '#C77700' : '#C0362C';
        return `<div class="an-u">
            <div class="an-u-top">
              <span class="an-u-name">${p.username}</span>
              <span class="an-u-prog">${p.progress_pct}%</span>
            </div>
            ${timeline}
            <div class="an-u-bar"><div class="an-u-bar-fill" style="width:${p.progress_pct}%;background:${barColor}"></div></div>
            <div class="an-u-sub">30-day: ${p.on_track_days}/${p.present_days} days on target · avg ${p.avg_hours}h</div>
          </div>`;
    }

    // ── Individual attendance calendar ────────────────────────────────────
    const CAL_MONTHS = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    let calUserId = null, calUsername = '', calMonth = '';

    function filterUserCalList() {
        const q = (document.getElementById('anUserSearch').value || '').toLowerCase();
        document.querySelectorAll('#anUserCalList .an-name').forEach(b => {
            b.style.display = b.dataset.name.includes(q) ? '' : 'none';
        });
    }

    function openUserCalendar(btn) {
        calUserId = btn.dataset.uid;
        calUsername = btn.dataset.fullname || '';
        const username = calUsername;
        calMonth = (document.getElementById('analysisDate').value || '').slice(0, 7)
                   || new Date().toISOString().slice(0, 7);
        document.getElementById('calTitle').textContent = username + ' · attendance';
        document.getElementById('calendarModal').classList.add('active');
        loadCalendar();
    }

    function closeCalendarModal() {
        document.getElementById('calendarModal').classList.remove('active');
    }

    function calShiftMonth(delta) {
        let [y, m] = calMonth.split('-').map(Number);
        m += delta;
        if (m < 1)  { m = 12; y--; }
        if (m > 12) { m = 1;  y++; }
        calMonth = `${y}-${String(m).padStart(2, '0')}`;
        loadCalendar();
    }

    async function loadCalendar() {
        const body = document.getElementById('calBody');
        body.innerHTML = '<div class="oa-empty"><i class="fas fa-circle-notch spin"></i><p>Loading…</p></div>';
        try {
            const res = await fetch(`/api/admin/user-calendar/${calUserId}?month=${encodeURIComponent(calMonth)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load');
            renderCalendar(data);
        } catch (err) {
            body.innerHTML = '<div class="oa-empty"><i class="fas fa-triangle-exclamation"></i><p>' + err.message + '</p></div>';
        }
    }

    function renderCalendar(data) {
        const [y, m] = data.month.split('-').map(Number);
        const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();   // 0=Sun
        const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const byDate = {};
        (data.days || []).forEach(d => { byDate[d.date] = d; });

        const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let cells = dow.map(d => `<div class="cal-dow">${d}</div>`).join('');
        for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
        for (let day = 1; day <= daysInMonth; day++) {
            const ds = `${data.month}-${String(day).padStart(2, '0')}`;
            const e = byDate[ds];
            let cls = 'none', tip = 'No sign-in';
            if (e) { cls = e.met_target ? 'met' : 'part'; tip = `${e.hours}h · ${e.sessions} session(s)`; }
            cells += `<div class="cal-cell ${cls}" title="${tip}">
                        <span class="cal-num">${day}</span>
                        ${e ? `<span class="cal-hrs">${e.hours}h</span>` : ''}
                      </div>`;
        }
        document.getElementById('calBody').innerHTML = `<div class="cal-grid">${cells}</div>`;
        document.getElementById('calMonthLabel').textContent = `${CAL_MONTHS[m - 1]} ${y}`;
        const n = data.days_logged;
        document.getElementById('calDaysCount').textContent =
            `${n} day${n !== 1 ? 's' : ''} · ${data.total_hours}h`;
    }

    // ── Sign-in analysis: date range + users + title → download / share ───
    let anTitleTouched = false;   // has the admin typed their own title?

    function anSelectedUsers() {
        return Array.from(document.querySelectorAll('.an-user:checked')).map(c => c.value);
    }

    function anUsersAll(checked) {
        document.querySelectorAll('.an-user').forEach(c => { c.checked = checked; });
        anUsersChanged();
    }

    function anUsersChanged() {
        const sel = anSelectedUsers();
        const label = document.getElementById('anUsersCount');
        if (label) label.textContent = sel.length ? `${sel.length} selected` : 'All users';
        // Auto-fill the title from the selection until the admin edits it themselves.
        if (!anTitleTouched) {
            const t = document.getElementById('anTitle');
            if (t) {
                if (!sel.length)        t.value = 'users-all';
                else if (sel.length <= 3) t.value = 'users-' + sel.join('-');
                else                    t.value = `users-${sel.length}`;
            }
        }
    }

    function anGetRange() {
        const from = document.getElementById('anFrom').value;
        const to   = document.getElementById('anTo').value;
        if (!from || !to) { showAlert('Pick both a From and a To date', 'danger'); return null; }
        return (from <= to) ? { from, to } : { from: to, to: from };  // tolerate reversed
    }

    function anTitle() {
        const t = document.getElementById('anTitle');
        return (t && t.value.trim()) || 'Sign-in analysis';
    }

    function downloadAnalysis() {
        const r = anGetRange();
        if (!r) return;
        const params = new URLSearchParams({ from: r.from, to: r.to, title: anTitle() });
        const users = anSelectedUsers();
        if (users.length) params.set('users', users.join(','));
        window.location.href = '/admin/analysis/excel?' + params.toString();
    }

    async function createShareLink() {
        const r = anGetRange();
        if (!r) return;
        const btn = document.getElementById('analysisShareBtn');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch spin"></i> Creating…';
        try {
            const res = await fetch('/api/admin/analysis/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: r.from, to: r.to,
                    users: anSelectedUsers(),
                    title: anTitle()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create link');
            document.getElementById('analysisShareUrl').value = data.url;
            document.getElementById('analysisShareOpen').href  = data.url;
            document.getElementById('analysisShareResult').style.display = 'block';
            showAlert('Share link ready — works without login', 'success');
        } catch (err) {
            showAlert(err.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    function copyShareLink() {
        const inp = document.getElementById('analysisShareUrl');
        inp.select();
        inp.setSelectionRange(0, 99999);
        const done = () => showAlert('Link copied', 'success');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(inp.value).then(done).catch(() => { document.execCommand('copy'); done(); });
        } else {
            document.execCommand('copy'); done();
        }
    }

    // ── Early Logouts ─────────────────────────────────────────────────────
    async function loadEarlyLogouts() {
        const listEl = document.getElementById('earlyLogoutsList');
        try {
            const res  = await fetch('/api/admin/early-logouts');
            const data = await res.json();
            const rows = data.early_logouts || [];

            document.querySelectorAll('[data-early-count]').forEach(e => { e.textContent = rows.length; });

            if (!rows.length) {
                listEl.innerHTML =
                    '<div class="oa-empty"><i class="fas fa-circle-check" style="color:var(--ok)"></i>' +
                    '<p>Everyone met their target today</p></div>';
                return;
            }

            listEl.innerHTML = rows.map(e => `
                <div class="oa-card" style="border-left:3px solid var(--warn);margin-bottom:10px">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
                    <strong style="font-size:.88rem">${e.username}</strong>
                    <span class="oa-tag">${e.shift_name}</span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
                    <div>
                      <div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Worked</div>
                      <div class="oa-num" style="font-weight:700;color:var(--bad)">${e.hours_worked}h</div>
                    </div>
                    <div>
                      <div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Target</div>
                      <div class="oa-num" style="font-weight:700">${e.target_hours}h</div>
                    </div>
                    <div>
                      <div style="font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Short by</div>
                      <div class="oa-num" style="font-weight:700;color:var(--warn)">${e.shortfall}h</div>
                    </div>
                  </div>
                  <div class="oa-num" style="margin-top:10px;font-size:.7rem;color:var(--t2)">
                    In ${e.login_time} \u2192 out ${e.logout_time}
                  </div>
                </div>`).join('');
        } catch (err) {
            listEl.innerHTML = '<div class="oa-empty"><i class="fas fa-triangle-exclamation"></i><p>Could not load the list. Try again.</p></div>';
        }
    }

    // Close modals on outside click
    ['userModal','fullFaceModal','calendarModal'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', e => {
            if (e.target === e.currentTarget) {
                if (id === 'userModal') closeUserModal();
                else if (id === 'calendarModal') closeCalendarModal();
                else closeFaceImageModal();
            }
        });
    });

    // Analysis: mark date fields as user-touched so loadLocations stops syncing them,
    // and flag the title as user-owned once the admin edits it (stops auto-fill).
    ['anFrom', 'anTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { el.dataset.touched = '1'; });
    });
    const anTitleEl = document.getElementById('anTitle');
    if (anTitleEl) anTitleEl.addEventListener('input', () => { anTitleTouched = true; });
    if (typeof anUsersChanged === 'function') anUsersChanged();

    // Init
    loadDashboardStats();
