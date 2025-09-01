// CS 클랜 홈페이지 - 티어 시스템
console.log('CS Clan Tier System loaded!');

// Firebase 초기화 대기
let database, ref, set, onValue, remove, update;

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

// API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// DOM 요소
const playerSearchInput = document.getElementById('playerSearchInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const totalMembersElement = document.getElementById('totalMembers');

// 티어별 요소
const tier1Element = document.getElementById('tier1');
const tier2Element = document.getElementById('tier2');
const tier3Element = document.getElementById('tier3');
const unassignedElement = document.getElementById('unassigned');

const tier1CountElement = document.getElementById('tier1Count');
const tier2CountElement = document.getElementById('tier2Count');
const tier3CountElement = document.getElementById('tier3Count');
const unassignedCountElement = document.getElementById('unassignedCount');

// 멤버 데이터
let members = {};

// Firebase 초기화 및 리스너 설정
async function initializeFirebase() {
    await waitForFirebase();
    console.log('Firebase initialized, setting up listener');
    
    // Firebase 실시간 리스너
    onValue(ref(database, 'members'), (snapshot) => {
        console.log('Firebase data received:', snapshot.val());
        members = snapshot.val() || {};
        updateTierDisplay();
    }, (error) => {
        console.error('Firebase read error:', error);
        showError('데이터베이스 연결 오류: ' + error.message);
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
        
        // 이미 추가된 멤버인지 확인 (safe ID로 체크)
        const checkId = player.id.replace(/[.$#\[\]\/]/g, '_');
        if (members[checkId]) {
            showError('이미 추가된 멤버입니다.');
            hideLoading();
            return;
        }
        
        // 멤버 데이터 생성 (ID에서 특수문자 제거)
        const safeId = player.id.replace(/[.$#\[\]\/]/g, '_');
        const memberData = {
            id: safeId,
            originalId: player.id,
            name: player.attributes.name,
            shardId: player.attributes.shardId,
            tier: 'unassigned', // 기본값: 무소속
            addedAt: new Date().toISOString()
        };
        
        // 시즌 통계 가져오기
        try {
            const stats = await fetchPlayerStats(player.id);
            memberData.stats = stats;
        } catch (statsError) {
            console.error('Stats fetch error:', statsError);
            memberData.stats = null;
        }
        
        console.log('Adding member to Firebase:', memberData);
        
        // Firebase에 저장
        await set(ref(database, 'members/' + safeId), memberData);
        console.log('Member added successfully');
        
        // 입력창 초기화
        playerSearchInput.value = '';
        
        showSuccess(`${player.attributes.name}님이 추가되었습니다!`);
        
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
        kd: modeStats.roundsPlayed > 0 ? 
            ((modeStats.kills || 0) / modeStats.roundsPlayed).toFixed(2) : '0.00',
        winRate: modeStats.roundsPlayed > 0 ? 
            ((modeStats.wins || 0) / modeStats.roundsPlayed * 100).toFixed(1) : '0.0'
    };
}

// 티어별 멤버 표시 업데이트
function updateTierDisplay() {
    const tierGroups = {
        tier1: [],
        tier2: [],
        tier3: [],
        unassigned: []
    };
    
    // 멤버를 티어별로 그룹화
    Object.values(members).forEach(member => {
        const tier = member.tier || 'unassigned';
        if (tierGroups[tier]) {
            tierGroups[tier].push(member);
        }
    });
    
    // 각 티어 업데이트
    updateTierContent(tier1Element, tierGroups.tier1, 'tier1');
    updateTierContent(tier2Element, tierGroups.tier2, 'tier2');
    updateTierContent(tier3Element, tierGroups.tier3, 'tier3');
    updateTierContent(unassignedElement, tierGroups.unassigned, 'unassigned');
    
    // 카운트 업데이트
    tier1CountElement.textContent = tierGroups.tier1.length;
    tier2CountElement.textContent = tierGroups.tier2.length;
    tier3CountElement.textContent = tierGroups.tier3.length;
    unassignedCountElement.textContent = tierGroups.unassigned.length;
    
    // 총 멤버 수 업데이트
    const totalMembers = Object.keys(members).length;
    totalMembersElement.textContent = totalMembers;
}

// 티어 콘텐츠 업데이트
function updateTierContent(element, memberList, tier) {
    if (memberList.length === 0) {
        element.innerHTML = `
            <div class="tier-drop-zone">
                <p class="drop-hint">멤버를 여기로 드래그하세요</p>
            </div>
        `;
        return;
    }
    
    const tierClass = getTierClass(tier);
    element.innerHTML = memberList.map(member => `
        <div class="member-card ${tierClass}" draggable="true" data-member-id="${member.id}">
            <div class="member-card-header">
                <h3 class="member-name">${member.name}</h3>
                <button class="member-remove" onclick="removeMember('${member.id}')">×</button>
            </div>
            <div class="member-card-stats">
                ${member.stats ? `
                    <div class="stat-row">
                        <span class="stat-label">K/D:</span>
                        <span class="stat-value">${member.stats.squad.kd}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">승률:</span>
                        <span class="stat-value">${member.stats.squad.winRate}%</span>
                    </div>
                ` : '<p class="no-stats">통계 없음</p>'}
            </div>
            <button class="member-details-btn" onclick="showMemberDetails('${member.id}')">상세보기</button>
        </div>
    `).join('');
    
    // 드래그 이벤트 리스너 추가
    setupDragAndDrop();
}

// 티어별 클래스 가져오기
function getTierClass(tier) {
    switch(tier) {
        case 'tier1': return 'card-gold';
        case 'tier2': return 'card-red';
        case 'tier3': return 'card-green';
        default: return 'card-gray';
    }
}

// 드래그 앤 드롭 설정
function setupDragAndDrop() {
    // 모든 멤버 카드에 드래그 이벤트 추가
    document.querySelectorAll('.member-card').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    // 모든 티어 컨테이너에 드롭 이벤트 추가
    document.querySelectorAll('.tier-content').forEach(container => {
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('dragenter', handleDragEnter);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    
    // 모든 드롭 존에서 하이라이트 제거
    document.querySelectorAll('.tier-content').forEach(container => {
        container.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.currentTarget === e.target) {
        e.currentTarget.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();
    
    const container = e.currentTarget;
    container.classList.remove('drag-over');
    
    if (draggedElement) {
        const memberId = draggedElement.dataset.memberId;
        const newTier = container.id;
        
        // Firebase 업데이트
        try {
            await update(ref(database, 'members/' + memberId), {
                tier: newTier
            });
            console.log(`Member ${memberId} moved to ${newTier}`);
        } catch (error) {
            console.error('Error updating member tier:', error);
            showError('티어 변경 중 오류가 발생했습니다.');
        }
    }
    
    return false;
}

// 멤버 상세 정보 표시
function showMemberDetails(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    const modal = document.getElementById('memberModal');
    const modalContent = document.getElementById('modalMemberInfo');
    
    modalContent.innerHTML = `
        <h2>${member.name}</h2>
        <div class="member-detail-stats">
            ${member.stats ? `
                <h3>Solo 통계</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="label">승리:</span>
                        <span class="value">${member.stats.solo.wins}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">K/D:</span>
                        <span class="value">${member.stats.solo.kd}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">승률:</span>
                        <span class="value">${member.stats.solo.winRate}%</span>
                    </div>
                </div>
                
                <h3>Duo 통계</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="label">승리:</span>
                        <span class="value">${member.stats.duo.wins}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">K/D:</span>
                        <span class="value">${member.stats.duo.kd}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">승률:</span>
                        <span class="value">${member.stats.duo.winRate}%</span>
                    </div>
                </div>
                
                <h3>Squad 통계</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="label">승리:</span>
                        <span class="value">${member.stats.squad.wins}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">K/D:</span>
                        <span class="value">${member.stats.squad.kd}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">승률:</span>
                        <span class="value">${member.stats.squad.winRate}%</span>
                    </div>
                </div>
            ` : '<p>통계 정보가 없습니다</p>'}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// 모달 닫기
function closeMemberModal() {
    document.getElementById('memberModal').classList.add('hidden');
}

// 멤버 제거
async function removeMember(memberId) {
    if (confirm('이 멤버를 삭제하시겠습니까?')) {
        try {
            await remove(ref(database, 'members/' + memberId));
            console.log(`Member ${memberId} removed`);
        } catch (error) {
            console.error('Error removing member:', error);
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
    errorMessage.classList.add('error');
    setTimeout(() => hideError(), 3000);
}

// 성공 메시지 표시
function showSuccess(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    errorMessage.classList.add('success');
    setTimeout(() => hideError(), 3000);
}

function hideError() {
    errorMessage.classList.add('hidden');
    errorMessage.classList.remove('error', 'success');
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Firebase...');
    
    // Firebase 초기화
    await initializeFirebase();
    
    // 이벤트 리스너 등록
    addMemberBtn.addEventListener('click', addMember);
    
    // Enter 키로 멤버 추가
    playerSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addMember();
        }
    });
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('memberModal').addEventListener('click', (e) => {
        if (e.target.id === 'memberModal') {
            closeMemberModal();
        }
    });
});

// 전역 함수로 등록
window.showMemberDetails = showMemberDetails;
window.removeMember = removeMember;
window.closeMemberModal = closeMemberModal;
