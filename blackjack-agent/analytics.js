// Session analytics tracking

const Analytics = (() => {
    const session = {
        hands: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        blackjacks: 0,
        bankrollHistory: [],
        startingBalance: 0,
        aiMatchesBasic: 0,
        aiDeviatesBasic: 0,
        currentStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
        streakType: null,
        totalBet: 0,
        totalPayout: 0,
    };

    function init(startingBalance) {
        session.startingBalance = startingBalance;
        session.bankrollHistory = [startingBalance];
    }

    function recordHand(outcome, bet, newBalance, aiAction, basicAction) {
        session.hands++;
        session.totalBet += bet;

        if (outcome === 'win' || outcome === 'blackjack') {
            session.wins++;
            if (outcome === 'blackjack') session.blackjacks++;
            session.totalPayout += (outcome === 'blackjack') ? bet * 1.5 : bet;
            if (session.streakType === 'win') {
                session.currentStreak++;
            } else {
                session.streakType = 'win';
                session.currentStreak = 1;
            }
            session.maxWinStreak = Math.max(session.maxWinStreak, session.currentStreak);
        } else if (outcome === 'loss') {
            session.losses++;
            if (session.streakType === 'loss') {
                session.currentStreak++;
            } else {
                session.streakType = 'loss';
                session.currentStreak = 1;
            }
            session.maxLossStreak = Math.max(session.maxLossStreak, session.currentStreak);
        } else {
            session.pushes++;
            session.streakType = null;
            session.currentStreak = 0;
        }

        if (aiAction && basicAction) {
            if (aiAction === basicAction) session.aiMatchesBasic++;
            else session.aiDeviatesBasic++;
        }

        session.bankrollHistory.push(newBalance);
        renderStats(newBalance);
        renderChart();
    }

    function renderStats(currentBalance) {
        const el = document.getElementById('analytics-stats');
        if (!el) return;
        const winRate = session.hands ? ((session.wins / session.hands) * 100).toFixed(1) : '0.0';
        const roi = session.startingBalance
            ? (((currentBalance - session.startingBalance) / session.startingBalance) * 100).toFixed(1)
            : '0.0';
        const accuracy = (session.aiMatchesBasic + session.aiDeviatesBasic)
            ? ((session.aiMatchesBasic / (session.aiMatchesBasic + session.aiDeviatesBasic)) * 100).toFixed(0)
            : 'N/A';

        el.innerHTML = `
            <div class="stat-card"><div class="stat-value">${session.hands}</div><div class="stat-label">Hands</div></div>
            <div class="stat-card"><div class="stat-value">${winRate}%</div><div class="stat-label">Win Rate</div></div>
            <div class="stat-card"><div class="stat-value">${session.losses}</div><div class="stat-label">Losses</div></div>
            <div class="stat-card"><div class="stat-value">${session.pushes}</div><div class="stat-label">Pushes</div></div>
            <div class="stat-card"><div class="stat-value">${roi}%</div><div class="stat-label">ROI</div></div>
            <div class="stat-card"><div class="stat-value">${session.maxWinStreak}</div><div class="stat-label">Best Streak</div></div>
            <div class="stat-card"><div class="stat-value">${accuracy}%</div><div class="stat-label">AI vs Basic</div></div>
        `;
    }

    function renderChart() {
        const canvas = document.getElementById('bankroll-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.offsetWidth;
        const h = canvas.height = 140;
        ctx.clearRect(0, 0, w, h);

        const data = session.bankrollHistory;
        if (data.length < 2) return;

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((val - min) / range) * (h - 20) - 10;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const startY = h - ((data[0] - min) / range) * (h - 20) - 10;
        ctx.beginPath();
        ctx.moveTo(0, startY);
        ctx.lineTo(w, startY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function exportStats(currentBalance) {
        const stats = {
            ...session,
            currentBalance,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `blackjack-session-${Date.now()}.json`;
        a.click();
    }

    return { init, recordHand, exportStats };
})();
