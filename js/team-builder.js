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
const requireTier2Checkbox = document.getElementById('requireTier2');
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
    
    // 디버깅: 온라인 멤버 수와 상태 확인
    const onlineMembers = Object.values(members).filter(m => !m.status || m.status === 'online');
    console.log('Total members:', Object.keys(members).length);
    console.log('Online members:', onlineMembers.length);
    console.log('Members status:', Object.values(members).map(m => ({
        name: m.name,
        status: m.status,
        tier: m.tier
    })));
    
    // 온라인 멤버만 티어별로 그룹화
    Object.entries(members).forEach(([memberId, member]) => {
        // member 객체에 id 추가
        member.id = memberId;
        
        // 온라인 상태인 멤버만 포함 (status가 없거나 'online'인 경우)
        if (!member.status || member.status === 'online') {
            const tier = member.tier || 'unassigned';
            if (tierGroups[tier]) {
                tierGroups[tier].push(member);
            } else {
                // tier가 정의되지 않은 경우 unassigned로
                tierGroups.unassigned.push(member);
            }
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
        // stats 구조: Firebase에서 kda 사용
        const kdRatio = member.stats ? (member.stats.kda || '0.0') : '0.0';
        
        return `
            <label class="member-checkbox">
                <input type="checkbox" 
                       value="${member.id}" 
                       data-tier="${tier}"
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleMember('${member.id}')">
                <span class="member-info">
                    <span class="member-name">${member.name}</span>
                    <span class="member-kd">KDA: ${kdRatio}</span>
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

// 전체 선택 (온라인 멤버만)
function selectAll() {
    Object.values(members).forEach(member => {
        // 온라인 멤버만 선택
        if (!member.status || member.status === 'online') {
            selectedMembers.add(member.id);
        }
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
    const requireTier2 = requireTier2Checkbox.checked;
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
    
    // 팀당 최대 4명 제한 검사
    const maxPerTeam = 4;
    const minTeamsNeeded = Math.ceil(selectedMembersList.length / maxPerTeam);
    if (teamCount < minTeamsNeeded) {
        showMessage(`선택된 멤버(${selectedMembersList.length}명)를 팀당 최대 ${maxPerTeam}명으로 나누려면 최소 ${minTeamsNeeded}개 팀이 필요합니다.`, 'error');
        return;
    }
    
    // 티어 필수 옵션 체크
    const tier1Members = selectedMembersList.filter(m => m.tier === 'tier1');
    const tier2Members = selectedMembersList.filter(m => m.tier === 'tier2');
    
    // 1티어와 2티어 모두 필수인 경우
    if (requireTier1 && requireTier2) {
        if (tier1Members.length === 0 && tier2Members.length === 0) {
            showMessage(`1티어와 2티어 멤버가 모두 없습니다. 각각 최소 1명 이상 필요합니다.`, 'error');
            return;
        } else if (tier1Members.length === 0) {
            showMessage(`1티어 멤버가 없습니다. 최소 1명 이상 필요합니다.`, 'error');
            return;
        } else if (tier2Members.length === 0) {
            showMessage(`2티어 멤버가 없습니다. 최소 1명 이상 필요합니다.`, 'error');
            return;
        }
        // 각 팀에 1티어와 2티어를 모두 배치하려면 충분한 멤버가 있는지 확인
        const tier1NeededCount = Math.min(teamCount, tier1Members.length);
        const tier2NeededCount = Math.min(teamCount, tier2Members.length);
        if (tier1NeededCount + tier2NeededCount > teamCount * 2) {
            // 이 조건은 실제로는 발생하지 않을 것임 (최소값을 사용하므로)
        }
    } else if (requireTier1 && tier1Members.length === 0) {
        showMessage(`1티어 멤버가 없습니다. 최소 1명 이상 필요합니다.`, 'error');
        return;
    } else if (requireTier2 && tier2Members.length === 0) {
        showMessage(`2티어 멤버가 없습니다. 최소 1명 이상 필요합니다.`, 'error');
        return;
    }
    
    showLoading();
    
    // 팀 구성 로직
    setTimeout(() => {
        const teams = createTeams(selectedMembersList, teamCount, requireTier1, requireTier2, balanceByStats);
        displayTeams(teams);
        hideLoading();
        showMessage('팀이 성공적으로 생성되었습니다!', 'success');
    }, 500);
}

// 팀 생성 로직
function createTeams(membersList, teamCount, requireTier1, requireTier2, balanceByStats) {
    const teams = Array.from({ length: teamCount }, () => []);
    let availableMembers = [...membersList];
    
    // 티어별 멤버 분류
    const tier1Members = availableMembers.filter(m => m.tier === 'tier1');
    const tier2Members = availableMembers.filter(m => m.tier === 'tier2');
    
    // 1티어와 2티어 모두 필수인 경우
    if (requireTier1 && requireTier2) {
        // 1티어와 2티어를 제외한 나머지 멤버
        availableMembers = availableMembers.filter(m => m.tier !== 'tier1' && m.tier !== 'tier2');
        
        // 멤버들을 랜덤하게 섞기
        shuffleArray(tier1Members);
        shuffleArray(tier2Members);
        
        // 팀 배치를 위한 랜덤 인덱스 생성
        const teamIndices = Array.from({ length: teamCount }, (_, i) => i);
        shuffleArray(teamIndices);
        
        // 각 팀에 1티어와 2티어를 하나씩 배치 (랜덤한 팀 순서로)
        for (let i = 0; i < teamCount; i++) {
            const teamIndex = teamIndices[i];
            // 1티어 배치
            if (i < tier1Members.length) {
                teams[teamIndex].push(tier1Members[i]);
            }
            // 2티어 배치
            if (i < tier2Members.length) {
                teams[teamIndex].push(tier2Members[i]);
            }
        }
        
        // 남은 1티어 배치
        for (let i = teamCount; i < tier1Members.length; i++) {
            let minTeamIndex = 0;
            let minTeamSize = teams[0].length;
            for (let j = 1; j < teamCount; j++) {
                if (teams[j].length < minTeamSize) {
                    minTeamSize = teams[j].length;
                    minTeamIndex = j;
                }
            }
            teams[minTeamIndex].push(tier1Members[i]);
        }
        
        // 남은 2티어 배치
        for (let i = teamCount; i < tier2Members.length; i++) {
            let minTeamIndex = 0;
            let minTeamSize = teams[0].length;
            for (let j = 1; j < teamCount; j++) {
                if (teams[j].length < minTeamSize) {
                    minTeamSize = teams[j].length;
                    minTeamIndex = j;
                }
            }
            teams[minTeamIndex].push(tier2Members[i]);
        }
        
    } else if (requireTier1) {
        // 1티어만 필수인 경우
        availableMembers = availableMembers.filter(m => m.tier !== 'tier1');
        shuffleArray(tier1Members);
        
        // 팀 배치를 위한 랜덤 인덱스 생성
        const teamIndices = Array.from({ length: teamCount }, (_, i) => i);
        shuffleArray(teamIndices);
        
        // 각 팀에 1티어 하나씩 배치 (랜덤한 팀 순서로)
        for (let i = 0; i < teamCount && i < tier1Members.length; i++) {
            teams[teamIndices[i]].push(tier1Members[i]);
        }
        
        // 남은 1티어 배치
        for (let i = teamCount; i < tier1Members.length; i++) {
            let minTeamIndex = 0;
            let minTeamSize = teams[0].length;
            for (let j = 1; j < teamCount; j++) {
                if (teams[j].length < minTeamSize) {
                    minTeamSize = teams[j].length;
                    minTeamIndex = j;
                }
            }
            teams[minTeamIndex].push(tier1Members[i]);
        }
        
    } else if (requireTier2) {
        // 2티어만 필수인 경우
        availableMembers = availableMembers.filter(m => m.tier !== 'tier2');
        shuffleArray(tier2Members);
        
        // 팀 배치를 위한 랜덤 인덱스 생성
        const teamIndices = Array.from({ length: teamCount }, (_, i) => i);
        shuffleArray(teamIndices);
        
        // 각 팀에 2티어 하나씩 배치 (랜덤한 팀 순서로)
        for (let i = 0; i < teamCount && i < tier2Members.length; i++) {
            teams[teamIndices[i]].push(tier2Members[i]);
        }
        
        // 남은 2티어 배치
        for (let i = teamCount; i < tier2Members.length; i++) {
            let minTeamIndex = 0;
            let minTeamSize = teams[0].length;
            for (let j = 1; j < teamCount; j++) {
                if (teams[j].length < minTeamSize) {
                    minTeamSize = teams[j].length;
                    minTeamIndex = j;
                }
            }
            teams[minTeamIndex].push(tier2Members[i]);
        }
    }
    
    // 나머지 멤버 배치
    if (balanceByStats) {
        // KDA 기준으로 정렬 (Firebase stats 구조 사용)
        availableMembers.sort((a, b) => {
            const kdA = a.stats ? parseFloat(a.stats.kda || 0) : 0;
            const kdB = b.stats ? parseFloat(b.stats.kda || 0) : 0;
            return kdB - kdA;
        });
        
        // 균등 배치: 가장 적은 팀에 우선 배치 (팀당 최대 4명)
        availableMembers.forEach(member => {
            // 현재 가장 인원이 적고 4명 미만인 팀 찾기
            let minTeamIndex = -1;
            let minTeamSize = 999;
            
            for (let i = 0; i < teamCount; i++) {
                if (teams[i].length < 4 && teams[i].length < minTeamSize) {
                    minTeamSize = teams[i].length;
                    minTeamIndex = i;
                }
            }
            
            // 모든 팀이 4명이면 가장 적은 팀에 배치 (예외 상황)
            if (minTeamIndex === -1) {
                minTeamIndex = 0;
                minTeamSize = teams[0].length;
                for (let i = 1; i < teamCount; i++) {
                    if (teams[i].length < minTeamSize) {
                        minTeamSize = teams[i].length;
                        minTeamIndex = i;
                    }
                }
            }
            
            teams[minTeamIndex].push(member);
        });
    } else {
        // 랜덤 배치 - 균등하게 분배
        shuffleArray(availableMembers);
        
        // 균등 배치: 가장 적은 팀에 우선 배치 (팀당 최대 4명)
        availableMembers.forEach(member => {
            // 현재 가장 인원이 적고 4명 미만인 팀 찾기
            let minTeamIndex = -1;
            let minTeamSize = 999;
            
            for (let i = 0; i < teamCount; i++) {
                if (teams[i].length < 4 && teams[i].length < minTeamSize) {
                    minTeamSize = teams[i].length;
                    minTeamIndex = i;
                }
            }
            
            // 모든 팀이 4명이면 가장 적은 팀에 배치 (예외 상황)
            if (minTeamIndex === -1) {
                minTeamIndex = 0;
                minTeamSize = teams[0].length;
                for (let i = 1; i < teamCount; i++) {
                    if (teams[i].length < minTeamSize) {
                        minTeamSize = teams[i].length;
                        minTeamIndex = i;
                    }
                }
            }
            
            teams[minTeamIndex].push(member);
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
                    <span>평균 KDA: ${teamKD}</span>
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
        <div class="teams-grid">
            ${teamsHtml}
        </div>
    `;
    
    resultActions.classList.remove('hidden');
}

// 팀 평균 KDA 계산
function calculateTeamKD(team) {
    const totalKD = team.reduce((sum, member) => {
        const kd = member.stats ? parseFloat(member.stats.kda || 0) : 0;
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
        tier4: 0,
        unassigned: 0
    };
    
    team.forEach(member => {
        const tier = member.tier || 'unassigned';
        if (tierCounts.hasOwnProperty(tier)) {
            tierCounts[tier]++;
        } else {
            tierCounts.unassigned++;
        }
    });
    
    const composition = [];
    if (tierCounts.tier1 > 0) composition.push(`1티어 ${tierCounts.tier1}`);
    if (tierCounts.tier2 > 0) composition.push(`2티어 ${tierCounts.tier2}`);
    if (tierCounts.tier3 > 0) composition.push(`3티어 ${tierCounts.tier3}`);
    if (tierCounts.tier4 > 0) composition.push(`4티어 ${tierCounts.tier4}`);
    if (tierCounts.unassigned > 0) composition.push(`무소속 ${tierCounts.unassigned}`);
    
    return composition.join(', ');
}

// 티어별 클래스 가져오기
function getTierClass(tier) {
    switch(tier) {
        case 'tier1': return 'member-gold';
        case 'tier2': return 'member-red';
        case 'tier3': return 'member-green';
        case 'tier4': return 'member-blue';
        default: return 'member-gray';
    }
}

// 티어별 배지 가져오기
function getTierBadge(tier) {
    switch(tier) {
        case 'tier1': return '👑';
        case 'tier2': return '🔥';
        case 'tier3': return '🌟';
        case 'tier4': return '⚔️';
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
    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }
}

function hideLoading() {
    if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
    }
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
    
    // 팀 개수 변경 함수
    function changeTeamCount(change) {
        const currentValue = parseInt(teamCountInput.value);
        const newValue = currentValue + change;
        
        if (newValue >= 2 && newValue <= 10) {
            teamCountInput.value = newValue;
        }
    }

    // 전역에서 접근 가능하도록 설정
    window.changeTeamCount = changeTeamCount;

    // 이벤트 리스너 등록
    selectAllBtn.addEventListener('click', selectAll);
    deselectAllBtn.addEventListener('click', deselectAll);
    generateTeamsBtn.addEventListener('click', generateTeams);
    reshuffleBtn.addEventListener('click', reshuffle);
    copyResultBtn.addEventListener('click', copyResult);
});

// 전역 함수로 등록
window.toggleMember = toggleMember;
