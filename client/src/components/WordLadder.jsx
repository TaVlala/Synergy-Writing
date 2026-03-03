import React, { useState, useRef, useEffect } from 'react';

// All valid 4-letter words (includes puzzle chains + common words for alternative paths)
const WORDS = new Set([
  'ABLE','ACID','AGED','AIDE','ALSO','AREA','ARMY','AWAY',
  'BABY','BACK','BALL','BAND','BANK','BARE','BARK','BARN','BASE','BATH','BATE',
  'BEAD','BEAM','BEAN','BEAR','BEAT','BEER','BELL','BELT','BEND','BEST',
  'BIRD','BITE','BLOW','BLUE','BOAT','BODY','BOLE','BOND','BONE','BOOK',
  'BORE','BORN','BULK','BURN','CAGE','CAKE','CALL','CAME','CANE','CAPE',
  'CARD','CARE','CART','CASE','CASH','CAST','CAVE','CELL','CHAT','CHIP',
  'COAL','COAT','CODE','COIN','COLD','COME','CONE','COOK','COOL','COPE',
  'COPY','CORD','CORE','COST','COVE','CROP','CROW','CUBE','CURE','CUTE',
  'DARE','DATE','DEAL','DEAR','DEED','DEEP','DEER','DENT','DICE','DIME',
  'DINE','DIRE','DIRT','DISC','DISH','DISK','DIVE','DOCK','DOME','DONE',
  'DOOR','DOSE','DOVE','DOWN','DRAW','DROP','DRUM','DUSK','DUST','DARK',
  'DARN','DAWN','DOTE','EARN','EASE','EAST','EDGE','EMIT','EPIC','EVEN',
  'EVER','EVIL','EXAM','EXIT','FACE','FACT','FAIL','FAIR','FALL','FAME',
  'FARM','FAST','FATE','FEAR','FEAT','FEED','FEEL','FEET','FELL','FELT',
  'FILE','FILL','FILM','FIND','FINE','FIRE','FIRM','FISH','FIST','FLAG',
  'FLAT','FOLD','FOND','FOOD','FOOT','FORD','FORE','FORK','FORM','FORT',
  'FOUL','FOUR','FREE','FULL','FUME','FUSE','GAIN','GALE','GAME','GANG',
  'GATE','GAVE','GAZE','GEAR','GIFT','GIRL','GIVE','GLOW','GLUE','GOAL',
  'GOAT','GOLD','GONE','GOOD','GORE','GRAB','GREW','GRIN','GRIP','GROW',
  'GULF','GUST','HACK','HAIL','HAIR','HALE','HALF','HALT','HAND','HANG',
  'HARD','HARE','HARM','HATE','HAVE','HAZE','HEAD','HEAL','HEAT','HEEL',
  'HELP','HERE','HERD','HIDE','HIKE','HILL','HINT','HIRE','HOLD','HOLE',
  'HOME','HOOD','HOOK','HOPE','HORN','HOSE','HOST','HOUR','HULL','HUNT',
  'HURT','IDLE','INTO','IRON','ITEM','JAIL','JEST','JOLT','JUMP','JUST',
  'KEEN','KEEP','KICK','KIND','KING','KNOT','LACK','LACE','LAID','LAMP',
  'LAND','LANE','LARK','LAST','LEAF','LEAK','LEAN','LEAP','LATE','LAME',
  'LEND','LENT','LEST','LIFE','LIFT','LIKE','LIME','LINE','LINK','LION',
  'LIST','LIVE','LOAN','LOCK','LOFT','LORE','LOSS','LOST','LOUD','LOVE',
  'LURE','LUST','MADE','MAIL','MAIN','MAKE','MALE','MALL','MARE','MARK',
  'MARS','MART','MASK','MAST','MATE','MAZE','MEAL','MEAN','MEAT','MEET',
  'MELT','MESS','MICE','MILD','MILE','MILL','MIND','MINE','MINT','MIRE',
  'MISS','MIST','MOAT','MODE','MOLD','MOLE','MOON','MOOR','MORE','MOST',
  'MOVE','MUCH','MUSE','MUSK','MUTE','MYTH','NAIL','NAME','NAVY','NEAR',
  'NEAT','NECK','NEED','NEST','NEXT','NICE','NODE','NONE','NOON','NORM',
  'NOSE','NOTE','NUDE','OATH','OBEY','ODDS','ONCE','ONLY','OPEN','OVAL',
  'OVEN','OVER','PACE','PACK','PACT','PAIN','PAIR','PALE','PALM','PANE',
  'PARK','PART','PASS','PAST','PATH','PAVE','PEAK','PEAR','PEAT','PEEL',
  'PEER','PILE','PILL','PINE','PINK','PIPE','PITY','PLAY','PLEA','PLOW',
  'PLUM','POEM','POET','POLE','POLL','POND','POOL','POOR','PORE','PORT',
  'POSE','POST','POUR','PREY','PULL','PUMP','PURE','PUSH','RACK','RAGE',
  'RAIN','RAKE','RANG','RANK','RANT','RATE','RACE','READ','REAL','REAP',
  'REEL','REND','RENT','REST','RICE','RIDE','RIFE','RIFT','RING','RINK',
  'RIPE','RISE','RISK','ROAD','ROAM','ROAR','ROBE','RODE','ROLE','ROLL',
  'ROOK','ROOF','ROOM','ROOT','ROPE','ROSE','ROUT','ROVE','RUIN','RULE',
  'RUNG','RUSE','RUSH','RUST','ROCK','SACK','SAFE','SAGE','SAIL','SAKE',
  'SALE','SALT','SAME','SAND','SANE','SANG','SASH','SAVE','SEAL','SEAM',
  'SEAR','SEAT','SEED','SEEK','SEEM','SEEN','SELF','SELL','SEND','SENT',
  'SHED','SHIP','SHOE','SHOP','SHOT','SHOW','SHUT','SIDE','SIGH','SILK',
  'SING','SINK','SITE','SIZE','SKIN','SKIP','SLAM','SLIM','SLIP','SLOT',
  'SLOW','SLUR','SNAP','SNOW','SOAK','SOAR','SOCK','SOFT','SOIL','SOLD',
  'SOLE','SOME','SONG','SOOT','SORE','SORT','SOUL','SOUP','SOUR','SPIN',
  'SPOT','SPUR','STAR','STAY','STEM','STEP','STOP','STUN','SUCH','SUIT',
  'SUNG','SUNK','SURE','SWAM','SWAN','SWAT','SWAY','TAIL','TAKE','TALK',
  'TALL','TAME','TANK','TAPE','TALE','TASK','TEAL','TEAR','TELL','TEND',
  'TENT','TEST','TICK','TIDE','TILL','TILT','TIME','TIRE','TOAD','TOIL',
  'TOLD','TOLL','TONE','TOOK','TOOL','TORE','TORN','TOSS','TOUR','TOWN',
  'TREK','TRIM','TRIO','TRIP','TRUE','TUBE','TUCK','TUNE','TURN','TWIN',
  'UGLY','UNDO','UNIT','UPON','URGE','USED','VALE','VANE','VARY','VASE',
  'VAST','VEIL','VEIN','VENT','VERY','VINE','VOID','VOLT','VOTE','WADE',
  'WAKE','WALK','WALL','WAND','WANT','WANE','WARD','WARP','WARM','WART',
  'WASH','WASP','WAVE','WEAK','WEED','WEEK','WEEP','WELD','WELL','WELT',
  'WENT','WEPT','WEST','WHIP','WILD','WILL','WILT','WIND','WINE','WING',
  'WINK','WIRE','WISE','WISH','WORD','WORE','WOKE','WOLF','WONT','WOVE',
  'WRAP','WREN','WRIT','YANK','YARN','YAWN','YEAR','YELL','YOKE','ZEAL',
  'ZERO','ZINC','ZONE','ZOOM',
]);

// All chains are verified letter-by-letter
const PUZZLES = [
  { from: 'DARK', to: 'DAWN', par: 2,  solution: ['DARK','DARN','DAWN'] },
  { from: 'LOVE', to: 'LIKE', par: 3,  solution: ['LOVE','LIVE','LIME','LIKE'] },
  { from: 'COLD', to: 'WARM', par: 4,  solution: ['COLD','CORD','WORD','WARD','WARM'] },
  { from: 'HEAD', to: 'TAIL', par: 5,  solution: ['HEAD','HEAL','TEAL','TELL','TALL','TAIL'] },
  { from: 'HAND', to: 'FOOT', par: 5,  solution: ['HAND','BAND','BOND','FOND','FOOD','FOOT'] },
  { from: 'LINE', to: 'WORD', par: 6,  solution: ['LINE','VINE','FINE','FIND','FOND','FORD','WORD'] },
  { from: 'MORE', to: 'LANE', par: 7,  solution: ['MORE','GORE','CORE','CARE','DARE','DATE','LATE','LANE'] },
  { from: 'BOOK', to: 'TALE', par: 8,  solution: ['BOOK','ROOK','ROCK','RACK','RACE','LACE','LAME','TAME','TALE'] },
];

function isOneLetterApart(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

function getRandomPuzzle(excludeFrom) {
  const pool = excludeFrom ? PUZZLES.filter(p => p.from !== excludeFrom) : PUZZLES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function WordLadder({ onClose }) {
  const [puzzle, setPuzzle] = useState(() => getRandomPuzzle());
  const [ladder, setLadder] = useState(() => [puzzle.from]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const inputRef = useRef(null);

  const currentWord = ladder[ladder.length - 1];
  const steps = ladder.length - 1;

  useEffect(() => {
    if (inputRef.current && !won && !gaveUp) inputRef.current.focus();
  }, [won, gaveUp]);

  const submit = () => {
    const word = input.trim().toUpperCase();
    if (!word) return;
    if (word.length !== puzzle.from.length) {
      setError(`Must be ${puzzle.from.length} letters`); return;
    }
    if (!WORDS.has(word)) {
      setError('Not a valid word'); return;
    }
    if (!isOneLetterApart(currentWord, word)) {
      setError('Must differ by exactly 1 letter'); return;
    }
    if (ladder.includes(word)) {
      setError('Already used that word'); return;
    }
    const next = [...ladder, word];
    setLadder(next);
    setInput('');
    setError('');
    if (word === puzzle.to) setWon(true);
  };

  const newGame = () => {
    const p = getRandomPuzzle(puzzle.from);
    setPuzzle(p);
    setLadder([p.from]);
    setInput('');
    setError('');
    setWon(false);
    setGaveUp(false);
  };

  return (
    <div className="wordle-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wordle-panel word-ladder-panel">

        <div className="wordle-header">
          <div className="wordle-title">
            <span>🪜</span>
            <h2>Word Ladder</h2>
            <span className="wordle-badge">par {puzzle.par}</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="wordle-body">

          {/* Goal */}
          <div className="ladder-goal">
            <span className="ladder-word ladder-word--from">{puzzle.from}</span>
            <span className="ladder-arrow">→</span>
            <span className="ladder-word ladder-word--to">{puzzle.to}</span>
          </div>

          {/* Steps so far */}
          <div className="ladder-steps">
            {ladder.map((w, i) => (
              <div key={i} className={`ladder-step${w === puzzle.to ? ' ladder-step--final' : i === ladder.length - 1 && !won ? ' ladder-step--current' : ''}`}>
                <span className="ladder-step-num">{i === 0 ? '▶' : i}</span>
                <span className="ladder-step-word">
                  {i === 0
                    ? w
                    : [...w].map((ch, j) => ch !== ladder[i - 1][j]
                        ? <mark key={j} className="ladder-changed">{ch}</mark>
                        : <span key={j}>{ch}</span>
                    )
                  }
                </span>
              </div>
            ))}
          </div>

          {/* Input row */}
          {!won && !gaveUp && (
            <div className="ladder-input-row">
              <input
                ref={inputRef}
                className="ladder-input"
                value={input}
                onChange={e => { setInput(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={`Change 1 letter from ${currentWord}`}
                maxLength={puzzle.from.length}
                spellCheck={false}
              />
              <button className="btn btn-primary ladder-submit" onClick={submit}>→</button>
            </div>
          )}

          {error && <p className="ladder-error">{error}</p>}

          {won && (
            <div className="wordle-result wordle-result--won">
              <span>
                {steps <= puzzle.par ? `${steps} steps — under par! 🎉` : `Solved in ${steps} steps 👍`}
              </span>
              <button className="wordle-play-again" onClick={newGame}>New Puzzle</button>
            </div>
          )}

          {gaveUp && (
            <div className="wordle-result wordle-result--lost">
              <span>One solution:</span>
              <div className="ladder-solution">{puzzle.solution.join(' → ')}</div>
              <button className="wordle-play-again" onClick={newGame}>New Puzzle</button>
            </div>
          )}

          {!won && !gaveUp && (
            <button className="ladder-giveup" onClick={() => setGaveUp(true)}>Give Up</button>
          )}

          <p className="wordle-hint">Change 1 letter per step · {steps} step{steps !== 1 ? 's' : ''} taken · par {puzzle.par}</p>
        </div>
      </div>
    </div>
  );
}

export default WordLadder;
