// 통계 분석 시스템
console.log('Stats page loaded!');

let members = {};
let statsHistory = {};
let currentChart = null;
let clanChart = null;
let selectedMember = null;
let selectedPeriod = 30;
let selectedChartType = 'kd';

// DOM이 로드된 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing stats system...');
    
    // Firebase 데이터 리스너 설정
    setTimeout(() => {
        if (window.firebaseDB) {
            loadInitialData();
            setupEventListeners();
        } else {
            console.error('Firebase not available');
            showError('Firebase 연결 실패');
        }
    }, 1000);
});

// 초기 데이터 로드
async function loadInitialData() {
    showLoading(true);
    
    try {
        // 멤버 목록 로드
        const membersRef = window.firebaseDB.ref(window.firebaseDB.database, 'members');
        const membersSnapshot = await window.firebaseDB.get(membersRef);
        members = membersSnapshot.val() || {};
        
        console.log('Members loaded:', Object.keys(members).length);
        
        // 통계 히스토리 로드 (없어도 계속 진행)
        try {
            const historyRef = window.firebaseDB.ref(window.firebaseDB.database, 'stats/history');
            const historySnapshot = await window.firebaseDB.get(historyRef);
            statsHistory = historySnapshot.val() || {};
            console.log('Stats history loaded:', Object.keys(statsHistory).length);
        } catch (historyError) {
            console.log('No stats history yet (this is normal for first run)');
            statsHistory = {};
        }
        
        // 마지막 수집 정보 로드 (없어도 계속 진행)
        try {
            const metadataRef = window.firebaseDB.ref(window.firebaseDB.database, 'stats/metadata/lastCollection');
            const metadataSnapshot = await window.firebaseDB.get(metadataRef);
            const metadata = metadataSnapshot.val();
            
            if (metadata) {
                document.getElementById('lastUpdate').textContent = 
                    metadata.date ? formatDate(metadata.date) : '없음';
            } else {
                document.getElementById('lastUpdate').textContent = '아직 수집 전';
            }
        } catch (metaError) {
            console.log('No metadata yet');
            document.getElementById('lastUpdate').textContent = '아직 수집 전';
        }
        
        // UI 업데이트
        populateMemberSelect();
        updateClanRankings();
        
        // 데이터가 있을 때만 클랜 차트 그리기
        if (Object.keys(statsHistory).length > 0) {
            drawClanAverageChart();
        } else {
            console.log('No data for clan chart yet');
            // 안내 메시지 표시
            const chartContainer = document.querySelector('.clan-chart-container');
            if (chartContainer) {
                const canvas = document.getElementById('clanAverageChart');
                if (canvas) {
                    canvas.style.display = 'none';
                }
                const message = document.createElement('div');
                message.className = 'no-data-message';
                message.style.cssText = 'text-align: center; padding: 2rem; color: rgba(255,255,255,0.5);';
                message.innerHTML = '<p>📊 통계 데이터 수집 대기 중</p><p style="font-size: 0.9rem; margin-top: 1rem;">GitHub Actions가 처음 실행되면 데이터가 표시됩니다.</p>';
                chartContainer.appendChild(message);
            }
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('데이터 로드 실패: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// 멤버 선택 드롭다운 채우기
function populateMemberSelect() {
    const select = document.getElementById('memberSelect');
    select.innerHTML = '<option value="">멤버를 선택하세요</option>';
    
    // 멤버 정렬 (이름순)
    const sortedMembers = Object.entries(members)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));
    
    sortedMembers.forEach(([key, member]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = member.name;
        select.appendChild(option);
    });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 멤버 선택
    document.getElementById('memberSelect').addEventListener('change', (e) => {
        selectedMember = e.target.value;
        if (selectedMember) {
            updateMemberStats();
        } else {
            document.getElementById('currentStats').style.display = 'none';
            document.getElementById('chartContainer').style.display = 'none';
        }
    });
    
    // 기간 선택
    document.getElementById('periodSelect').addEventListener('change', (e) => {
        selectedPeriod = parseInt(e.target.value);
        if (selectedMember) {
            updateMemberStats();
        }
        drawClanAverageChart();
    });
    
    // 차트 타입 선택
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-type-btn').forEach(b => 
                b.classList.remove('active'));
            e.target.classList.add('active');
            selectedChartType = e.target.dataset.type;
            if (selectedMember) {
                drawMemberChart();
            }
        });
    });
}

// 멤버 통계 업데이트
function updateMemberStats() {
    const memberData = members[selectedMember];
    if (!memberData) return;
    
    // 현재 통계 표시
    const currentStats = memberData.currentStats;
    if (currentStats) {
        // K/D 값 정상화 (100 이상은 비정상)
        let kdValue = parseFloat(currentStats.kd) || 0;
        if (kdValue > 100) kdValue = 0;
        document.getElementById('currentKD').textContent = kdValue.toFixed(2);
        
        document.getElementById('currentDamage').textContent = currentStats.avgDamage || '0';
        document.getElementById('currentKills').textContent = currentStats.kills || '0';
        document.getElementById('currentWinRate').textContent = 
            currentStats.winRate ? currentStats.winRate + '%' : '0%';
        document.getElementById('currentGames').textContent = currentStats.roundsPlayed || '0';
        document.getElementById('currentTop10').textContent = currentStats.top10s || '0';
    }
    
    // 변화량 계산 (이전 데이터와 비교)
    calculateChanges();
    
    // UI 표시
    document.getElementById('currentStats').style.display = 'block';
    document.getElementById('chartContainer').style.display = 'block';
    
    // 차트 그리기
    drawMemberChart();
}

// 변화량 계산
function calculateChanges() {
    const memberHistory = statsHistory[selectedMember];
    if (!memberHistory) return;
    
    const dates = Object.keys(memberHistory).sort();
    if (dates.length < 2) return;
    
    const current = memberHistory[dates[dates.length - 1]];
    const previous = memberHistory[dates[dates.length - 2]];
    
    // K/D 변화
    const kdChange = (parseFloat(current.kd) - parseFloat(previous.kd)).toFixed(2);
    updateChangeIndicator('kdChange', kdChange);
    
    // 데미지 변화
    const damageChange = current.avgDamage - previous.avgDamage;
    updateChangeIndicator('damageChange', damageChange);
    
    // 킬 변화
    const killsChange = current.kills - previous.kills;
    updateChangeIndicator('killsChange', killsChange);
}

// 변화 표시기 업데이트
function updateChangeIndicator(elementId, change) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const numChange = parseFloat(change);
    if (numChange > 0) {
        element.textContent = `▲ ${Math.abs(numChange)}`;
        element.className = 'stat-change positive';
    } else if (numChange < 0) {
        element.textContent = `▼ ${Math.abs(numChange)}`;
        element.className = 'stat-change negative';
    } else {
        element.textContent = '─';
        element.className = 'stat-change neutral';
    }
}

// 멤버 차트 그리기
function drawMemberChart() {
    const memberHistory = statsHistory[selectedMember];
    if (!memberHistory) {
        showError('해당 멤버의 통계 기록이 없습니다.');
        return;
    }
    
    // 날짜 필터링
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - selectedPeriod);
    
    const filteredData = Object.entries(memberHistory)
        .filter(([date, _]) => new Date(date) >= cutoffDate)
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    if (filteredData.length === 0) {
        showError('선택한 기간의 데이터가 없습니다.');
        return;
    }
    
    // 차트 데이터 준비
    const labels = filteredData.map(([date, _]) => formatChartDate(date));
    let data = [];
    let label = '';
    let borderColor = '';
    let backgroundColor = '';
    
    switch (selectedChartType) {
        case 'kd':
            data = filteredData.map(([_, stats]) => {
                const kd = parseFloat(stats.kd) || 0;
                // 비정상 값 필터링
                return kd > 100 ? 0 : kd;
            });
            label = 'K/D Ratio';
            borderColor = 'rgb(255, 99, 132)';
            backgroundColor = 'rgba(255, 99, 132, 0.1)';
            break;
        case 'damage':
            data = filteredData.map(([_, stats]) => stats.avgDamage || 0);
            label = '평균 데미지';
            borderColor = 'rgb(54, 162, 235)';
            backgroundColor = 'rgba(54, 162, 235, 0.1)';
            break;
        case 'kills':
            data = filteredData.map(([_, stats]) => stats.kills || 0);
            label = '킬 수';
            borderColor = 'rgb(255, 206, 86)';
            backgroundColor = 'rgba(255, 206, 86, 0.1)';
            break;
        case 'wins':
            data = filteredData.map(([_, stats]) => stats.wins || 0);
            label = '승리';
            borderColor = 'rgb(75, 192, 192)';
            backgroundColor = 'rgba(75, 192, 192, 0.1)';
            break;
    }
    
    // 기존 차트 제거
    if (currentChart) {
        currentChart.destroy();
    }
    
    // 새 차트 생성
    const ctx = document.getElementById('statsChart').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${members[selectedMember].name} - ${label} 추이`,
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: selectedChartType !== 'kd',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// 클랜 평균 차트 그리기
function drawClanAverageChart() {
    if (!statsHistory || Object.keys(statsHistory).length === 0) {
        console.log('No stats history for clan average chart');
        return;
    }
    
    // 날짜별 평균 계산
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - selectedPeriod);
    
    const dateAverages = {};
    
    Object.values(statsHistory).forEach(memberHistory => {
        Object.entries(memberHistory).forEach(([date, stats]) => {
            if (new Date(date) >= cutoffDate) {
                if (!dateAverages[date]) {
                    dateAverages[date] = {
                        kd: [],
                        avgDamage: [],
                        count: 0
                    };
                }
                dateAverages[date].kd.push(parseFloat(stats.kd) || 0);
                dateAverages[date].avgDamage.push(stats.avgDamage || 0);
                dateAverages[date].count++;
            }
        });
    });
    
    const sortedDates = Object.keys(dateAverages).sort();
    const labels = sortedDates.map(date => formatChartDate(date));
    
    const kdData = sortedDates.map(date => {
        const values = dateAverages[date].kd;
        return values.reduce((a, b) => a + b, 0) / values.length;
    });
    
    const damageData = sortedDates.map(date => {
        const values = dateAverages[date].avgDamage;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    });
    
    // 기존 차트 제거
    if (clanChart) {
        clanChart.destroy();
    }
    
    // 새 차트 생성
    const ctx = document.getElementById('clanAverageChart').getContext('2d');
    clanChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '평균 K/D',
                    data: kdData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: '평균 데미지',
                    data: damageData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '클랜 평균 성장 추이',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'K/D'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '평균 데미지'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// 클랜 랭킹 업데이트
function updateClanRankings() {
    const rankings = {
        kd: [],
        damage: [],
        kills: [],
        wins: []
    };
    
    // 각 멤버의 현재 통계 수집
    Object.entries(members).forEach(([key, member]) => {
        if (member.currentStats) {
            const stats = member.currentStats;
            // K/D 값 정상화
            let kdValue = parseFloat(stats.kd) || 0;
            if (kdValue > 100) kdValue = 0;
            
            rankings.kd.push({ name: member.name, value: kdValue });
            rankings.damage.push({ name: member.name, value: stats.avgDamage || 0 });
            rankings.kills.push({ name: member.name, value: stats.kills || 0 });
            rankings.wins.push({ name: member.name, value: stats.wins || 0 });
        }
    });
    
    // 데이터가 있으면 정렬 및 표시, 없으면 안내 메시지
    if (rankings.kd.length > 0) {
        displayRanking('kdRanking', rankings.kd.sort((a, b) => b.value - a.value), 'kd');
        displayRanking('damageRanking', rankings.damage.sort((a, b) => b.value - a.value), 'damage');
        displayRanking('killsRanking', rankings.kills.sort((a, b) => b.value - a.value), 'kills');
        displayRanking('winsRanking', rankings.wins.sort((a, b) => b.value - a.value), 'wins');
    } else {
        // 데이터가 없을 때 안내 메시지 표시
        ['kdRanking', 'damageRanking', 'killsRanking', 'winsRanking'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<li style="color: rgba(255,255,255,0.5); text-align: center;">데이터 수집 대기 중...</li>';
            }
        });
    }
}

// 랭킹 표시
function displayRanking(elementId, data, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = '';
    
    data.slice(0, 5).forEach((item, index) => {
        const li = document.createElement('li');
        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';
        
        let valueDisplay = item.value;
        if (type === 'kd') {
            valueDisplay = item.value.toFixed(2);
        }
        
        li.innerHTML = `
            <span class="rank-name">${medal}${item.name}</span>
            <span class="rank-value">${valueDisplay}</span>
        `;
        element.appendChild(li);
    });
}

// 유틸리티 함수들
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatChartDate(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.classList.toggle('hidden', !show);
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
}
