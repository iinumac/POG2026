// RoundStrip — 巡目ステータスバー (ヘッダー下)
import { Timer, Users } from './Icons';
import './RoundStrip.css';

export default function RoundStrip({ round, phase, phaseLabel, submittedCount, totalCount, timeLeft }) {
  const awaitingCount = totalCount - submittedCount;

  return (
    <div className="v2-round-strip">
      <div className="v2-round-strip-inner">
        <span className="v2-round-num">{round}巡目</span>
        <span className="v2-round-phase">{phaseLabel || phase}</span>
        {totalCount > 0 && (
          <div className="v2-round-pill-group">
            <Users size={12} style={{ color: 'rgba(255,255,255,.7)' }} />
            <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>提出:</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>{submittedCount}/{totalCount}</span>
            {awaitingCount > 0 && (
              <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>(残 {awaitingCount}名)</span>
            )}
          </div>
        )}
        {timeLeft && (
          <div className="v2-round-timer">
            <Timer size={14} /> 締切まで {timeLeft}
          </div>
        )}
      </div>
    </div>
  );
}
