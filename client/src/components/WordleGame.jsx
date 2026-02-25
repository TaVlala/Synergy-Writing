<<<<<<< Updated upstream
import React, { useState, useEffect, useCallback } from 'react';

const WORDS = [
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alike','align','alive','alley',
  'allow','alone','along','alter','angel','angle','angry','anime','apart','apple',
  'apply','arena','argue','arise','armor','array','aside','asset','attic','audio',
  'audit','avoid','awake','award','aware','awful','basic','basis','beach','began',
  'begin','being','below','bench','bible','birth','black','blade','blame','bland',
  'blank','blast','blaze','bleed','blend','bless','blind','block','blood','bloom',
  'blown','board','boost','bound','brace','brain','brand','brave','bread','break',
  'breed','brick','bride','brief','bring','brisk','broad','broke','brook','brown',
  'brush','buddy','build','built','burst','buyer','cabin','camel','candy','carry',
  'catch','cause','cease','chain','chair','chalk','chaos','cheap','check','cheek',
  'cheer','chess','chest','child','china','choir','chord','civil','claim','clash',
  'class','clean','clear','clerk','click','cliff','climb','cling','clock','clone',
  'close','cloud','coach','coast','color','comic','comma','coral','couch','could',
  'count','court','cover','craft','crash','crazy','cream','creek','crime','crisp',
  'cross','crowd','crown','crush','curve','cycle','daily','dance','datum','debut',
  'delay','delta','demon','dense','depot','depth','derby','devil','digit','dirty',
  'disco','dizzy','dodge','doing','doubt','dough','dowel','draft','drain','drama',
  'drank','dream','dress','drift','drink','drive','drone','drove','drown','drunk',
  'dryer','dying','eager','early','earth','eight','elite','email','empty','enemy',
  'enjoy','enter','equal','error','essay','event','every','exact','exist','extra',
  'fable','faced','faith','false','fancy','fault','feast','fence','feral','fetch',
  'fever','field','fifth','fifty','fight','filed','final','first','fixed','flame',
  'flash','flats','flesh','float','flood','floor','fluid','flute','focus','force',
  'forge','forth','forum','found','frame','frank','fraud','fresh','front','froze',
  'fruit','fully','funny','genre','ghost','given','gland','glass','glide','gloom',
  'gloss','glove','going','grace','grade','grain','grand','grant','graph','grasp',
  'grass','grave','great','green','greet','grief','grill','grind','groan','gross',
  'group','grove','grown','guard','guess','guest','guide','guild','guilt','guise',
  'gusto','habit','happy','harsh','haste','haven','heart','heavy','hedge','hello',
  'hence','herbs','hinge','honor','hoped','horse','hotel','house','human','humid',
  'hurry','hyper','ideal','image','imply','inbox','index','indie','inner','input',
  'irony','issue','ivory','jewel','joint','joker','judge','juice','juicy','keeps',
  'knife','knock','known','label','lance','large','laser','later','laugh','layer',
  'learn','lease','legal','level','light','limit','liner','lingo','links','liver',
  'logic','loose','lover','lower','lucky','lunar','lyric','magic','major','maker',
  'manor','maple','march','match','mayor','media','metal','model','money','month',
  'moral','motor','mount','mouse','mouth','moved','movie','music','naive','naval',
  'night','noble','north','noted','novel','nurse','nymph','occur','ocean','offer',
  'often','olive','onset','opera','orbit','order','other','ought','outer','owned',
  'oxide','ozone','paint','panel','paper','party','patch','pause','peace','penal',
  'penny','phase','phone','photo','piano','piece','pilot','pixel','pizza','place',
  'plain','plane','plant','plate','plaza','plead','pluck','plume','point','polar',
  'polka','popup','pound','power','press','price','pride','prime','print','prior',
  'prize','probe','prone','proof','prose','proud','prove','proxy','pulse','purse',
  'query','quest','queue','quick','quiet','quota','quote','radar','radio','raise',
  'rally','ranch','range','rapid','ratio','reach','react','ready','realm','rebel',
  'refer','reign','relax','repay','repel','reply','rerun','reset','rider','ridge',
  'rifle','right','rival','river','robot','rocky','roman','rouge','rough','round',
  'route','royal','rugby','ruler','rural','rusty','sadly','saint','salad','sauce',
  'scale','scene','scone','scope','score','scout','seize','sense','serve','setup',
  'seven','shade','shake','shall','shame','shape','share','sharp','sheer','sheet',
  'shift','shine','shirt','shore','short','shout','shove','sight','signs','since',
  'sixth','sixty','sized','skill','skull','skunk','slate','slave','sleep','slice',
  'slide','slime','slope','sloth','slump','small','smart','smell','smile','smoke',
  'snack','snake','solar','solid','solve','sorry','south','space','spare','spark',
  'speak','speed','spend','spill','spine','spite','split','spoke','spoon','sport',
  'spray','squad','stack','staff','stage','stain','stake','stand','stark','start',
  'state','stays','steel','steep','steer','stern','stick','stiff','still','stock',
  'stoic','stood','store','storm','story','stove','strap','straw','stray','strip',
  'stuck','study','style','sugar','suite','sunny','super','surge','swamp','swear',
  'sweet','swept','swift','sword','swore','sworn','table','taunt','teach','teeth',
  'tempo','tense','thank','theme','there','these','thick','thing','think','third',
  'those','three','threw','throw','tiger','tight','timer','tired','title','today',
  'token','topic','total','touch','tough','tower','toxic','trace','track','trade',
  'train','trait','tramp','trash','treat','trend','trial','trick','tried','troop',
  'truck','truly','trump','trunk','trust','truth','tumor','tuner','tying','ultra',
  'uncle','under','union','unity','until','upper','upset','urban','usage','usual',
  'utter','vague','valid','value','vapor','vault','verse','video','vigor','viral',
  'visit','vista','vital','vivid','vocal','voice','voter','vowed','wagon','waste',
  'watch','water','weary','weave','wedge','weird','whale','wheat','where','which',
  'while','white','whole','whose','witty','women','world','worry','worse','worst',
  'worth','would','wound','wrath','write','wrong','yacht','yield','young','yours',
  'youth','zebra','zesty',
];

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Enter','Z','X','C','V','B','N','M','⌫'],
];

function getRandomWord(exclude) {
  const pool = exclude ? WORDS.filter(w => w !== exclude.toLowerCase()) : WORDS;
  return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
}

function getTileState(guess, index, word) {
  const letter = guess[index];
  if (!letter) return '';
  if (word[index] === letter) return 'correct';
  if (word.includes(letter)) return 'present';
  return 'absent';
}

function getKeyState(letter, guesses, word) {
  let best = '';
  for (const guess of guesses) {
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] !== letter) continue;
      const state = getTileState(guess, i, word);
      if (state === 'correct') return 'correct';
      if (state === 'present') best = 'present';
      else if (!best) best = 'absent';
    }
  }
  return best;
}

function WordleGame({ onClose }) {
  const [word, setWord] = useState(() => getRandomWord());
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState('');

  const playAgain = () => {
    setWord(getRandomWord(word));
    setGuesses([]);
    setCurrentGuess('');
    setGameOver(false);
    setWon(false);
    setMessage('');
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== 5) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      showMessage('5 letters needed');
      return;
    }
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');
    if (currentGuess === word) {
      setWon(true);
      setGameOver(true);
    } else if (newGuesses.length >= 6) {
      setGameOver(true);
    }
  }, [currentGuess, guesses, word]);

  const handleKey = useCallback((key) => {
    if (gameOver) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === '⌫' || key === 'BACKSPACE') {
      setCurrentGuess(g => g.slice(0, -1));
      return;
    }
    if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(g => g + key);
    }
  }, [gameOver, currentGuess, submitGuess]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toUpperCase();
      handleKey(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  const rows = [...guesses];
  while (rows.length < 6) rows.push('');

  return (
    <div className="wordle-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wordle-panel">

        <div className="wordle-header">
          <div className="wordle-title">
            <span>🎮</span>
            <h2>Wordle</h2>
            <span className="wordle-badge">Unlimited</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="wordle-body">
          {message && <div className="wordle-message">{message}</div>}

          <div className="wordle-board">
            {rows.map((rowGuess, rowIdx) => {
              const isCurrentRow = rowIdx === guesses.length && !gameOver;
              const displayGuess = isCurrentRow ? currentGuess : rowGuess;
              const isSubmitted = rowIdx < guesses.length;
              const isShaking = isCurrentRow && shake;

              return (
                <div key={rowIdx} className={`wordle-row${isShaking ? ' wordle-row--shake' : ''}`}>
                  {Array.from({ length: 5 }).map((_, colIdx) => {
                    const letter = displayGuess[colIdx] || '';
                    const state = isSubmitted ? getTileState(rowGuess, colIdx, word) : '';
                    const filled = !isSubmitted && letter !== '';
                    return (
                      <div
                        key={colIdx}
                        className={[
                          'wordle-tile',
                          state ? `wordle-tile--${state}` : '',
                          filled ? 'wordle-tile--filled' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {gameOver && (
            <div className={`wordle-result ${won ? 'wordle-result--won' : 'wordle-result--lost'}`}>
              <span>{won ? `You got it in ${guesses.length}! 🎉` : `The word was ${word}`}</span>
              <button className="wordle-play-again" onClick={playAgain}>Play Again</button>
            </div>
          )}

          <div className="wordle-keyboard">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="wordle-key-row">
                {row.map(k => {
                  const keyState = k.length === 1 ? getKeyState(k, guesses, word) : '';
                  return (
                    <button
                      key={k}
                      className={[
                        'wordle-key',
                        k.length > 1 ? 'wordle-key--wide' : '',
                        keyState ? `wordle-key--${keyState}` : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleKey(k === 'Enter' ? 'ENTER' : k)}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="wordle-hint">Random word each game · play as many as you like</p>
        </div>
      </div>
    </div>
  );
}

export default WordleGame;
=======
import React, { useState, useEffect, useCallback } from 'react';

const WORDS = [
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alike','align','alive','alley',
  'allow','alone','along','alter','angel','angle','angry','anime','apart','apple',
  'apply','arena','argue','arise','armor','array','aside','asset','attic','audio',
  'audit','avoid','awake','award','aware','awful','basic','basis','beach','began',
  'begin','being','below','bench','bible','birth','black','blade','blame','bland',
  'blank','blast','blaze','bleed','blend','bless','blind','block','blood','bloom',
  'blown','board','boost','bound','brace','brain','brand','brave','bread','break',
  'breed','brick','bride','brief','bring','brisk','broad','broke','brook','brown',
  'brush','buddy','build','built','burst','buyer','cabin','camel','candy','carry',
  'catch','cause','cease','chain','chair','chalk','chaos','cheap','check','cheek',
  'cheer','chess','chest','child','china','choir','chord','civil','claim','clash',
  'class','clean','clear','clerk','click','cliff','climb','cling','clock','clone',
  'close','cloud','coach','coast','color','comic','comma','coral','couch','could',
  'count','court','cover','craft','crash','crazy','cream','creek','crime','crisp',
  'cross','crowd','crown','crush','curve','cycle','daily','dance','datum','debut',
  'delay','delta','demon','dense','depot','depth','derby','devil','digit','dirty',
  'disco','dizzy','dodge','doing','doubt','dough','dowel','draft','drain','drama',
  'drank','dream','dress','drift','drink','drive','drone','drove','drown','drunk',
  'dryer','dying','eager','early','earth','eight','elite','email','empty','enemy',
  'enjoy','enter','equal','error','essay','event','every','exact','exist','extra',
  'fable','faced','faith','false','fancy','fault','feast','fence','feral','fetch',
  'fever','field','fifth','fifty','fight','filed','final','first','fixed','flame',
  'flash','flats','flesh','float','flood','floor','fluid','flute','focus','force',
  'forge','forth','forum','found','frame','frank','fraud','fresh','front','froze',
  'fruit','fully','funny','genre','ghost','given','gland','glass','glide','gloom',
  'gloss','glove','going','grace','grade','grain','grand','grant','graph','grasp',
  'grass','grave','great','green','greet','grief','grill','grind','groan','gross',
  'group','grove','grown','guard','guess','guest','guide','guild','guilt','guise',
  'gusto','habit','happy','harsh','haste','haven','heart','heavy','hedge','hello',
  'hence','herbs','hinge','honor','hoped','horse','hotel','house','human','humid',
  'hurry','hyper','ideal','image','imply','inbox','index','indie','inner','input',
  'irony','issue','ivory','jewel','joint','joker','judge','juice','juicy','keeps',
  'knife','knock','known','label','lance','large','laser','later','laugh','layer',
  'learn','lease','legal','level','light','limit','liner','lingo','links','liver',
  'logic','loose','lover','lower','lucky','lunar','lyric','magic','major','maker',
  'manor','maple','march','match','mayor','media','metal','model','money','month',
  'moral','motor','mount','mouse','mouth','moved','movie','music','naive','naval',
  'night','noble','north','noted','novel','nurse','nymph','occur','ocean','offer',
  'often','olive','onset','opera','orbit','order','other','ought','outer','owned',
  'oxide','ozone','paint','panel','paper','party','patch','pause','peace','penal',
  'penny','phase','phone','photo','piano','piece','pilot','pixel','pizza','place',
  'plain','plane','plant','plate','plaza','plead','pluck','plume','point','polar',
  'polka','popup','pound','power','press','price','pride','prime','print','prior',
  'prize','probe','prone','proof','prose','proud','prove','proxy','pulse','purse',
  'query','quest','queue','quick','quiet','quota','quote','radar','radio','raise',
  'rally','ranch','range','rapid','ratio','reach','react','ready','realm','rebel',
  'refer','reign','relax','repay','repel','reply','rerun','reset','rider','ridge',
  'rifle','right','rival','river','robot','rocky','roman','rouge','rough','round',
  'route','royal','rugby','ruler','rural','rusty','sadly','saint','salad','sauce',
  'scale','scene','scone','scope','score','scout','seize','sense','serve','setup',
  'seven','shade','shake','shall','shame','shape','share','sharp','sheer','sheet',
  'shift','shine','shirt','shore','short','shout','shove','sight','signs','since',
  'sixth','sixty','sized','skill','skull','skunk','slate','slave','sleep','slice',
  'slide','slime','slope','sloth','slump','small','smart','smell','smile','smoke',
  'snack','snake','solar','solid','solve','sorry','south','space','spare','spark',
  'speak','speed','spend','spill','spine','spite','split','spoke','spoon','sport',
  'spray','squad','stack','staff','stage','stain','stake','stand','stark','start',
  'state','stays','steel','steep','steer','stern','stick','stiff','still','stock',
  'stoic','stood','store','storm','story','stove','strap','straw','stray','strip',
  'stuck','study','style','sugar','suite','sunny','super','surge','swamp','swear',
  'sweet','swept','swift','sword','swore','sworn','table','taunt','teach','teeth',
  'tempo','tense','thank','theme','there','these','thick','thing','think','third',
  'those','three','threw','throw','tiger','tight','timer','tired','title','today',
  'token','topic','total','touch','tough','tower','toxic','trace','track','trade',
  'train','trait','tramp','trash','treat','trend','trial','trick','tried','troop',
  'truck','truly','trump','trunk','trust','truth','tumor','tuner','tying','ultra',
  'uncle','under','union','unity','until','upper','upset','urban','usage','usual',
  'utter','vague','valid','value','vapor','vault','verse','video','vigor','viral',
  'visit','vista','vital','vivid','vocal','voice','voter','vowed','wagon','waste',
  'watch','water','weary','weave','wedge','weird','whale','wheat','where','which',
  'while','white','whole','whose','witty','women','world','worry','worse','worst',
  'worth','would','wound','wrath','write','wrong','yacht','yield','young','yours',
  'youth','zebra','zesty',
];

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Enter','Z','X','C','V','B','N','M','⌫'],
];

function getRandomWord(exclude) {
  const pool = exclude ? WORDS.filter(w => w !== exclude.toLowerCase()) : WORDS;
  return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
}

function getTileState(guess, index, word) {
  const letter = guess[index];
  if (!letter) return '';
  if (word[index] === letter) return 'correct';
  if (word.includes(letter)) return 'present';
  return 'absent';
}

function getKeyState(letter, guesses, word) {
  let best = '';
  for (const guess of guesses) {
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] !== letter) continue;
      const state = getTileState(guess, i, word);
      if (state === 'correct') return 'correct';
      if (state === 'present') best = 'present';
      else if (!best) best = 'absent';
    }
  }
  return best;
}

function WordleGame({ onClose }) {
  const [word, setWord] = useState(() => getRandomWord());
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState('');

  const playAgain = () => {
    setWord(getRandomWord(word));
    setGuesses([]);
    setCurrentGuess('');
    setGameOver(false);
    setWon(false);
    setMessage('');
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };

  const submitGuess = useCallback(() => {
    if (currentGuess.length !== 5) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      showMessage('5 letters needed');
      return;
    }
    const newGuesses = [...guesses, currentGuess];
    setGuesses(newGuesses);
    setCurrentGuess('');
    if (currentGuess === word) {
      setWon(true);
      setGameOver(true);
    } else if (newGuesses.length >= 6) {
      setGameOver(true);
    }
  }, [currentGuess, guesses, word]);

  const handleKey = useCallback((key) => {
    if (gameOver) return;
    if (key === 'ENTER') { submitGuess(); return; }
    if (key === '⌫' || key === 'BACKSPACE') {
      setCurrentGuess(g => g.slice(0, -1));
      return;
    }
    if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(g => g + key);
    }
  }, [gameOver, currentGuess, submitGuess]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key.toUpperCase();
      handleKey(key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKey]);

  const rows = [...guesses];
  while (rows.length < 6) rows.push('');

  return (
    <div className="wordle-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wordle-panel">

        <div className="wordle-header">
          <div className="wordle-title">
            <span>🎮</span>
            <h2>Wordle</h2>
            <span className="wordle-badge">Unlimited</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="wordle-body">
          {message && <div className="wordle-message">{message}</div>}

          <div className="wordle-board">
            {rows.map((rowGuess, rowIdx) => {
              const isCurrentRow = rowIdx === guesses.length && !gameOver;
              const displayGuess = isCurrentRow ? currentGuess : rowGuess;
              const isSubmitted = rowIdx < guesses.length;
              const isShaking = isCurrentRow && shake;

              return (
                <div key={rowIdx} className={`wordle-row${isShaking ? ' wordle-row--shake' : ''}`}>
                  {Array.from({ length: 5 }).map((_, colIdx) => {
                    const letter = displayGuess[colIdx] || '';
                    const state = isSubmitted ? getTileState(rowGuess, colIdx, word) : '';
                    const filled = !isSubmitted && letter !== '';
                    return (
                      <div
                        key={colIdx}
                        className={[
                          'wordle-tile',
                          state ? `wordle-tile--${state}` : '',
                          filled ? 'wordle-tile--filled' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {gameOver && (
            <div className={`wordle-result ${won ? 'wordle-result--won' : 'wordle-result--lost'}`}>
              <span>{won ? `You got it in ${guesses.length}! 🎉` : `The word was ${word}`}</span>
              <button className="wordle-play-again" onClick={playAgain}>Play Again</button>
            </div>
          )}

          <div className="wordle-keyboard">
            {KEYBOARD_ROWS.map((row, ri) => (
              <div key={ri} className="wordle-key-row">
                {row.map(k => {
                  const keyState = k.length === 1 ? getKeyState(k, guesses, word) : '';
                  return (
                    <button
                      key={k}
                      className={[
                        'wordle-key',
                        k.length > 1 ? 'wordle-key--wide' : '',
                        keyState ? `wordle-key--${keyState}` : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleKey(k === 'Enter' ? 'ENTER' : k)}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="wordle-hint">Random word each game · play as many as you like</p>
        </div>
      </div>
    </div>
  );
}

export default WordleGame;
>>>>>>> Stashed changes
