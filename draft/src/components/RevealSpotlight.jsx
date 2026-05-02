// 指名発表スポットライト演出
// - 中央に拡大カードがフライアップ
// - くるくる回転 + パーティクルバースト
// - 効果音 + 音声読み上げ
// - 読み上げ完了後、フェードアウト
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playFanfare, speak, buildRevealSpeech } from '../utils/announceReveal';
import './RevealSpotlight.css';

/**
 * @param {object} props
 * @param {{ horseName, fatherName, motherName, motherFatherName, gender, comment }} props.nomination
 * @param {{ nickname, avatarColor }} props.user
 * @param {boolean} props.muted
 * @param {() => void} props.onDone
 */
export default function RevealSpotlight({ nomination, user, muted, onDone }) {
  const [phase, setPhase] = useState('enter'); // enter -> spinning -> exit
  const cancelSpeechRef = useRef(null);

  useEffect(() => {
    let timer1;
    let timer2;

    // Phase 1: 中央に登場（0.6s）
    timer1 = setTimeout(() => {
      setPhase('spinning');
      if (!muted) {
        playFanfare();
      }
      const text = buildRevealSpeech({
        nickname: user?.nickname,
        horseName: nomination?.horseName,
        fatherName: nomination?.fatherName,
        motherName: nomination?.motherName,
        motherFatherName: nomination?.motherFatherName,
        comment: nomination?.comment,
      });
      const startExit = () => {
        setPhase('exit');
      };
      if (!muted) {
        cancelSpeechRef.current = speak(text, startExit);
        // 万一 onend が来ない場合のフォールバック（最大15秒）
        timer2 = setTimeout(startExit, 15000);
      } else {
        // ミュート時は3秒で閉じる
        timer2 = setTimeout(startExit, 3000);
      }
    }, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (cancelSpeechRef.current) cancelSpeechRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'exit') return;
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (!nomination) return null;

  const avatarColor = user?.avatarColor || '#1a6b3c';
  const nickname = user?.nickname || '???';
  const genderClass = nomination.gender === '牝' ? 'f' : 'm';

  return (
    <AnimatePresence>
      <motion.div
        className="rs-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* パーティクルバースト */}
        {phase === 'spinning' && (
          <div className="rs-burst" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                className="rs-spark"
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{
                  x: Math.cos((i / 18) * Math.PI * 2) * 320,
                  y: Math.sin((i / 18) * Math.PI * 2) * 320,
                  opacity: 0,
                  scale: 1.4,
                }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}

        {/* 中央カード */}
        <motion.div
          className="rs-card"
          initial={{ scale: 0.3, opacity: 0, rotateY: 0 }}
          animate={{
            scale: phase === 'enter' ? 1 : phase === 'spinning' ? 1.05 : 0.6,
            opacity: phase === 'exit' ? 0 : 1,
            rotateY: phase === 'spinning' ? [0, 360, 720, 1080] : 0,
          }}
          transition={{
            scale: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
            opacity: { duration: 0.5 },
            rotateY: phase === 'spinning'
              ? { duration: 1.6, ease: 'easeInOut', times: [0, 0.33, 0.66, 1] }
              : { duration: 0.4 },
          }}
        >
          {/* ユーザー帯 */}
          <div className="rs-user">
            <div className="rs-avatar" style={{ backgroundColor: avatarColor }}>
              {nickname.charAt(0)}
            </div>
            <span className="rs-nickname">{nickname}</span>
            <span className="rs-tag">指名</span>
          </div>

          {/* 馬名 */}
          <div className="rs-horse">
            <span className={`rs-gender ${genderClass}`}>
              {genderClass === 'f' ? '♀' : '♂'}
            </span>
            <span className="rs-horse-name">{nomination.horseName || '不明'}</span>
          </div>

          {/* 血統 */}
          <div className="rs-pedigree">
            <div className="rs-ped-row">
              <span className="rs-ped-label">父</span>
              <span className="rs-ped-value">{nomination.fatherName || '-'}</span>
            </div>
            <div className="rs-ped-row">
              <span className="rs-ped-label mother">母</span>
              <span className="rs-ped-value">{nomination.motherName || '-'}</span>
            </div>
            <div className="rs-ped-row">
              <span className="rs-ped-label motherfather">母父</span>
              <span className="rs-ped-value">{nomination.motherFatherName || '-'}</span>
            </div>
          </div>

          {/* コメント */}
          {nomination.comment && (
            <div className="rs-comment">
              <div className="rs-comment-label">指名コメント</div>
              <div className="rs-comment-text">{nomination.comment}</div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
