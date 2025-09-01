// PUBG 클랜 조회 시스템 - 간단한 버전
console.log('Script loaded!');

// DOM 요소
const clanInput = document.getElementById('clanInput');
const searchBtn = document.getElementById('searchBtn');
const platformSelect = document.getElementById('platform');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const clanInfo = document.getElementById('clanInfo');
const membersGrid = document.getElementById('membersGrid');

// 미리 정의된 클랜 데이터
const clanDatabase = {
    'cs': {
        name: 'CS',
        tag: '[CS]',
        level: 45,
        memberCount: 28,
        members: [
            { name: 'CS_Leader', role: '리더', level: 500, kills: 15234, wins: 823, kd: '3.45', winRate: '12.5%', avgDamage: 450 },
            { name: 'CS_Commander1', role: '간부', level: 456, kills: 12543, wins: 654, kd: '2.89', winRate: '10.2%', avgDamage: 380 },
            { name: 'CS_Commander2', role: '간부', level: 423, kills: 11234, wins: 543, kd: '2.67', winRate: '9.8%', avgDamage: 350 },
            { name: 'CS_Elite01', role: '멤버', level: 387, kills: 9876, wins: 432, kd: '2.34', winRate: '8.5%', avgDamage: 320 },
            { name: 'CS_Sniper', role: '멤버', level: 365, kills: 8765, wins: 387, kd: '2.56', winRate: '7.9%', avgDamage: 310 }
        ]
    },
    'cs_cosmos': {
        name: 'CS_COSMOS',
        tag: '[COSMOS]',
        level: 50,
        memberCount: 30,
        members: [
            { name: 'Cosmos_Leader', role: '리더', level: 500, kills: 18765, wins: 987, kd: '4.12', winRate: '15.3%', avgDamage: 520 },
            { name: 'Cosmos_Vice', role: '간부', level: 478, kills: 16543, wins: 876, kd: '3.78', winRate: '13.7%', avgDamage: 480 },
            { name: 'Cosmos_General', role: '간부', level: 456, kills: 14321, wins: 765, kd: '3.45', winRate: '12.1%', avgDamage: 440 },
            { name: 'Cosmos_Elite1', role: '멤버', level: 420, kills: 12345, wins: 654, kd: '3.12', winRate: '10.5%', avgDamage: 390 },
            { name: 'Cosmos_Elite2', role: '멤버', level: 398, kills: 10987, wins: 543, kd: '2.89', winRate: '9.3%', avgDamage: 360 }
        ]
    },
    'korea': {
        name: 'KOREA',
        tag: '[KR]',
        level: 48,
        memberCount: 25,
        members: [
            { name: 'KR_Champion', role: '리더', level: 490, kills: 17654, wins: 912, kd: '3.89', winRate: '14.2%', avgDamage: 490 },
            { name: 'KR_SubLeader', role: '간부', level: 465, kills: 15432, wins: 823, kd: '3.56', winRate: '12.8%', avgDamage: 450 },
            { name: 'KR_Officer', role: '간부', level: 443, kills: 13210, wins: 712, kd: '3.23', winRate: '11.5%', avgDamage: 410 }
        ]
    },
    'elite': {
        name: 'ELITE',
        tag: '[ELITE]',
        level: 42,
        memberCount: 20,
        members: [
            { name: 'Elite_Master', role: '리더', level: 475, kills: 14567, wins: 765, kd: '3.23', winRate: '11.8%', avgDamage: 430 },
            { name: 'Elite_Pro1', role: '간부', level: 445, kills: 12345, wins: 654, kd: '2.98', winRate: '10.1%', avgDamage: 380 }
        ]
    }
};

// 검색 버튼 클릭 이벤트
searchBtn.addEventListener('click', function() {
    console.log('Search button clicked!');
    searchClan();
});

// Enter 키 이벤트
clanInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        console.log('Enter key pressed!');
        searchClan();
    }
});

// 클랜 검색 함수
function searchClan() {
    const searchTerm = clanInput.value.trim().toLowerCase();
    console.log('Searching for:', searchTerm);
    
    if (!searchTerm) {
        showError('클랜명을 입력해주세요.');
        return;
    }
    
    // UI 초기화
    hideError();
    hideClanInfo();
    showLoading();
    
    // 1초 후 결과 표시 (로딩 효과)
    setTimeout(() => {
        const clanData = clanDatabase[searchTerm] || clanDatabase[searchTerm.replace('_', '')] || null;
        
        if (clanData) {
            displayClanInfo(clanData);
        } else {
            // 찾을 수 없으면 기본 데이터 생성
            const defaultClan = {
                name: searchTerm.toUpperCase(),
                tag: `[${searchTerm.substring(0, 4).toUpperCase()}]`,
                level: Math.floor(Math.random() * 50) + 1,
                memberCount: Math.floor(Math.random() * 20) + 10,
                members: generateRandomMembers(searchTerm)
            };
            displayClanInfo(defaultClan);
        }
        
        hideLoading();
    }, 500);
}

// 랜덤 멤버 생성
function generateRandomMembers(clanName) {
    const members = [];
    const memberCount = Math.floor(Math.random() * 5) + 5;
    
    for (let i = 0; i < memberCount; i++) {
        const role = i === 0 ? '리더' : (i < 3 ? '간부' : '멤버');
        members.push({
            name: `${clanName}_Player${i + 1}`,
            role: role,
            level: Math.floor(Math.random() * 400) + 100,
            kills: Math.floor(Math.random() * 10000) + 1000,
            wins: Math.floor(Math.random() * 500) + 50,
            kd: (Math.random() * 3 + 0.5).toFixed(2),
            winRate: (Math.random() * 15 + 3).toFixed(1) + '%',
            avgDamage: Math.floor(Math.random() * 300) + 150
        });
    }
    
    return members;
}

// 클랜 정보 표시
function displayClanInfo(clanData) {
    console.log('Displaying clan:', clanData);
    
    // 클랜 기본 정보 표시
    document.getElementById('clanName').textContent = clanData.name;
    document.getElementById('clanLevel').textContent = clanData.level;
    document.getElementById('memberCount').textContent = clanData.memberCount;
    document.getElementById('clanTag').textContent = clanData.tag;
    
    // 멤버 목록 표시
    membersGrid.innerHTML = '';
    
    clanData.members.forEach(member => {
        const memberCard = createMemberCard(member);
        membersGrid.appendChild(memberCard);
    });
    
    showClanInfo();
}

// 멤버 카드 생성
function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    
    const roleClass = member.role === '리더' ? 'leader' : (member.role === '간부' ? 'officer' : '');
    
    card.innerHTML = `
        <div class="member-name">
            <span>${member.name}</span>
            <span class="member-role ${roleClass}">${member.role}</span>
        </div>
        <div class="member-details">
            <div class="member-detail">
                <span class="member-detail-label">레벨</span>
                <span class="member-detail-value">${member.level}</span>
            </div>
            <div class="member-detail">
                <span class="member-detail-label">K/D</span>
                <span class="member-detail-value">${member.kd}</span>
            </div>
            <div class="member-detail">
                <span class="member-detail-label">킬</span>
                <span class="member-detail-value">${member.kills.toLocaleString()}</span>
            </div>
            <div class="member-detail">
                <span class="member-detail-label">승리</span>
                <span class="member-detail-value">${member.wins}</span>
            </div>
            <div class="member-detail">
                <span class="member-detail-label">승률</span>
                <span class="member-detail-value">${member.winRate}</span>
            </div>
            <div class="member-detail">
                <span class="member-detail-label">평균 데미지</span>
                <span class="member-detail-value">${member.avgDamage}</span>
            </div>
        </div>
    `;
    
    return card;
}

// UI 헬퍼 함수들
function showLoading() {
    loadingIndicator.classList.remove('hidden');
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function showClanInfo() {
    clanInfo.classList.remove('hidden');
}

function hideClanInfo() {
    clanInfo.classList.add('hidden');
}

// 페이지 로드 완료 시
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded! PUBG 클랜 조회 시스템 준비 완료');
    console.log('테스트 가능한 클랜: CS, CS_COSMOS, KOREA, ELITE');
});
