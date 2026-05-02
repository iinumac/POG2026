// 指名発表時の効果音・音声読み上げユーティリティ

/**
 * Web Audio API でファンファーレ風効果音を合成して再生
 */
export function playFanfare() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // A4 → C#5 → E5 → A5 のアルペジオ（明るい昇順）
    const notes = [
      { freq: 440.00, t: 0.00 }, // A4
      { freq: 554.37, t: 0.10 }, // C#5
      { freq: 659.25, t: 0.20 }, // E5
      { freq: 880.00, t: 0.30 }, // A5
    ];
    notes.forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + t;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    // 余韻のために1秒後にcontextを閉じる
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch (e) {
    console.warn('効果音再生失敗:', e);
  }
}

/**
 * 利用可能な日本語音声を非同期で取得（voiceschanged イベント対応）
 */
let _voicesPromise = null;
function getVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }
  if (_voicesPromise) return _voicesPromise;
  _voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const ready = synth.getVoices();
    if (ready && ready.length > 0) {
      resolve(ready);
      return;
    }
    let resolved = false;
    const handler = () => {
      const v = synth.getVoices();
      if (v && v.length > 0 && !resolved) {
        resolved = true;
        synth.removeEventListener('voiceschanged', handler);
        resolve(v);
      }
    };
    synth.addEventListener('voiceschanged', handler);
    // フォールバック（音声リスト取得に1.5秒以上かかる場合）
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices() || []);
    }, 1500);
  });
  return _voicesPromise;
}

/**
 * 高品質な日本語音声を優先順で選択（女性ボイス優先）
 * localStorage の `revealVoiceName` で手動指定可能
 */
function pickJapaneseVoice(voices) {
  if (!voices || voices.length === 0) return null;
  const ja = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('ja'));
  if (ja.length === 0) return null;

  // 1) 手動指定（localStorage.revealVoiceName）
  try {
    const preferred = localStorage.getItem('revealVoiceName');
    if (preferred) {
      const exact = ja.find((v) => v.name === preferred);
      if (exact) return exact;
    }
  } catch { /* noop */ }

  // 2) 名前ベースの優先順（女性 → 男性、Natural → Premium → 標準）
  const patterns = [
    /Google.*日本語|Google.*Japanese/i,                    // Google 日本語（性別不明だが概ね女性）
    /Microsoft.*Nanami.*Online \(Natural\)|Nanami.*Natural/i, // Edge Nanami（女性・Natural）
    /Microsoft.*Mayu.*Online \(Natural\)/i,                  // Edge Mayu（女性・Natural、地域版）
    /Microsoft.*Aoi.*Online \(Natural\)/i,                   // Edge Aoi（女性・Natural、地域版）
    /Microsoft.*Shiori.*Online \(Natural\)/i,                // Edge Shiori（女性・Natural、地域版）
    /Microsoft.*Keita.*Online \(Natural\)|Keita.*Natural/i,  // Edge Keita（男性・Natural）← 女性が無いとき
    /Microsoft.*Daichi.*Online \(Natural\)/i,                // Edge Daichi（男性・Natural、地域版）
    /Online \(Natural\).*ja-JP|ja-JP.*Online \(Natural\)/i,  // 他の Edge Natural（最終手段）
    /Kyoko.*Premium|Premium.*Kyoko/i,                        // macOS Kyoko Premium（女性）
    /Kyoko/i,                                                // macOS Kyoko（女性）
    /Otoya/i,                                                // macOS Otoya（男性）
  ];
  for (const re of patterns) {
    const found = ja.find((v) => re.test(v.name));
    if (found) return found;
  }
  const cloud = ja.find((v) => v.localService === false);
  if (cloud) return cloud;
  return ja[0];
}

let _loggedVoice = false;

/**
 * 日本語音声で読み上げ（高品質ボイス自動選択）
 * @param {string} text 読み上げテキスト
 * @param {() => void} [onEnd] 完了コールバック（エラー時も呼ばれる）
 * @returns {() => void} キャンセル関数
 */
export function speak(text, onEnd) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onEnd?.();
  };
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    finish();
    return () => {};
  }
  (async () => {
    try {
      const voices = await getVoices();
      if (done) return;
      const voice = pickJapaneseVoice(voices);
      if (!_loggedVoice && voice) {
        _loggedVoice = true;
        console.log(`[announceReveal] 使用音声: ${voice.name} (${voice.lang}, localService=${voice.localService})`);
      }
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = 'ja-JP';
      u.rate = 0.98;   // 少しゆっくりめで聞きやすく
      u.pitch = 1.05;  // ほんの少し明るめ
      u.volume = 1.0;
      u.onend = finish;
      u.onerror = finish;
      // 既存読み上げをキャンセルしてから発話
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('読み上げ失敗:', e);
      finish();
    }
  })();
  return () => {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    finish();
  };
}

/**
 * 指名発表の読み上げ文面を生成
 * - コメントあり: 「○○さんの指名コメント、△△。指名馬は、◆◆◆。父は××、母は××、母父は××です。」
 * - コメントなし: 「○○さんの指名馬は、◆◆◆。父は××、母は××、母父は××です。」
 */
export function buildRevealSpeech({ nickname, horseName, fatherName, motherName, motherFatherName, comment }) {
  const nick = nickname || '誰か';
  const horse = horseName || '不明な馬';
  const father = fatherName || '不明';
  const mother = motherName || '不明';
  const motherFather = motherFatherName || '不明';
  const c = (comment || '').trim();

  // TTS 対策:
  // - 「母父」は「ははふ」と読まれるためカナ表記
  // - 「ははちち」だと先頭の「は」が助詞 (wa) と誤認されるためカタカナ「ハハチチ」を使う
  const horseLine = `指名馬は、${horse}。父は${father}で、母は${mother}、ハハチチは${motherFather}です。`;
  if (c) {
    return `${nick}さんの指名コメント、${c}。${horseLine}`;
  }
  return `${nick}さんの${horseLine}`;
}
