// CS 클랜 홈페이지 JavaScript - Firebase 버전
console.log('CS Clan Homepage with Firebase loaded!');

// Firebase 초기화 대기
let database, ref, set, onValue, remove;

// Firebase가 로드될 때까지 대기
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (window.firebaseDB) {
                database = window.firebaseDB.database;
                ref = window.firebaseDB.ref;
                set = window.firebaseDB.set;
                onValue = window.firebaseDB.onValue;
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

// API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// DOM 요소
const memberList = document.getElementById('memberListContent');
const addMemberBtn = document.getElementById('addMemberBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const playerSearchInput = document.getElementById('playerSearchInput');
const selectedMemberInfo = document.getElementById('selectedMemberInfo');
const welcomeScreen = document.getElementById('welcomeScreen');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const memberCountElement = document.getElementById('memberCount');

// 멤버 목록
let members = {};
let selectedMember = null;

// Firebase 초기화 및 리스너 설정
async function initializeFirebase() {
    await waitForFirebase();
    console.log('Firebase initialized, setting up listener');
    
    // Firebase 실시간 리스너 - 멤버 목록
    onValue(ref(database, 'members'), (snapshot) => {
        console.log('Firebase data received:', snapshot.val());
        members = snapshot.val() || {};
        updateMemberList();
    }, (error) => {
        console.error('Firebase read error:', error);
        showError('데이터베이스 연결 오류: ' + error.message);
    });
    
    // 마지막 업데이트 시간 리스너
    onValue(ref(database, 'lastUpdate'), (snapshot) => {
        const lastUpdate = snapshot.val();
        if (lastUpdate && lastUpdate.timestamp) {
            displayLastUpdateTime(lastUpdate);
        }
    });
}

// 멤버 추가
async function addMember() {
    const playerName = playerSearchInput.value.trim();
    
    if (!playerName) {
        showError('플레이어명을 입력해주세요.');
        return;
    }
    
    showLoading();
    
    try {
        // 플레이어 검색
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
        
        // 이미 추가된 멤버인지 확인
        if (members[player.id]) {
            showError('이미 추가된 멤버입니다.');
            hideLoading();
            return;
        }
        
        // 멤버 데이터 생성
        const memberData = {
            id: player.id,
            name: player.attributes.name,
            shardId: player.attributes.shardId,
            addedAt: new Date().toISOString()
        };
        
        // 시즌 통계 가져오기
        const stats = await fetchPlayerStats(player.id);
        memberData.stats = stats;
        
        console.log('Adding member to Firebase:', memberData);
        
        // Firebase에 저장
        await set(ref(database, 'members/' + player.id), memberData);
        console.log('Member added successfully');
        
        // 입력창 초기화
        playerSearchInput.value = '';
        
        // 추가된 멤버 자동 선택
        setTimeout(() => {
            selectMember(memberData);
        }, 500);
        
    } catch (error) {
        console.error('Error adding member:', error);
        showError(error.message || '멤버 추가 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

// 플레이어 통계 가져오기
async function fetchPlayerStats(playerId) {
    try {
        // 현재 시즌 통계
        const seasonStatsResponse = await fetch(
            `${API_BASE_URL}/players/${playerId}/seasons/lifetime`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (!seasonStatsResponse.ok) {
            return null;
        }
        
        const seasonData = await seasonStatsResponse.json();
        const stats = seasonData.data.attributes.gameModeStats;
        
        // 주요 통계 추출
        const soloStats = stats['solo-fpp'] || stats['solo'] || {};
        const duoStats = stats['duo-fpp'] || stats['duo'] || {};
        const squadStats = stats['squad-fpp'] || stats['squad'] || {};
        
        return {
            solo: extractStats(soloStats),
            duo: extractStats(duoStats),
            squad: extractStats(squadStats)
        };
        
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return null;
    }
}

// 통계 추출
function extractStats(modeStats) {
    return {
        wins: modeStats.wins || 0,
        kills: modeStats.kills || 0,
        assists: modeStats.assists || 0,
        damageDealt: Math.round(modeStats.damageDealt || 0),
        roundsPlayed: modeStats.roundsPlayed || 0,
        top10s: modeStats.top10s || 0,
        longestKill: Math.round(modeStats.longestKill || 0),
        headshotKills: modeStats.headshotKills || 0,
        kd: modeStats.roundsPlayed > 0 ? 
            ((modeStats.kills || 0) / modeStats.roundsPlayed).toFixed(2) : '0.00',
        winRate: modeStats.roundsPlayed > 0 ? 
            ((modeStats.wins || 0) / modeStats.roundsPlayed * 100).toFixed(1) : '0.0'
    };
}

// 멤버 목록 업데이트
function updateMemberList() {
    const memberArray = Object.values(members);
    memberCountElement.textContent = memberArray.length;
    
    if (memberArray.length === 0) {
        memberList.innerHTML = '<div class="no-members">멤버가 없습니다</div>';
        return;
    }
    
    memberList.innerHTML = memberArray.map(member => `
        <div class="member-item" onclick="selectMember('${member.id}')">
            <div class="member-name">${member.name}</div>
            <button class="member-remove" onclick="event.stopPropagation(); removeMember('${member.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `).join('');
}

// 멤버 선택
function selectMember(memberIdOrData) {
    const member = typeof memberIdOrData === 'string' 
        ? members[memberIdOrData] 
        : memberIdOrData;
    
    if (!member) return;
    
    selectedMember = member;
    welcomeScreen.classList.add('hidden');
    selectedMemberInfo.classList.remove('hidden');
    
    // 멤버 이름 표시
    document.getElementById('selectedMemberName').textContent = member.name;
    
    // 통계 표시
    displayMemberStats(member);
    
    // 최근 매치 가져오기
    fetchRecentMatches(member.id);
}

// 멤버 통계 표시
function displayMemberStats(member) {
    if (!member.stats) {
        document.getElementById('selectedMemberStats').innerHTML = 
            '<div class="no-stats">통계 정보가 없습니다</div>';
        return;
    }
    
    const statsHtml = `
        <div class="stats-section">
            <h3>Solo</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">승리</span>
                    <span class="stat-value">${member.stats.solo.wins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value">${member.stats.solo.kd}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">승률</span>
                    <span class="stat-value">${member.stats.solo.winRate}%</span>
                </div>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Duo</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">승리</span>
                    <span class="stat-value">${member.stats.duo.wins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value">${member.stats.duo.kd}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">승률</span>
                    <span class="stat-value">${member.stats.duo.winRate}%</span>
                </div>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Squad</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">승리</span>
                    <span class="stat-value">${member.stats.squad.wins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">K/D</span>
                    <span class="stat-value">${member.stats.squad.kd}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">승률</span>
                    <span class="stat-value">${member.stats.squad.winRate}%</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('selectedMemberStats').innerHTML = statsHtml;
}

// 최근 매치 가져오기
async function fetchRecentMatches(playerId) {
    const matchListHtml = `
        <div class="match-placeholder">
            <p>최근 매치 정보를 불러오는 중...</p>
        </div>
    `;
    
    document.getElementById('matchList').innerHTML = matchListHtml;
}

// 멤버 제거
async function removeMember(memberId) {
    if (confirm('이 멤버를 삭제하시겠습니까?')) {
        try {
            await remove(ref(database, 'members/' + memberId));
            
            if (selectedMember && selectedMember.id === memberId) {
                selectedMember = null;
                selectedMemberInfo.classList.add('hidden');
                welcomeScreen.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            showError('멤버 삭제 중 오류가 발생했습니다.');
        }
    }
}

// 전체 멤버 삭제
async function clearAllMembers() {
    if (confirm('모든 멤버를 삭제하시겠습니까?')) {
        try {
            await remove(ref(database, 'members'));
            selectedMember = null;
            selectedMemberInfo.classList.add('hidden');
            welcomeScreen.classList.remove('hidden');
        } catch (error) {
            console.error('Error clearing members:', error);
            showError('멤버 삭제 중 오류가 발생했습니다.');
        }
    }
}

// 로딩 표시
function showLoading() {
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

// 에러 표시
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => hideError(), 3000);
}

function hideError() {
    errorMessage.classList.add('hidden');
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Firebase...');
    
    // Firebase 초기화
    await initializeFirebase();
    
    // 이벤트 리스너 등록
    addMemberBtn.addEventListener('click', addMember);
    clearAllBtn.addEventListener('click', clearAllMembers);
    
    // Enter 키로 멤버 추가
    playerSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addMember();
        }
    });
});

// 마지막 업데이트 시간 표시
function displayLastUpdateTime(updateInfo) {
    const updateElement = document.getElementById('lastUpdateInfo');
    if (!updateElement) {
        // 업데이트 정보를 표시할 요소가 없으면 생성
        const header = document.querySelector('.header') || document.querySelector('h1');
        if (header) {
            const infoDiv = document.createElement('div');
            infoDiv.id = 'lastUpdateInfo';
            infoDiv.style.cssText = 'text-align: center; font-size: 12px; color: #888; margin: 10px 0;';
            header.parentElement.insertBefore(infoDiv, header.nextSibling);
        }
    }
    
    if (updateInfo && updateInfo.timestamp) {
        const updateTime = new Date(updateInfo.timestamp);
        const koreanTime = updateTime.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const infoText = `📊 마지막 스탯 업데이트: ${koreanTime} (성공: ${updateInfo.successCount || 0}명 / 전체: ${updateInfo.totalMembers || 0}명)`;
        
        const element = document.getElementById('lastUpdateInfo');
        if (element) {
            element.textContent = infoText;
        }
    }
}

// 수동 업데이트 버튼 추가 (관리자용)
function addManualUpdateButton() {
    const headerElement = document.querySelector('.header-actions') || document.querySelector('.controls');
    if (headerElement) {
        const updateBtn = document.createElement('button');
        updateBtn.id = 'manualUpdateBtn';
        updateBtn.className = 'btn btn-secondary';
        updateBtn.innerHTML = '🔄 스탯 업데이트';
        updateBtn.title = '모든 멤버의 PUBG 스탯을 즉시 업데이트합니다';
        updateBtn.onclick = async () => {
            if (confirm('모든 멤버의 스탯을 업데이트하시겠습니까? 시간이 걸릴 수 있습니다.')) {
                alert('업데이트 기능은 서버 스크립트를 통해 실행됩니다.\n터미널에서 "npm run update-stats"를 실행하세요.');
            }
        };
        headerElement.appendChild(updateBtn);
    }
}

// 전역 함수로 등록
window.selectMember = selectMember;
window.removeMember = removeMember;