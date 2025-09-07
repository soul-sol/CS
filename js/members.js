// CountShot Members - 멤버 관리 시스템
console.log('Members page loaded!');

// Firebase 초기화 대기
let members = {};

// PUBG API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// DOM이 로드된 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Firebase...');
    
    // Firebase 데이터 리스너 설정
    setTimeout(() => {
        if (window.firebase && window.firebase.database) {
            const database = firebase.database();
            
            database.ref('members').on('value', (snapshot) => {
                console.log('Firebase data received:', snapshot.val());
                members = snapshot.val() || {};
                updateMemberDisplay();
                updateStatusCounts();
            });
            
            console.log('Firebase listener set up');
        } else {
            console.error('Firebase not available');
        }
    }, 1000);
    
    // 이벤트 리스너 등록
    const addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', addMember);
    }
    
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addMember();
            }
        });
    }
});

// 멤버 표시 업데이트
function updateMemberDisplay() {
    console.log('Updating member display with:', members);
    
    const onlineContainer = document.getElementById('onlineMembers');
    const offlineContainer = document.getElementById('offlineMembers');
    
    if (!onlineContainer || !offlineContainer) {
        console.error('Containers not found');
        return;
    }
    
    const membersArray = Object.entries(members).map(([id, member]) => ({
        ...member,
        id: id
    }));
    
    // 온라인/오프라인 분리
    const onlineMembers = membersArray.filter(m => !m.status || m.status === 'online').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const offlineMembers = membersArray.filter(m => m.status && m.status !== 'online').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    console.log(`Online: ${onlineMembers.length}, Offline: ${offlineMembers.length}`);
    
    // 온라인 멤버 표시
    if (onlineMembers.length > 0) {
        onlineContainer.innerHTML = onlineMembers.map(member => `
            <div class="member-simple-card" onclick="toggleStatus('${member.id}')">
                <span class="status-dot online">🟢</span>
                <span class="member-name">${member.name || 'Unknown'}</span>
                <button class="member-delete-btn" onclick="event.stopPropagation(); deleteMember('${member.id}')" title="멤버 삭제">×</button>
            </div>
        `).join('');
    } else {
        onlineContainer.innerHTML = '<div class="no-members">온라인 멤버가 없습니다</div>';
    }
    
    // 오프라인 멤버 표시
    if (offlineMembers.length > 0) {
        offlineContainer.innerHTML = offlineMembers.map(member => `
            <div class="member-simple-card" onclick="toggleStatus('${member.id}')">
                <span class="status-dot offline">⚫</span>
                <span class="member-name">${member.name || 'Unknown'}</span>
                <button class="member-delete-btn" onclick="event.stopPropagation(); deleteMember('${member.id}')" title="멤버 삭제">×</button>
            </div>
        `).join('');
    } else {
        offlineContainer.innerHTML = '<div class="no-members">오프라인 멤버가 없습니다</div>';
    }
}

// 상태 개수 업데이트
function updateStatusCounts() {
    const onlineMembers = Object.values(members).filter(m => !m.status || m.status === 'online');
    const offlineMembers = Object.values(members).filter(m => m.status && m.status !== 'online');
    
    const onlineCountElement = document.getElementById('onlineCount');
    const offlineCountElement = document.getElementById('offlineCount');
    
    if (onlineCountElement) {
        onlineCountElement.textContent = onlineMembers.length;
    }
    if (offlineCountElement) {
        offlineCountElement.textContent = offlineMembers.length;
    }
}

// 상태 토글 함수
async function toggleStatus(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    const newStatus = member.status === 'online' ? 'offline' : 'online';
    
    try {
        const database = firebase.database();
        const updates = {};
        updates[`members/${memberId}/status`] = newStatus;
        await database.ref().update(updates);
        console.log(`Status updated for ${member.name}: ${newStatus}`);
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage('상태 업데이트 중 오류가 발생했습니다.', 'error');
    }
}

// 멤버 추가 함수
async function addMember() {
    const playerNameInput = document.getElementById('playerNameInput');
    const playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        showAddMemberMessage('플레이어 이름을 입력해주세요.', 'error');
        return;
    }
    
    const addMemberBtn = document.getElementById('addMemberBtn');
    addMemberBtn.disabled = true;
    addMemberBtn.textContent = '추가 중...';
    
    try {
        // PUBG API에서 플레이어 검색
        const searchResponse = await fetch(`${API_BASE_URL}/players?filter[playerNames]=${playerName}`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/vnd.api+json'
            }
        });
        
        if (!searchResponse.ok) {
            throw new Error('플레이어를 찾을 수 없습니다.');
        }
        
        const searchData = await searchResponse.json();
        
        if (!searchData.data || searchData.data.length === 0) {
            throw new Error('플레이어를 찾을 수 없습니다.');
        }
        
        const player = searchData.data[0];
        const safeId = player.id.replace(/[.$#\[\]\/]/g, '_');
        
        // 이미 추가된 멤버인지 확인
        if (members[safeId]) {
            showAddMemberMessage('이미 추가된 멤버입니다.', 'error');
            return;
        }
        
        // 멤버 데이터 생성
        const memberData = {
            name: player.attributes.name,
            pubgId: player.id,
            status: 'online',
            tier: 'unassigned',
            stats: {
                kda: '0.0',
                avgDamage: 0,
                tier: null
            },
            createdAt: new Date().toISOString()
        };
        
        // Firebase에 저장
        const database = firebase.database();
        await database.ref(`members/${safeId}`).set(memberData);
        
        showAddMemberMessage(`${player.attributes.name}님이 추가되었습니다!`, 'success');
        playerNameInput.value = '';
        
    } catch (error) {
        console.error('Error adding member:', error);
        showAddMemberMessage(error.message || '멤버 추가 중 오류가 발생했습니다.', 'error');
    } finally {
        addMemberBtn.disabled = false;
        addMemberBtn.innerHTML = '<span class="btn-icon">+</span> 멤버 추가';
    }
}

// 멤버 삭제 함수
async function deleteMember(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    if (confirm(`${member.name}님을 삭제하시겠습니까?`)) {
        try {
            const database = firebase.database();
            await database.ref(`members/${memberId}`).remove();
            showMessage(`${member.name}님이 삭제되었습니다.`, 'success');
        } catch (error) {
            console.error('Error deleting member:', error);
            showMessage('멤버 삭제 중 오류가 발생했습니다.', 'error');
        }
    }
}

// 메시지 표시 함수
function showMessage(text, type = 'info') {
    const messageElement = document.getElementById('message');
    if (!messageElement) return;
    
    messageElement.textContent = text;
    messageElement.className = `message ${type}`;
    messageElement.classList.remove('hidden');
    
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 3000);
}

// 추가 메시지 표시
function showAddMemberMessage(text, type = 'info') {
    const addMemberMessageElement = document.getElementById('addMemberMessage');
    if (!addMemberMessageElement) return;
    
    addMemberMessageElement.textContent = text;
    addMemberMessageElement.className = `message ${type}`;
    addMemberMessageElement.classList.remove('hidden');
    
    setTimeout(() => {
        addMemberMessageElement.classList.add('hidden');
    }, 3000);
}

// 전역 함수로 등록
window.toggleStatus = toggleStatus;
window.addMember = addMember;
window.deleteMember = deleteMember;