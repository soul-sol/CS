// CountShot Members - 온라인/오프라인 상태 관리
console.log('Members page loaded!');

// Firebase 초기화 대기
let database, ref, set, onValue, update;
let members = {};

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
const offlineCountElement = document.getElementById('offlineCount');
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
        updateStatusCounts();
    }, (error) => {
        console.error('Firebase read error:', error);
        showMessage('데이터베이스 연결 오류: ' + error.message, 'error');
    });
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
    
    // 온라인 멤버를 먼저 정렬
    memberList.sort((a, b) => {
        const aOnline = a.status === 'online' ? 0 : 1;
        const bOnline = b.status === 'online' ? 0 : 1;
        return aOnline - bOnline;
    });
    
    container.innerHTML = memberList.map(member => {
        const isOnline = member.status === 'online';
        const statusIcon = isOnline ? '🟢' : '⚫';
        const statusClass = isOnline ? 'member-online' : 'member-offline';
        
        return `
            <div class="member-simple-card ${statusClass}" onclick="toggleMemberStatus('${member.id}')">
                <span class="status-dot">${statusIcon}</span>
                <span class="member-name">${member.name}</span>
                ${member.stats ? `
                    <span class="member-kd">K/D: ${member.stats.squad.kd}</span>
                ` : ''}
            </div>
        `;
    }).join('');
}

// 멤버 상태 토글
async function toggleMemberStatus(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    const newStatus = member.status === 'online' ? 'offline' : 'online';
    
    try {
        await update(ref(database, 'members/' + memberId), {
            status: newStatus,
            lastSeen: new Date().toISOString()
        });
        
        const statusText = newStatus === 'online' ? '온라인' : '오프라인';
        showMessage(`${member.name}님이 ${statusText}으로 변경되었습니다.`, 'success');
    } catch (error) {
        console.error('Error toggling member status:', error);
        showMessage('상태 변경 중 오류가 발생했습니다.', 'error');
    }
}

// 상태 카운트 업데이트
function updateStatusCounts() {
    let onlineCount = 0;
    let offlineCount = 0;
    
    Object.values(members).forEach(member => {
        if (member.status === 'online') {
            onlineCount++;
        } else {
            offlineCount++;
        }
    });
    
    onlineCountElement.textContent = onlineCount;
    offlineCountElement.textContent = offlineCount;
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
});

// 전역 함수로 등록
window.toggleMemberStatus = toggleMemberStatus;