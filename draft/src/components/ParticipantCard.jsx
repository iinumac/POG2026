// 参加者カードコンポーネント（結果発表用） — v2 ド派手演出
import { motion, AnimatePresence } from 'framer-motion';
import './ParticipantCard.css';

export default function ParticipantCard({
  user,
  nomination,
  isRevealed = false,
  isConflict = false,
  isWinner = false,
  isLoser = false,
  allRevealed = false,
}) {
  const avatarColor = user?.avatarColor || '#1a6b3c';
  const nickname = user?.nickname || '???';

  return (
    <div className={`pc ${isConflict && allRevealed ? 'pc-conflict' : ''} ${isWinner ? 'pc-winner' : ''} ${isLoser ? 'pc-loser' : ''}`}>
      {/* ユーザー情報 */}
      <div className="pc-user">
        <div className="pc-avatar" style={{ backgroundColor: avatarColor }}>
          {nickname.charAt(0)}
        </div>
        <span className="pc-name">{nickname}</span>
      </div>

      {/* 馬情報 */}
      <div className="pc-horse">
        <AnimatePresence mode="wait">
          {!nomination ? (
            <motion.div
              key="waiting"
              className="pc-state pc-waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pc-waiting-icon">⏳</div>
              <div className="pc-waiting-text">未指名</div>
            </motion.div>
          ) : !isRevealed ? (
            <motion.div
              key="hidden"
              className="pc-state pc-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, rotateY: 90, transition: { duration: 0.3 } }}
            >
              <motion.div
                className="pc-card-back"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <div className="pc-card-back-mark">指名済</div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="revealed"
              className="pc-state pc-revealed"
              initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* 公開時のバースト */}
              <div className="pc-burst" />
              <div className="pc-reveal-content">
                <span className={`pc-gender ${nomination.gender === '牝' ? 'f' : 'm'}`}>
                  {nomination.gender === '牝' ? '♀' : '♂'}
                </span>
                <span className="pc-horse-name">{nomination.horseName}</span>
                <span className="pc-pedigree">
                  {nomination.fatherName} × {nomination.motherName}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 競合/当選/落選 */}
      <AnimatePresence>
        {isConflict && allRevealed && (
          <motion.div className="pc-badge pc-badge-conflict"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            ⚡ 競合
          </motion.div>
        )}
        {isWinner && (
          <motion.div className="pc-badge pc-badge-winner"
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
            🎉 当選
          </motion.div>
        )}
        {isLoser && (
          <motion.div className="pc-badge pc-badge-loser"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            落選
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
