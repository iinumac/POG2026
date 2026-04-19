// 参加者カードコンポーネント（結果発表用）
import { motion } from 'framer-motion';
import './ParticipantCard.css';

export default function ParticipantCard({
  user,
  nomination,
  isRevealed = false,
  isConflict = false,
  isWinner = false,
  isLoser = false,
  compact = false,
}) {
  const avatarColor = user?.avatarColor || '#1a6b3c';
  const nickname = user?.nickname || '???';

  return (
    <motion.div
      className={`participant-card ${compact ? 'compact' : ''} ${isConflict ? 'conflict' : ''} ${isWinner ? 'winner' : ''} ${isLoser ? 'loser' : ''}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* ユーザー情報 */}
      <div className="participant-header">
        <div className="participant-avatar" style={{ backgroundColor: avatarColor }}>
          {nickname.charAt(0)}
        </div>
        <span className="participant-name">{nickname}</span>
      </div>

      {/* 指名馬 */}
      <div className="participant-horse">
        {!nomination ? (
          <div className="horse-waiting">
            <span className="waiting-icon">⏳</span>
            <span className="waiting-text">未指名</span>
          </div>
        ) : !isRevealed ? (
          <motion.div
            className="horse-hidden"
            animate={{ rotateY: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <span className="hidden-icon">🎴</span>
            <span className="hidden-text">???</span>
          </motion.div>
        ) : (
          <motion.div
            className="horse-revealed"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className={`revealed-gender ${nomination.gender === '牝' ? 'gender-female' : 'gender-male'}`}>
              {nomination.gender === '牝' ? '♀' : '♂'}
            </span>
            <span className="revealed-name">{nomination.horseName}</span>
            <span className="revealed-pedigree">
              {nomination.fatherName} × {nomination.motherName}
            </span>
          </motion.div>
        )}
      </div>

      {/* 競合/当選/落選マーク */}
      {isConflict && isRevealed && (
        <div className="conflict-indicator">
          <span>⚡ 競合</span>
        </div>
      )}
      {isWinner && (
        <div className="winner-indicator">
          <span>🎉 当選</span>
        </div>
      )}
      {isLoser && (
        <div className="loser-indicator">
          <span>💫 落選</span>
        </div>
      )}
    </motion.div>
  );
}
