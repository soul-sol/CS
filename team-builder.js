// CountShot Team Builder
console.log('Team Builder loaded!');

// Firebase 초기화 대기
let database, ref, onValue;
let members = {};
let selectedMembers = new Set();

// Firebase가 로드될 때까지 대기
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkFirebase = () => {
            if (window.firebaseDB) {
                database = window.firebaseDB.database;
                ref = window.firebaseDB.ref;
                onValue = window.firebaseDB.onValue;
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
const selectedCountElement = document.getElementById('selectedCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const teamCountInput = document.getElementById('teamCount');
const requireTier1Checkbox = document.getElementById('requireTier1');
const balanceByStatsCheckbox = document.getElementById('balanceByStats');
const generateTeamsBtn = document.getElementById('generateTeamsBtn');
const teamsDisplay = document.getElementById('teamsDisplay');
const resultActions = document.getElementById('resultActions');
const reshuffleBtn = document.getElementById('reshuffleBtn');
const copyResultBtn = document.getElementById('copyResultBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const messageElement = document.getElementById('message');

// Firebase 초기화 및 리스너 설정
async function initializeFirebase() {
    await waitForFirebase();
    console.log('Firebase initialized, setting up listener');
    
    // Firebase 실시간 리스너
    onValue(ref(database, 'members'), (snapshot) => {
        console.log('Firebase data received:', snapshot.val());
        members = snapshot.val() || {};
        displayMembers();
    }, (error) => {
        console.error('Firebase read error:', error);
        showMessage('데이터베이스 연결 오류: ' + error.message, 'error');
    });
}

// 멤버 표시
function displayMembers() {
    const tierGroups = {
        tier1: [],
        tier2: [],
        tier3: [],
        tier4: [],
        unassigned: []
    };
    
    // 디버깅: 전체 멤버 수와 상태 확인
    console.log('Total members:', Object.keys(members).length);
    console.log('Members status:', Object.values(members).map(m => ({
        name: m.name,
        status: m.status,
        tier: m.tier
    })));
    
    // 온라인 멤버만 티어별로 그룹화
    Object.values(members).forEach(member => {
        // 오프라인 멤버는 제외
        if (member.status && member.status !== 'online') {
            console.log(`Filtered out offline member: ${member.name}, status: ${member.status}`);
            return;
        }
        
        const tier = member.tier || 'unassigned';
        if (tierGroups[tier]) {
            tierGroups[tier].push(member);
        }
    });
    
    console.log('Tier groups:', {
        tier1: tierGroups.tier1.length,
        tier2: tierGroups.tier2.length,
        tier3: tierGroups.tier3.length,
        tier4: tierGroups.tier4.length,
        unassigned: tierGroups.unassigned.length
    });
    
    // 각 티어별로 체크박스 생성
    displayTierMembers('tier1Members', tierGroups.tier1, 'tier1');
    displayTierMembers('tier2Members', tierGroups.tier2, 'tier2');
    displayTierMembers('tier3Members', tierGroups.tier3, 'tier3');
    displayTierMembers('tier4Members', tierGroups.tier4, 'tier4');
    displayTierMembers('unassignedMembers', tierGroups.unassigned, 'unassigned');
    
    updateSelectedCount();
}

// 티어별 멤버 체크박스 표시
function displayTierMembers(elementId, memberList, tier) {
    const container = document.getElementById(elementId);
    
    if (memberList.length === 0) {
        container.innerHTML = '<p class="no-members">멤버가 없습니다</p>';
        return;
    }
    
    container.innerHTML = memberList.map(member => {
        const isChecked = selectedMembers.has(member.id);
        // stats 구조 수정: stats.kd로 직접 접근
        const kdRatio = member.stats ? (member.stats.kd || member.stats.squad?.kd || '0.00') : '0.00';
        
        return `
            <label class="member-checkbox">
                <input type="checkbox" 
                       value="${member.id}" 
                       data-tier="${tier}"
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleMember('${member.id}')">
                <span class="member-info">
                    <span class="member-name">${member.name}</span>
                    <span class="member-kd">K/D: ${kdRatio}</span>
                </span>
            </label>
        `;
    }).join('');
}

// 멤버 선택/해제
function toggleMember(memberId) {
    if (selectedMembers.has(memberId)) {
        selectedMembers.delete(memberId);
    } else {
        selectedMembers.add(memberId);
    }
    updateSelectedCount();
}

// 선택된 멤버 수 업데이트
function updateSelectedCount() {
    selectedCountElement.textContent = selectedMembers.size;
}

// 전체 선택
function selectAll() {
    Object.values(members).forEach(member => {
        selectedMembers.add(member.id);
    });
    displayMembers();
}

// 전체 해제
function deselectAll() {
    selectedMembers.clear();
    displayMembers();
}

// 팀 생성
function generateTeams() {
    const selectedMembersList = Array.from(selectedMembers).map(id => members[id]).filter(m => m);
    const teamCount = parseInt(teamCountInput.value);
    const requireTier1 = requireTier1Checkbox.checked;
    const balanceByStats = balanceByStatsCheckbox.checked;
    
    // 유효성 검사
    if (selectedMembersList.length === 0) {
        showMessage('팀을 구성할 멤버를 선택해주세요.', 'error');
        return;
    }
    
    if (teamCount < 2 || teamCount > 10) {
        showMessage('팀 개수는 2~10개 사이여야 합니다.', 'error');
        return;
    }
    
    if (selectedMembersList.length < teamCount) {
        showMessage(`선택된 멤버(${selectedMembersList.length}명)가 팀 개수(${teamCount})보다 적습니다.`, 'error');
        return;
    }
    
    // 1티어 필수 옵션 체크
    const tier1Members = selectedMembersList.filter(m => m.tier === 'tier1');
    if (requireTier1 && tier1Members.length < teamCount) {
        showMessage(`1티어 멤버(${tier1Members.length}명)가 팀 개수(${teamCount})보다 적어 각 팀에 배치할 수 없습니다.`, 'error');
        return;
    }
    
    showLoading();
    
    // 팀 구성 로직
    setTimeout(() => {
        const teams = createTeams(selectedMembersList, teamCount, requireTier1, balanceByStats);
        displayTeams(teams);
        hideLoading();
        showMessage('팀이 성공적으로 생성되었습니다!', 'success');
    }, 500);
}

// 팀 생성 로직
function createTeams(membersList, teamCount, requireTier1, balanceByStats) {
    const teams = Array.from({ length: teamCount }, () => []);
    let availableMembers = [...membersList];
    
    // 1티어 먼저 배치
    if (requireTier1) {
        const tier1Members = availableMembers.filter(m => m.tier === 'tier1');
        const otherMembers = availableMembers.filter(m => m.tier !== 'tier1');
        
        // 1티어를 각 팀에 하나씩 배치
        tier1Members.forEach((member, index) => {
            if (index < teamCount) {
                teams[index].push(member);
            } else {
                // 남은 1티어는 랜덤 배치
                const randomTeam = Math.floor(Math.random() * teamCount);
                teams[randomTeam].push(member);
            }
        });
        
        availableMembers = otherMembers;
    }
    
    // 나머지 멤버 배치
    if (balanceByStats) {
        // K/D 기준으로 정렬
        availableMembers.sort((a, b) => {
            const kdA = a.stats ? parseFloat(a.stats.squad.kd) : 0;
            const kdB = b.stats ? parseFloat(b.stats.squad.kd) : 0;
            return kdB - kdA;
        });
        
        // 스네이크 드래프트 방식으로 배치 (공평한 분배)
        let teamIndex = 0;
        let direction = 1;
        
        availableMembers.forEach(member => {
            teams[teamIndex].push(member);
            
            teamIndex += direction;
            if (teamIndex >= teamCount || teamIndex < 0) {
                direction *= -1;
                teamIndex += direction;
            }
        });
    } else {
        // 랜덤 배치
        shuffleArray(availableMembers);
        
        availableMembers.forEach((member, index) => {
            teams[index % teamCount].push(member);
        });
    }
    
    return teams;
}

// 배열 섞기
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 팀 표시
function displayTeams(teams) {
    const teamsHtml = teams.map((team, index) => {
        const teamKD = calculateTeamKD(team);
        const tierComposition = getTeamTierComposition(team);
        
        return `
            <div class="team-card">
                <div class="team-header">
                    <h3>Team ${index + 1}</h3>
                    <span class="team-size">${team.length}명</span>
                </div>
                <div class="team-stats">
                    <span>평균 K/D: ${teamKD}</span>
                    <span>${tierComposition}</span>
                </div>
                <div class="team-members">
                    ${team.map(member => `
                        <div class="team-member ${getTierClass(member.tier)}">
                            <span class="member-name">${member.name}</span>
                            <span class="member-tier-badge">${getTierBadge(member.tier)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    teamsDisplay.innerHTML = `
        <h2>팀 구성 결과</h2>
        <div class="teams-grid">
            ${teamsHtml}
        </div>
    `;
    
    resultActions.classList.remove('hidden');
}

// 팀 평균 K/D 계산
function calculateTeamKD(team) {
    const totalKD = team.reduce((sum, member) => {
        const kd = member.stats ? parseFloat(member.stats.kd || member.stats.squad?.kd || 0) : 0;
        return sum + kd;
    }, 0);
    
    return (totalKD / team.length).toFixed(2);
}

// 팀 티어 구성 가져오기
function getTeamTierComposition(team) {
    const tierCounts = {
        tier1: 0,
        tier2: 0,
        tier3: 0,
        unassigned: 0
    };
    
    team.forEach(member => {
        const tier = member.tier || 'unassigned';
        tierCounts[tier]++;
    });
    
    const composition = [];
    if (tierCounts.tier1 > 0) composition.push(`1티어 ${tierCounts.tier1}`);
    if (tierCounts.tier2 > 0) composition.push(`2티어 ${tierCounts.tier2}`);
    if (tierCounts.tier3 > 0) composition.push(`3티어 ${tierCounts.tier3}`);
    if (tierCounts.unassigned > 0) composition.push(`무소속 ${tierCounts.unassigned}`);
    
    return composition.join(', ');
}

// 티어별 클래스 가져오기
function getTierClass(tier) {
    switch(tier) {
        case 'tier1': return 'member-gold';
        case 'tier2': return 'member-red';
        case 'tier3': return 'member-green';
        default: return 'member-gray';
    }
}

// 티어별 배지 가져오기
function getTierBadge(tier) {
    switch(tier) {
        case 'tier1': return '👑';
        case 'tier2': return '🔥';
        case 'tier3': return '🌟';
        default: return '📋';
    }
}

// 다시 섞기
function reshuffle() {
    generateTeams();
}

// 결과 복사
function copyResult() {
    const teams = document.querySelectorAll('.team-card');
    let resultText = '=== CountShot 팀 구성 결과 ===\n\n';
    
    teams.forEach((teamCard, index) => {
        resultText += `【Team ${index + 1}】\n`;
        const members = teamCard.querySelectorAll('.team-member');
        members.forEach(member => {
            const name = member.querySelector('.member-name').textContent;
            const badge = member.querySelector('.member-tier-badge').textContent;
            resultText += `  ${badge} ${name}\n`;
        });
        resultText += '\n';
    });
    
    navigator.clipboard.writeText(resultText).then(() => {
        showMessage('팀 구성 결과가 클립보드에 복사되었습니다!', 'success');
    }).catch(err => {
        showMessage('복사 실패: ' + err, 'error');
    });
}

// 로딩 표시
function showLoading() {
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
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
    selectAllBtn.addEventListener('click', selectAll);
    deselectAllBtn.addEventListener('click', deselectAll);
    generateTeamsBtn.addEventListener('click', generateTeams);
    reshuffleBtn.addEventListener('click', reshuffle);
    copyResultBtn.addEventListener('click', copyResult);
});

// 전역 함수로 등록
window.toggleMember = toggleMember;
