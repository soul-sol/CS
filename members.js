// CountShot Members - 멤버 관리 시스템
console.log('Members page loaded!');

// Firebase 초기화 대기
let database, ref, set, onValue, update, remove;
let members = {};

// PUBG API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJkMWM5MjdkMC04MmRiLTAxM2QtN2I0Mi0zM2I1ZTBkNzc0MWYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzM0MDUxNTM0LCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6ImN5bGltLTEifQ.oo5a9kA2jD2_1bnQRZBs_BSN7JhWL2Ui9kdksJcT9Bo';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

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
                remove = window.firebaseDB.remove;
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
const totalCountElement = document.getElementById('totalCount');
const messageElement = document.getElementById('message');
const addMemberMessageElement = document.getElementById('addMemberMessage');
const playerNameInput = document.getElementById('playerNameInput');
const addMemberBtn = document.getElementById('addMemberBtn');

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
    const onlineContainer = document.getElementById('onlineMembers');
    const offlineContainer = document.getElementById('offlineMembers');
    
    if (!onlineContainer || !offlineContainer) {
        console.error('Members containers not found');
        return;
    }
    
    const membersArray = Object.entries(members).map(([id, member]) => ({
        ...member,
        id: id
    }));
    
    // 온라인/오프라인 분리
    const onlineMembers = membersArray.filter(m => m.status === 'online').sort((a, b) => a.name.localeCompare(b.name));
    const offlineMembers = membersArray.filter(m => m.status !== 'online').sort((a, b) => a.name.localeCompare(b.name));
    
    // 온라인 멤버 표시
    onlineContainer.innerHTML = onlineMembers.map(member => `
        <div class="member-simple-card" onclick="toggleStatus('${member.id}')">
            <span class="status-dot online">🟢</span>
            <span class="member-name">${member.name}</span>
            <button class="member-delete-btn" onclick="event.stopPropagation(); deleteMember('${member.id}')" title="멤버 삭제">×</button>
        </div>
    `).join('') || '<div class="no-members">온라인 멤버가 없습니다</div>';
    
    // 오프라인 멤버 표시
    offlineContainer.innerHTML = offlineMembers.map(member => `
        <div class="member-simple-card" onclick="toggleStatus('${member.id}')">
            <span class="status-dot offline">⚫</span>
            <span class="member-name">${member.name}</span>
            <button class="member-delete-btn" onclick="event.stopPropagation(); deleteMember('${member.id}')" title="멤버 삭제">×</button>
        </div>
    `).join('') || '<div class="no-members">오프라인 멤버가 없습니다</div>';
}

// 상태 개수 업데이트
function updateStatusCounts() {
    const onlineMembers = Object.values(members).filter(m => m.status === 'online');
    const offlineMembers = Object.values(members).filter(m => m.status !== 'online');
    const totalMembers = Object.values(members).length;
    
    if (onlineCountElement) {
        onlineCountElement.textContent = onlineMembers.length;
    }
    if (offlineCountElement) {
        offlineCountElement.textContent = offlineMembers.length;
    }
    if (totalCountElement) {
        totalCountElement.textContent = totalMembers;
    }
}

// 상태 토글 함수
async function toggleStatus(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    const newStatus = member.status === 'online' ? 'offline' : 'online';
    
    try {
        await update(ref(database), {
            [`members/${memberId}/status`]: newStatus
        });
        console.log(`Status updated for ${member.name}: ${newStatus}`);
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage('상태 업데이트 중 오류가 발생했습니다.', 'error');
    }
}

// 멤버 추가 함수
async function addMember() {
    const playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        showAddMemberMessage('플레이어 이름을 입력해주세요.', 'error');
        return;
    }
    
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
        await set(ref(database, `members/${safeId}`), memberData);
        
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
            await remove(ref(database, `members/${memberId}`));
            showMessage(`${member.name}님이 삭제되었습니다.`, 'success');
        } catch (error) {
            console.error('Error deleting member:', error);
            showMessage('멤버 삭제 중 오류가 발생했습니다.', 'error');
        }
    }
}

// 메시지 표시 함수
function showMessage(text, type = 'info') {
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

// DOM이 로드된 후 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Firebase...');
    await initializeFirebase();
    
    // 이벤트 리스너 등록
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', addMember);
    }
    
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addMember();
            }
        });
    }
});