// CS 클랜 홈페이지 JavaScript - Firebase 버전
console.log('CS Clan Homepage with Firebase loaded!');

// Firebase는 index.html에서 이미 초기화됨
const database = window.firebaseDB.database;
const ref = window.firebaseDB.ref;
const set = window.firebaseDB.set;
const onValue = window.firebaseDB.onValue;
const remove = window.firebaseDB.remove;

// API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// DOM 요소
const playerSearchInput = document.getElementById('playerSearchInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const memberListContent = document.getElementById('memberListContent');
const clearAllBtn = document.getElementById('clearAllBtn');
const memberCountEl = document.getElementById('memberCount');
const welcomeScreen = document.getElementById('welcomeScreen');
const selectedMemberInfo = document.getElementById('selectedMemberInfo');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');

// 멤버 목록
let members = {};
let selectedMember = null;

// Firebase 실시간 리스너
onValue(ref(database, 'members'), (snapshot) => {
    members = snapshot.val() || {};
    updateMemberList();
});

// 멤버 추가
async function addMember() {
    const playerName = playerSearchInput.value.trim();
    
    if (!playerName) {
        showError('플레이어명을 입력해주세요.');
        return;
    }
    
    // 중복 체크
    const isDuplicate = Object.values(members).some(m => 
        m.name.toLowerCase() === playerName.toLowerCase()
    );
    
    if (isDuplicate) {
        showError('이미 추가된 플레이어입니다.');
        return;
    }
    
    hideError();
    showLoading();
    
    try {
        // PUBG API에서 플레이어 정보 가져오기
        const response = await fetch(
            `${API_BASE_URL}/players?filter[playerNames]=${encodeURIComponent(playerName)}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const player = data.data[0];
                const memberData = {
                    id: player.id,
                    name: player.attributes.name,
                    clanId: player.attributes.clanId,
                    matches: player.relationships.matches.data.length,
                    addedAt: new Date().toISOString(),
                    addedBy: navigator.userAgent.substring(0, 50) // 간단한 식별자
                };
                
                // 시즌 통계 가져오기
                const stats = await fetchPlayerStats(player.id);
                memberData.stats = stats;
                
                // Firebase에 저장
                set(ref(database, 'members/' + player.id), memberData);
                
                // 입력창 초기화
                playerSearchInput.value = '';
                
                // 추가된 멤버 자동 선택
                selectMember(memberData);
            } else {
                showError(`'${playerName}' 플레이어를 찾을 수 없습니다.`);
            }
        } else {
            showError('플레이어 정보를 가져올 수 없습니다.');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// 플레이어 통계 가져오기
async function fetchPlayerStats(playerId) {
    try {
        const seasonId = 'division.bro.official.pc-2018-29';
        const response = await fetch(
            `${API_BASE_URL}/players/${playerId}/seasons/${seasonId}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            const gameModeStats = data.data.attributes.gameModeStats;
            
            const modes = ['squad-fpp', 'squad', 'duo-fpp', 'duo', 'solo-fpp', 'solo'];
            for (const mode of modes) {
                if (gameModeStats[mode] && gameModeStats[mode].roundsPlayed > 0) {
                    const stats = gameModeStats[mode];
                    return {
                        kills: stats.kills || 0,
                        wins: stats.wins || 0,
                        kd: stats.kills && stats.losses ? 
                            (stats.kills / Math.max(1, stats.losses)).toFixed(2) : '0.00',
                        winRate: stats.roundsPlayed ? 
                            ((stats.wins / stats.roundsPlayed) * 100).toFixed(1) : '0.0',
                        avgDamage: Math.round(stats.damageDealt / Math.max(1, stats.roundsPlayed)) || 0,
                        top10s: stats.top10s || 0,
                        roundsPlayed: stats.roundsPlayed || 0,
                        assists: stats.assists || 0
                    };
                }
            }
        }
    } catch (error) {
        console.log('통계 가져오기 실패:', error);
    }
    
    return {
        kills: 0,
        wins: 0,
        kd: '0.00',
        winRate: '0.0',
        avgDamage: 0,
        top10s: 0,
        roundsPlayed: 0,
        assists: 0
    };
}

// 멤버 선택
function selectMember(member) {
    selectedMember = member;
    
    // 활성 상태 업데이트
    document.querySelectorAll('.member-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.memberId === member.id) {
            item.classList.add('active');
        }
    });
    
    // 화면 업데이트
    welcomeScreen.classList.add('hidden');
    selectedMemberInfo.classList.remove('hidden');
    
    // 멤버 정보 표시
    document.getElementById('selectedMemberName').textContent = member.name;
    
    // 통계 표시
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-card-label">K/D</div>
            <div class="stat-card-value">${member.stats?.kd || '0.00'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">킬</div>
            <div class="stat-card-value">${member.stats?.kills || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">승리</div>
            <div class="stat-card-value">${member.stats?.wins || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">승률</div>
            <div class="stat-card-value">${member.stats?.winRate || '0.0'}%</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">평균 데미지</div>
            <div class="stat-card-value">${member.stats?.avgDamage || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">Top 10</div>
            <div class="stat-card-value">${member.stats?.top10s || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">게임 수</div>
            <div class="stat-card-value">${member.stats?.roundsPlayed || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label">어시스트</div>
            <div class="stat-card-value">${member.stats?.assists || 0}</div>
        </div>
    `;
    
    document.getElementById('selectedMemberStats').innerHTML = statsHtml;
    
    // 최근 매치 정보
    const matchListHtml = `
        <div class="match-item">
            <span class="match-mode">최근 매치 수</span>
            <div class="match-result">
                <span>${member.matches || 0}개</span>
            </div>
        </div>
        <div class="match-item">
            <span class="match-mode">클랜 소속</span>
            <div class="match-result">
                <span>${member.clanId ? 'CountShot [CS]' : '클랜 없음'}</span>
            </div>
        </div>
    `;
    
    document.getElementById('matchList').innerHTML = matchListHtml;
}

// 멤버 제거
function removeMember(memberId) {
    if (confirm('이 멤버를 삭제하시겠습니까?')) {
        remove(ref(database, 'members/' + memberId));
        
        if (selectedMember && selectedMember.id === memberId) {
            selectedMember = null;
            selectedMemberInfo.classList.add('hidden');
            welcomeScreen.classList.remove('hidden');
        }
    }
}

// 전체 멤버 삭제
function clearAllMembers() {
    if (confirm('모든 멤버를 삭제하시겠습니까?')) {
        remove(ref(database, 'members'));
        selectedMember = null;
        selectedMemberInfo.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
    }
}

// 멤버 목록 업데이트
function updateMemberList() {
    memberListContent.innerHTML = '';
    
    Object.values(members).forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.dataset.memberId = member.id;
        
        memberItem.innerHTML = `
            <div class="member-item-info">
                <div class="member-item-name">${member.name}</div>
                <div class="member-item-stats">
                    K/D: ${member.stats?.kd || '0.00'} | 승률: ${member.stats?.winRate || '0.0'}%
                </div>
            </div>
            <button class="remove-member-btn" onclick="event.stopPropagation(); removeMember('${member.id}')">
                삭제
            </button>
        `;
        
        memberItem.addEventListener('click', () => selectMember(member));
        memberListContent.appendChild(memberItem);
    });
    
    // 멤버 수 업데이트
    memberCountEl.textContent = Object.keys(members).length;
}

// UI 헬퍼 함수
function showLoading() {
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => hideError(), 3000);
}

function hideError() {
    errorMessage.classList.add('hidden');
}

// 이벤트 리스너
addMemberBtn.addEventListener('click', addMember);
playerSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addMember();
});
clearAllBtn.addEventListener('click', clearAllMembers);

// 전역 함수로 등록
window.removeMember = removeMember;
