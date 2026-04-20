// RoundStrip — ラウンドステータスバー (ヘッダー下)
import { Timer, Users } from './Icons';
import './RoundStrip.css';

export default function RoundStrip({ round, totalRounds, phase, phaseLabel, submittedCount, totalCount, timeLeft }) {
  const awaitingCount = totalCount - submittedCount;

  return (
    <div className="v2-round-strip">
      <div className="v2-round-strip-inner">
        <div className="v2-round-pill-group">
          <span className="v2-round-num">R{round}</span>
          <span className="v2-round-phase">{phaseLabel || phase}</span>
          <span className="v2-round-progress">{round} / {totalRounds}</span>
        </div>
        <div className="v2-round-pill-group">
          <Users size={12} style={{ color: 'rgba(255,255,255,.7)' }} />
          <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>提出:</span>
          <span style={{ fontWeight: 700, color: '#fff' }}>{submittedCount}/{totalCount}</span>
          {awaitingCount > 0 && (
            <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>(残 {awaitingCount}名)</span>
          )}
        </div>
        {timeLeft && (
          <div className="v2-round-timer">
            <Timer size={14} /> 締切まで {timeLeft}
          </div>
        )}
      </div>
    </div>
  );
}
