import React, { useState, useEffect, useCallback, useRef } from 'react';

const WORDS = [
  // 4-5 letters
  'NOVEL', 'STORY', 'DRAFT', 'PROSE', 'RHYME', 'SCENE', 'THEME', 'GENRE', 'VOICE', 'STYLE',
  'PLOT', 'HERO', 'TONE', 'MOOD', 'POEM', 'LYRIC', 'VERSE', 'TALE', 'BOOK', 'PAGE',
  'QUEST', 'FABLE', 'HUMOR', 'IRONY', 'TWIST', 'MYTH', 'EPIC', 'SAGA', 'LORE', 'RUNE',
  // 6 letters
  'AUTHOR', 'EDITOR', 'STANZA', 'SONNET', 'SIMILE', 'CLIMAX', 'MOTIVE', 'MEMORY', 'SKETCH',
  'SCRIPT', 'LEGEND', 'BALLAD', 'SATIRE', 'PARODY', 'SYMBOL', 'ALLURE',
  // 7 letters
  'CHAPTER', 'FANTASY', 'MYSTERY', 'JOURNAL', 'FICTION', 'SUBPLOT', 'SETTING', 'VILLAIN',
  'HEROINE', 'WRITING', 'PUBLISH', 'GRAMMAR', 'SYNONYM', 'TRAGEDY', 'ROMANCE', 'ODYSSEY',
  // 8+ letters
  'METAPHOR', 'PROLOGUE', 'EPILOGUE', 'NARRATOR', 'DIALOGUE', 'CONFLICT', 'SUSPENSE',
  'SENTENCE', 'NARRATIVE', 'CHARACTER', 'PARAGRAPH', 'ADVENTURE', 'ANTHOLOGY',
];

function getRandomWord(exclude) {
  const pool = exclude ? WORDS.filter(w => w !== exclude) : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getWordFromSeed(seed) {
  return WORDS[seed % WORDS.length];
}

function HangmanSVG({ wrong }) {
  return (
    <svg width="120" height="130" viewBox="0 0 120 130" className="hangman-svg">
      <line x1="10" y1="125" x2="110" y2="125" className="hangman-gallows" />
      <line x1="30" y1="125" x2="30" y2="10"  className="hangman-gallows" />
      <line x1="30" y1="10"  x2="75" y2="10"  className="hangman-gallows" />
      <line x1="75" y1="10"  x2="75" y2="25"  className="hangman-gallows" />
      {wrong >= 1 && <circle cx="75" cy="35" r="10" className="hangman-figure" />}
      {wrong >= 2 && <line x1="75" y1="45" x2="75" y2="80" className="hangman-figure" />}
      {wrong >= 3 && <line x1="75" y1="55" x2="55" y2="70" className="hangman-figure" />}
      {wrong >= 4 && <line x1="75" y1="55" x2="95" y2="70" className="hangman-figure" />}
      {wrong >= 5 && <line x1="75" y1="80" x2="55" y2="100" className="hangman-figure" />}
      {wrong >= 6 && <line x1="75" y1="80" x2="95" y2="100" className="hangman-figure" />}
    </svg>
  );
}

const KEY_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
];

const MAX_WRONG = 6;

function HangmanGame({ onClose, members = [], currentUser, onSendChallenge, vsSession, opponentResult, onVsResult }) {
  const initWord = () => vsSession ? getWordFromSeed(vsSession.seed) : getRandomWord();

  const [word, setWord] = useState(initWord);
  const [guessed, setGuessed] = useState(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [resultReported, setResultReported] = useState(false);

  // Challenge picker state
  const [showPicker, setShowPicker] = useState(false);
  const [challengeSent, setChallengeSent] = useState(false);
  const pickerRef = useRef(null);

  const wrongGuesses = [...guessed].filter(l => !word.includes(l));

  // Reset when vsSession seed changes
  useEffect(() => {
    if (vsSession) {
      setWord(getWordFromSeed(vsSession.seed));
      setGuessed(new Set());
      setGameOver(false); setWon(false);
      setResultReported(false);
    }
  }, [vsSession?.seed]); // eslint-disable-line

  // Click outside to close picker
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Report VS result once when game ends
  useEffect(() => {
    if (gameOver && vsSession && !resultReported) {
      setResultReported(true);
      onVsResult?.({ outcome: won ? 'won' : 'lost', score: null });
    }
  }, [gameOver, vsSession, won, resultReported, onVsResult]);

  const guess = useCallback((letter) => {
    if (gameOver || guessed.has(letter)) return;
    const next = new Set([...guessed, letter]);
    setGuessed(next);
    const nextWrong = [...next].filter(l => !word.includes(l));
    if (nextWrong.length >= MAX_WRONG) { setGameOver(true); setWon(false); }
    else if (word.split('').every(l => next.has(l))) { setGameOver(true); setWon(true); }
  }, [gameOver, guessed, word]);

  useEffect(() => {
    const handler = (e) => {
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k)) guess(k);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [guess]);

  const playAgain = () => {
    if (vsSession) return;
    setWord(getRandomWord(word));
    setGuessed(new Set());
    setGameOver(false); setWon(false);
    setResultReported(false);
  };

  const eligibleMembers = members.filter(m => m.user_id !== currentUser?.id && !m.removed_at);

  return (
    <div className="wordle-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wordle-panel hangman-panel">
        <div className="wordle-header">
          <div className="wordle-title">
            <span>🎭</span>
            <h2>Hangman</h2>
            <span className="wordle-badge">{vsSession ? `vs ${vsSession.opponentName}` : 'Writers Edition'}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {!vsSession && eligibleMembers.length > 0 && (
              <div ref={pickerRef} className="challenge-wrap">
                {challengeSent
                  ? <span className="challenge-sent-msg">⏳ Waiting…</span>
                  : (
                    <button
                      className="btn-icon"
                      onClick={() => setShowPicker(v => !v)}
                      title="Challenge a player to 1v1"
                    >⚔️</button>
                  )
                }
                {showPicker && (
                  <div className="challenge-picker">
                    <p className="challenge-picker-label">Challenge to Hangman:</p>
                    {eligibleMembers.map(m => (
                      <button key={m.user_id} className="challenge-picker-item" onClick={() => {
                        onSendChallenge?.(m.user_id, m.name);
                        setChallengeSent(true);
                        setShowPicker(false);
                      }}>
                        <span className="challenge-avatar">{(m.name || '?').charAt(0).toUpperCase()}</span>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className="btn-icon" onClick={onClose} title="Close">✕</button>
          </div>
        </div>

        <div className="wordle-body">
          {/* VS status bar */}
          {vsSession && (
            <div className="vs-status-bar">
              <span>⚔️ vs <strong>{vsSession.opponentName}</strong></span>
              {opponentResult
                ? <span className={`vs-result vs-result--${opponentResult.outcome}`}>
                    {opponentResult.outcome === 'won' ? 'Won ✓' : 'Lost ✗'}
                  </span>
                : <span className="vs-playing">Playing…</span>
              }
            </div>
          )}

          <HangmanSVG wrong={wrongGuesses.length} />
          <p className="hangman-counter">
            {wrongGuesses.length}/{MAX_WRONG} wrong
            {wrongGuesses.length > 0 && (
              <span className="hangman-wrong-letters"> · {wrongGuesses.join(' ')}</span>
            )}
          </p>

          <div className="hangman-word">
            {word.split('').map((letter, i) => (
              <span
                key={i}
                className={`hangman-letter${guessed.has(letter) ? ' hangman-letter--revealed' : ''}${gameOver && !won && !guessed.has(letter) ? ' hangman-letter--missed' : ''}`}
              >
                {guessed.has(letter) || gameOver ? letter : '_'}
              </span>
            ))}
          </div>

          {gameOver && (
            <div className={`wordle-result ${won ? 'wordle-result--won' : 'wordle-result--lost'}`}>
              <span>{won ? 'You got it! 🎉' : 'Better luck next time'}</span>
              {!vsSession && <button className="wordle-play-again" onClick={playAgain}>Play Again</button>}
            </div>
          )}

          {!gameOver && (
            <div className="hangman-keyboard">
              {KEY_ROWS.map((row, r) => (
                <div key={r} className="hangman-key-row">
                  {row.map(letter => {
                    const isWrong   = guessed.has(letter) && !word.includes(letter);
                    const isCorrect = guessed.has(letter) &&  word.includes(letter);
                    return (
                      <button
                        key={letter}
                        className={`hangman-key${isWrong ? ' hangman-key--wrong' : isCorrect ? ' hangman-key--correct' : ''}`}
                        onClick={() => guess(letter)}
                        disabled={guessed.has(letter)}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <p className="wordle-hint">
            {vsSession ? 'Same word — first to solve wins ⚔️' : 'Literary themed words · type or click letters'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default HangmanGame;
