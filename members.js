// CountShot Members - 온라인 상태 관리
console.log('Members page loaded!');

// Firebase 초기화 대기
let database, ref, set, onValue, update;
let members = {};
let currentUserId = null;

// Firebase가 로드될 때까지 대기
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (window.firebaseDB) {
                database = window.firebaseDB.database;
                ref = window.firebaseDB.ref;
                set = window.firebaseDB.set;
                onValue = window.firebaseDB.onValue;
                update = window.firebaseDB.update;
                console.log('Firebase functions loaded');
                resolve();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    });
}

// DOM 요소
const onlineCountElement = document.getElementById('onlineCount');
const awayCountElement = document.getElementById('awayCount');
const busyCountElement = document.getElementById('busyCount');
const offlineCountElement = document.getElementById('offlineCount');
const currentUserSelect = document.getElementById('currentUserSelect');
const messageElement = document.getElementById('message');

// Firebase 초기화 및 리스너 설정
async function initializeFirebase() {
    await waitForFirebase();
    console.log('Firebase initialized, setting up listener');
    
    // Firebase 실시간 리스너
    onValue(ref(database, 'members'), (snapshot) => {
        console.log('Firebase data received:', snapshot.val());
        members = snapshot.val() || {};
        updateMemberDisplay();
        updateUserSelect();
        updateStatusCounts();
    }, (error) => {
        console.error('Firebase read error:', error);
        showMessage('데이터베이스 연결 오류: ' + error.message, 'error');
    });
    
    // 로컬 스토리지에서 현재 사용자 복원
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId && members[savedUserId]) {
        currentUserId = savedUserId;
        currentUserSelect.value = currentUserId;
    }
}

// 멤버 표시 업데이트
function updateMemberDisplay() {
    const tierGroups = {
        tier1: [],
        tier2: [],
        tier3: [],
        tier4: [],
        unassigned: []
    };
    
    // 멤버를 티어별로 그룹화
    Object.values(members).forEach(member => {
        const tier = member.tier || 'unassigned';
        if (tierGroups[tier]) {
            tierGroups[tier].push(member);
        }
    });
    
    // 각 티어별로 멤버 표시
    displayTierMembers('tier1Members', tierGroups.tier1);
    displayTierMembers('tier2Members', tierGroups.tier2);
    displayTierMembers('tier3Members', tierGroups.tier3);
    displayTierMembers('tier4Members', tierGroups.tier4);
    displayTierMembers('unassignedMembers', tierGroups.unassigned);
}

// 티어별 멤버 표시
function displayTierMembers(elementId, memberList) {
    const container = document.getElementById(elementId);
    
    if (memberList.length === 0) {
        container.innerHTML = '<p class="no-members">멤버가 없습니다</p>';
        return;
    }
    
    container.innerHTML = memberList.map(member => {
        const status = member.status || 'offline';
        const statusIcon = getStatusIcon(status);
        const statusClass = getStatusClass(status);
        const lastSeen = member.lastSeen ? formatLastSeen(member.lastSeen) : '알 수 없음';
        const isCurrentUser = member.id === currentUserId;
        
        return `
            <div class="member-status-card ${statusClass} ${isCurrentUser ? 'current-user' : ''}">
                <div class="member-status-header">
                    <div class="member-info">
                        <span class="status-indicator">${statusIcon}</span>
                        <span class="member-name">${member.name}</span>
                        ${isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
                    </div>
                    <div class="member-actions">
                        ${isCurrentUser ? '' : `
                            <button class="status-change-btn" onclick="changeMemberStatus('${member.id}')">
                                상태변경
                            </button>
                        `}
                    </div>
                </div>
                <div class="member-status-info">
                    <div class="info-row">
                        <span class="info-label">상태:</span>
                        <span class="info-value">${getStatusText(status)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">마지막 접속:</span>
                        <span class="info-value">${lastSeen}</span>
                    </div>
                    ${member.statusMessage ? `
                        <div class="info-row">
                            <span class="info-label">메시지:</span>
                            <span class="info-value">${member.statusMessage}</span>
                        </div>
                    ` : ''}
                </div>
                ${member.stats ? `
                    <div class="member-quick-stats">
                        <span class="quick-stat">K/D: ${member.stats.squad.kd}</span>
                        <span class="quick-stat">DMG: ${member.stats.squad.avgDamage}</span>
                        <span class="quick-stat">승률: ${member.stats.squad.winRate}%</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// 상태 아이콘 가져오기
function getStatusIcon(status) {
    switch(status) {
        case 'online': return '🟢';
        case 'away': return '🟡';
        case 'busy': return '🔴';
        default: return '⚫';
    }
}

// 상태 클래스 가져오기
function getStatusClass(status) {
    switch(status) {
        case 'online': return 'status-online';
        case 'away': return 'status-away';
        case 'busy': return 'status-busy';
        default: return 'status-offline';
    }
}

// 상태 텍스트 가져오기
function getStatusText(status) {
    switch(status) {
        case 'online': return '온라인';
        case 'away': return '자리비움';
        case 'busy': return '게임중';
        default: return '오프라인';
    }
}

// 마지막 접속 시간 포맷
function formatLastSeen(timestamp) {
    if (!timestamp) return '알 수 없음';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return date.toLocaleDateString('ko-KR');
}

// 사용자 선택 업데이트
function updateUserSelect() {
    const currentValue = currentUserSelect.value;
    
    currentUserSelect.innerHTML = '<option value="">선택하세요</option>';
    
    Object.values(members).forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.name} (${member.tier || 'unassigned'})`;
        currentUserSelect.appendChild(option);
    });
    
    if (currentValue) {
        currentUserSelect.value = currentValue;
    }
}

// 상태 카운트 업데이트
function updateStatusCounts() {
    const counts = {
        online: 0,
        away: 0,
        busy: 0,
        offline: 0
    };
    
    Object.values(members).forEach(member => {
        const status = member.status || 'offline';
        if (counts.hasOwnProperty(status)) {
            counts[status]++;
        }
    });
    
    onlineCountElement.textContent = counts.online;
    awayCountElement.textContent = counts.away;
    busyCountElement.textContent = counts.busy;
    offlineCountElement.textContent = counts.offline;
}

// 내 상태 설정
async function setMyStatus(status) {
    if (!currentUserId) {
        showMessage('먼저 사용자를 선택해주세요.', 'error');
        return;
    }
    
    try {
        const updates = {
            status: status,
            lastSeen: new Date().toISOString()
        };
        
        // 상태 메시지 추가 (옵션)
        if (status === 'busy') {
            const message = prompt('게임중 메시지를 입력하세요 (선택사항):', '');
            if (message) {
                updates.statusMessage = message;
            }
        } else {
            updates.statusMessage = '';
        }
        
        await update(ref(database, 'members/' + currentUserId), updates);
        showMessage(`상태가 ${getStatusText(status)}(으)로 변경되었습니다.`, 'success');
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage('상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

// 다른 멤버 상태 변경 (관리자 기능)
async function changeMemberStatus(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    const statuses = ['online', 'away', 'busy', 'offline'];
    const currentStatus = member.status || 'offline';
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
        await update(ref(database, 'members/' + memberId), {
            status: nextStatus,
            lastSeen: new Date().toISOString()
        });
        showMessage(`${member.name}님의 상태가 ${getStatusText(nextStatus)}(으)로 변경되었습니다.`, 'success');
    } catch (error) {
        console.error('Error changing member status:', error);
        showMessage('상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

// 현재 사용자 변경
function onUserSelectChange() {
    currentUserId = currentUserSelect.value;
    if (currentUserId) {
        localStorage.setItem('currentUserId', currentUserId);
        showMessage(`현재 사용자: ${members[currentUserId].name}`, 'info');
    } else {
        localStorage.removeItem('currentUserId');
    }
    updateMemberDisplay();
}

// 메시지 표시
function showMessage(text, type = 'info') {
    messageElement.textContent = text;
    messageElement.className = `message ${type}`;
    messageElement.classList.remove('hidden');
    
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 3000);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Firebase...');
    
    // Firebase 초기화
    await initializeFirebase();
    
    // 이벤트 리스너 등록
    currentUserSelect.addEventListener('change', onUserSelectChange);
    
    // 자동 새로고침 (30초마다 lastSeen 업데이트)
    setInterval(() => {
        if (currentUserId && members[currentUserId]?.status === 'online') {
            update(ref(database, 'members/' + currentUserId), {
                lastSeen: new Date().toISOString()
            });
        }
    }, 30000);
});

// 전역 함수로 등록
window.setMyStatus = setMyStatus;
window.changeMemberStatus = changeMemberStatus;
