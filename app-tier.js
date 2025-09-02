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
const tier4Element = document.getElementById('tier4');
const unassignedElement = document.getElementById('unassigned');

const tier1CountElement = document.getElementById('tier1Count');
const tier2CountElement = document.getElementById('tier2Count');
const tier3CountElement = document.getElementById('tier3Count');
const tier4CountElement = document.getElementById('tier4Count');
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
        // 시즌 통계 가져오기
        let playerStats = null;
        try {
            console.log('Fetching stats for player ID:', player.id);
            playerStats = await fetchPlayerStats(player.id);
            console.log('Player stats fetched successfully:', playerStats);
        } catch (statsError) {
            console.error('Stats fetch error:', statsError);
            playerStats = null;
        }
        
        const memberData = {
            id: safeId,
            originalId: player.id,
            name: player.attributes.name,
            shardId: player.attributes.shardId,
            tier: 'unassigned', // 기본값: 무소속
            addedAt: new Date().toISOString(),
            stats: playerStats,
            lastStatsUpdate: new Date().toISOString()
        };
        
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
        // 현재 랭크 시즌 ID (시즌 29 - 2024)
        const currentSeasonId = 'division.bro.official.pc-2018-29';
        
        // 경쟁전(Ranked) 통계 먼저 시도
        const rankedStatsResponse = await fetch(
            `${API_BASE_URL}/players/${playerId}/seasons/${currentSeasonId}/ranked`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (rankedStatsResponse.ok) {
            const rankedData = await rankedStatsResponse.json();
            console.log('Ranked stats response:', rankedData);
            
            if (rankedData.data && rankedData.data.attributes && rankedData.data.attributes.rankedGameModeStats) {
                const rankedStats = rankedData.data.attributes.rankedGameModeStats;
                console.log('Ranked game mode stats:', rankedStats);
                
                // 스쿼드 랭크 우선, 없으면 다른 모드
                const squadRanked = rankedStats['squad-fpp'] || rankedStats['squad'] || {};
                console.log('Squad ranked stats:', squadRanked);
                
                if (squadRanked.roundsPlayed > 0) {
                    const stats = extractDetailedStats(squadRanked, true);
                    console.log('Extracted ranked stats:', stats);
                    return stats;
                }
            }
        } else {
            console.log('Ranked stats not available, status:', rankedStatsResponse.status);
        }
        
        // 랭크 통계가 없으면 일반 시즌 통계 가져오기
        const seasonStatsResponse = await fetch(
            `${API_BASE_URL}/players/${playerId}/seasons/${currentSeasonId}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (!seasonStatsResponse.ok) {
            console.log('Season stats not available, trying lifetime stats...');
            // 시즌 통계가 없으면 lifetime 통계 시도
            const lifetimeResponse = await fetch(
                `${API_BASE_URL}/players/${playerId}/seasons/lifetime`,
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Accept': 'application/vnd.api+json'
                    }
                }
            );
            
            if (!lifetimeResponse.ok) {
                return null;
            }
            
            const lifetimeData = await lifetimeResponse.json();
            const stats = lifetimeData.data.attributes.gameModeStats;
            
            // 스쿼드 FPP 우선, 없으면 스쿼드 TPP
            const squadStats = stats['squad-fpp'] || stats['squad'] || {};
            const duoStats = stats['duo-fpp'] || stats['duo'] || {};
            const soloStats = stats['solo-fpp'] || stats['solo'] || {};
            
            // 가장 많이 플레이한 모드의 통계 사용
            const mainStats = squadStats.roundsPlayed > 0 ? squadStats : 
                             duoStats.roundsPlayed > 0 ? duoStats : 
                             soloStats;
            
            return extractDetailedStats(mainStats);
        }
        
        const seasonData = await seasonStatsResponse.json();
        console.log('Season stats response:', seasonData);
        const stats = seasonData.data.attributes.gameModeStats;
        console.log('Game mode stats:', stats);
        
        // 스쿼드 FPP 우선, 없으면 스쿼드 TPP
        const squadStats = stats['squad-fpp'] || stats['squad'] || {};
        const duoStats = stats['duo-fpp'] || stats['duo'] || {};
        const soloStats = stats['solo-fpp'] || stats['solo'] || {};
        
        // 가장 많이 플레이한 모드의 통계 사용
        const mainStats = squadStats.roundsPlayed > 0 ? squadStats : 
                         duoStats.roundsPlayed > 0 ? duoStats : 
                         soloStats;
        
        console.log('Selected main stats:', mainStats);
        const extractedStats = extractDetailedStats(mainStats);
        console.log('Extracted season stats:', extractedStats);
        return extractedStats;
        
    } catch (error) {
        console.error('Error fetching player stats:', error);
        return null;
    }
}

// 상세 통계 추출
function extractDetailedStats(modeStats, isRanked = false) {
    const rounds = modeStats.roundsPlayed || 0;
    const kills = modeStats.kills || 0;
    const deaths = modeStats.deaths || 0; // deaths 직접 사용
    const damage = modeStats.damageDealt || 0;
    const wins = modeStats.wins || 0;
    const assists = modeStats.assists || 0;
    const headshotKills = modeStats.headshotKills || 0;
    
    // 랭크 모드에서는 KDA 계산 (킬+어시스트/죽음)
    let kdRatio;
    if (isRanked && modeStats.kda !== undefined) {
        kdRatio = modeStats.kda.toFixed(2);
    } else {
        // 일반 K/D 계산
        kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    }
    
    // 평균 데미지 계산
    const avgDmg = rounds > 0 ? Math.round(damage / rounds) : 0;
    
    // 헤드샷 비율
    const headshotRate = kills > 0 ? ((headshotKills / kills) * 100).toFixed(1) : '0.0';
    
    // 랭크 정보 추가
    const rankInfo = isRanked ? {
        currentTier: modeStats.currentTier || {},
        currentRankPoint: modeStats.currentRankPoint || 0,
        bestTier: modeStats.bestTier || {}
    } : null;
    
    return {
        kd: kdRatio,
        avgDamage: avgDmg,
        wins: wins,
        kills: kills,
        deaths: deaths,
        assists: assists,
        damageDealt: Math.round(damage),
        roundsPlayed: rounds,
        winRate: rounds > 0 ? ((wins / rounds) * 100).toFixed(1) : '0.0',
        headshotRate: headshotRate,
        avgKills: rounds > 0 ? (kills / rounds).toFixed(1) : '0.0',
        isRanked: isRanked,
        rankInfo: rankInfo
    };
}

// 기존 extractStats 함수도 유지 (하위 호환성)
function extractStats(modeStats) {
    return extractDetailedStats(modeStats);
}

// 티어별 멤버 표시 업데이트
function updateTierDisplay() {
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
    
    // 각 티어 업데이트
    updateTierContent(tier1Element, tierGroups.tier1, 'tier1');
    updateTierContent(tier2Element, tierGroups.tier2, 'tier2');
    updateTierContent(tier3Element, tierGroups.tier3, 'tier3');
    updateTierContent(tier4Element, tierGroups.tier4, 'tier4');
    updateTierContent(unassignedElement, tierGroups.unassigned, 'unassigned');
    
    // 온라인 멤버 카운트 업데이트
    const onlineTier1 = tierGroups.tier1.filter(m => !m.status || m.status === 'online').length;
    const onlineTier2 = tierGroups.tier2.filter(m => !m.status || m.status === 'online').length;
    const onlineTier3 = tierGroups.tier3.filter(m => !m.status || m.status === 'online').length;
    const onlineTier4 = tierGroups.tier4.filter(m => !m.status || m.status === 'online').length;
    const onlineUnassigned = tierGroups.unassigned.filter(m => !m.status || m.status === 'online').length;
    
    tier1CountElement.textContent = onlineTier1;
    tier2CountElement.textContent = onlineTier2;
    tier3CountElement.textContent = onlineTier3;
    tier4CountElement.textContent = onlineTier4;
    unassignedCountElement.textContent = onlineUnassigned;
    
    // 온라인/전체 멤버 수 업데이트
    const onlineMembers = Object.values(members).filter(m => !m.status || m.status === 'online').length;
    const totalMembers = Object.keys(members).length;
    totalMembersElement.textContent = `${onlineMembers} / ${totalMembers}`;
}

// 티어 콘텐츠 업데이트 (온라인 멤버만 표시)
function updateTierContent(element, memberList, tier) {
    // 온라인 멤버만 필터링
    const onlineMembers = memberList.filter(member => !member.status || member.status === 'online');
    
    if (onlineMembers.length === 0) {
        element.innerHTML = `
            <div class="tier-drop-zone">
                <p class="drop-hint">온라인 멤버가 없습니다</p>
            </div>
        `;
        return;
    }
    
    const tierClass = getTierClass(tier);
    element.innerHTML = onlineMembers.map(member => `
        <div class="member-card ${tierClass}" draggable="true" data-member-id="${member.id}">
            <div class="member-card-header">
                <h3 class="member-name">${member.name}</h3>
                <button class="member-remove" onclick="removeMember('${member.id}')">×</button>
            </div>
            <div class="member-card-stats">
                ${member.stats ? `
                    <div class="stats-grid-compact">
                        <div class="stat-item-compact">
                            <span class="stat-label">${member.stats.isRanked ? '🏆 K/D' : 'K/D'}</span>
                            <span class="stat-value">${member.stats.kd || '0.00'}</span>
                        </div>
                        <div class="stat-item-compact">
                            <span class="stat-label">DMG</span>
                            <span class="stat-value">${member.stats.avgDamage || 0}</span>
                        </div>
                    </div>
                ` : `
                    <div class="stats-grid-compact">
                        <div class="stat-item-compact">
                            <span class="stat-label">K/D</span>
                            <span class="stat-value">0.00</span>
                        </div>
                        <div class="stat-item-compact">
                            <span class="stat-label">DMG</span>
                            <span class="stat-value">0</span>
                        </div>
                    </div>
                `}
            </div>
            <button class="member-details-btn" onclick="showMemberDetails('${member.id}')">상세</button>
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
        case 'tier4': return 'card-blue';
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
async function showMemberDetails(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    // 통계 업데이트 확인
    const lastUpdate = member.lastStatsUpdate ? new Date(member.lastStatsUpdate) : null;
    const now = new Date();
    const hoursSinceUpdate = lastUpdate ? (now - lastUpdate) / (1000 * 60 * 60) : 999;
    
    // 24시간이 지났으면 통계 업데이트 제안
    if (hoursSinceUpdate > 24) {
        if (confirm(`${member.name}님의 통계를 업데이트하시겠습니까?\n마지막 업데이트: ${lastUpdate ? lastUpdate.toLocaleString() : '없음'}`)) {
            await updateMemberStats(memberId);
            return;
        }
    }
    
    const modal = document.getElementById('memberModal');
    const modalContent = document.getElementById('modalMemberInfo');
    
    modalContent.innerHTML = `
        <h2>${member.name}</h2>
        <div class="member-detail-stats">
            ${member.stats ? `
                <h3>시즌 통계</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="label">K/D:</span>
                        <span class="value">${member.stats.kd}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">평균 데미지:</span>
                        <span class="value">${member.stats.avgDamage}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">승리:</span>
                        <span class="value">${member.stats.wins}</span>
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
// 멤버 통계 업데이트
async function updateMemberStats(memberId) {
    const member = members[memberId];
    if (!member) return;
    
    showLoading();
    try {
        // 원본 ID로 통계 가져오기
        const playerId = member.originalId || memberId;
        const stats = await fetchPlayerStats(playerId);
        
        if (stats) {
            // Firebase 업데이트
            await update(ref(database, `members/${memberId}`), {
                stats: stats,
                lastStatsUpdate: new Date().toISOString()
            });
            
            showSuccess(`${member.name}님의 통계가 업데이트되었습니다!`);
            
            // 모달 다시 표시
            setTimeout(() => showMemberDetails(memberId), 1000);
        } else {
            showError('통계를 가져올 수 없습니다.');
        }
    } catch (error) {
        console.error('Error updating stats:', error);
        showError('통계 업데이트 중 오류가 발생했습니다.');
    } finally {
        hideLoading();
    }
}

window.showMemberDetails = showMemberDetails;
window.updateMemberStats = updateMemberStats;
window.removeMember = removeMember;
window.closeMemberModal = closeMemberModal;
