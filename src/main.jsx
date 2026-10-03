import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const KEY = 'multiply:v1';
const makeId = () => Math.random().toString(36).slice(2, 9);
const defaultData = { players: [{ id: 'ethan', name: 'Ethan', maxTable: 15, maxMultiplier: 15, createdAt: Date.now() }, { id: 'josiah', name: 'Josiah', maxTable: 10, maxMultiplier: 10, createdAt: Date.now() }, { id: 'joseph', name: 'Joseph', maxTable: 5, maxMultiplier: 5, createdAt: Date.now() }], stats: {}, sessions: [] };
const load = () => { try { return { ...defaultData, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaultData; } };
const keyFor = (table, multiplier) => `${table}x${multiplier}`;
const shuffle = a => [...a].sort(() => Math.random() - .5);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const recentAccuracy = stat => stat?.recent?.length ? pct(stat.recent.filter(Boolean).length, stat.recent.length) : 0;

function App() {
  const [data, setData] = useState(load);
  const [screen, setScreen] = useState('players');
  const [playerId, setPlayerId] = useState(null);
  const [mode, setMode] = useState('practice');
  const [table, setTable] = useState(1);
  const [max, setMax] = useState(1);
  const [answerMode, setAnswerMode] = useState('choice');
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [input, setInput] = useState('');
  const [endPending, setEndPending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const player = data.players.find(p => p.id === playerId);
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(data)), [data]);
  useEffect(() => {
    if (screen !== 'play' || mode !== 'practice' || !timed || secondsLeft === null) return;
    if (secondsLeft <= 0) { setEndPending(true); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000); return () => clearTimeout(t);
  }, [screen, mode, timed, secondsLeft]);
  const choosePlayer = id => { const p = data.players.find(x => x.id === id); setPlayerId(id); setTable(1); setMax(p.maxMultiplier); setScreen('activity'); };
  const start = () => {
    const facts = shuffle(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 })));
    setQuestions(facts); setIndex(0); setResults([]); setFeedback(null); setInput(''); setEndPending(false); setSecondsLeft(mode === 'practice' && timed ? minutes * 60 : null); setScreen('play');
  };
  const saveSession = finalResults => {
    const correct = finalResults.filter(r => r.correct).length;
    const attempts = finalResults.length;
    const score = mode === 'challenge' && attempts ? Math.round(correct / questions.length * (answerMode === 'type' ? 125 : 100)) : null;
    setData(old => {
      const stats = { ...old.stats };
      finalResults.forEach(r => {
        const k = `${playerId}:${keyFor(r.table, r.multiplier)}`; const current = stats[k] || { attempts: 0, correct: 0, recent: [] };
        stats[k] = { attempts: current.attempts + 1, correct: current.correct + (r.correct ? 1 : 0), recent: [...current.recent, r.correct].slice(-10) };
      });
      return { ...old, stats, sessions: [...old.sessions, { id: makeId(), playerId, mode, answerMode, table, maxMultiplier: max, correct, attempts, percentage: pct(correct, attempts), score, date: Date.now(), results: finalResults.map(r => ({ key: keyFor(r.table, r.multiplier), correct: r.correct })) }].slice(-200) };
    });
    setScreen('results');
  };
  const answer = value => {
    if (feedback) return;
    const q = questions[index]; if (!q) return;
    const correct = Number(value) === q.table * q.multiplier;
    const next = [...results, { ...q, correct }]; setResults(next); setFeedback({ correct, answer: q.table * q.multiplier });
    setTimeout(() => {
      setFeedback(null); setInput('');
      if (endPending || mode === 'challenge' && index + 1 >= questions.length) saveSession(next);
      else if (mode === 'practice' && index + 1 >= questions.length) setQuestions(shuffle(Array.from({ length: max }, (_, i) => ({ table, multiplier: i + 1 }))));
      setIndex(i => (mode === 'practice' && i + 1 >= questions.length ? 0 : i + 1));
    }, 950);
  };
  const leavePractice = () => { if (results.length) saveSession(results); else setScreen('activity'); };
  const options = q => { const correct=q.table*q.multiplier, values=new Set([correct]); for(let step=1;values.size<4;step++) { values.add(Math.max(0,correct-step)); values.add(correct+step); } return shuffle([...values]); };
  const factSummary = useMemo(() => player ? Array.from({length: player.maxTable * player.maxMultiplier}, (_, i) => { const t = Math.floor(i/player.maxMultiplier)+1, m=i%player.maxMultiplier+1; return data.stats[`${playerId}:${t}x${m}`]; }) : [], [player, data.stats, playerId]);
  if (screen === 'players') return <Players data={data} choose={choosePlayer} setData={setData} leaderboard={() => setScreen('leaderboard')} />;
  if (screen === 'leaderboard') return <Leaderboard data={data} back={() => setScreen('players')} />;
  if (screen === 'activity') return <Shell player={player} back={() => setScreen('players')}><h1>What do you want to do?</h1><div className="choice-grid"><button className="big-card pink" onClick={()=>{setMode('practice');setScreen('table')}}><span>🌱</span><b>Practice</b><small>Learn without score</small></button><button className="big-card purple" onClick={()=>{setMode('challenge');setScreen('table')}}><span>🏆</span><b>Challenge</b><small>Try for your best score</small></button></div><Progress player={player} stats={factSummary}/></Shell>;
  if (screen === 'table') return <Shell player={player} back={() => setScreen('activity')}><h1>Pick a table</h1><p className="sub">Choose what you want to practice.</p><div className="tables">{Array.from({length: player.maxTable},(_,i)=><button key={i} onClick={()=>{setTable(i+1);setMax(player.maxMultiplier);setScreen('range')}}>{i+1}{tableMastered(data.stats,playerId,i+1,player.maxMultiplier) && <em>✓</em>}</button>)}</div></Shell>;
  if (screen === 'range') return <Shell player={player} back={()=>setScreen('table')}><h1>Up to what number?</h1><div className="range-card"><div className="equation">{table} × 1 <span>→</span> {table} × {max}</div><input aria-label="Maximum multiplier" type="range" min="1" max={player.maxMultiplier} value={max} onChange={e=>setMax(+e.target.value)}/><strong>{max}</strong></div><button className="primary" onClick={()=>setScreen('answer')}>Next</button></Shell>;
  if (screen === 'answer') return <Shell player={player} back={()=>setScreen('range')}><h1>How do you want to answer?</h1><div className="stack"><button className={`select ${answerMode==='choice'?'active':''}`} onClick={()=>setAnswerMode('choice')}>🔘 <b>Pick an answer</b><small>See four choices</small></button><button className={`select ${answerMode==='type'?'active':''}`} onClick={()=>setAnswerMode('type')}>⌨️ <b>Type the answer</b><small>{mode === 'challenge' ? 'Worth 25% more points' : 'Answer it yourself'}</small></button></div>{mode==='practice' ? <button className="primary" onClick={()=>setScreen('length')}>Next</button> : <button className="primary" onClick={start}>Start challenge</button>}</Shell>;
  if (screen === 'length') return <Shell player={player} back={()=>setScreen('answer')}><h1>How long?</h1><div className="stack"><button className={`select ${!timed?'active':''}`} onClick={()=>setTimed(false)}>∞ <b>Keep going</b><small>Practice until you end it</small></button><button className={`select ${timed?'active':''}`} onClick={()=>setTimed(true)}>⏱️ <b>Timed practice</b><small>Set a gentle timer</small></button></div>{timed && <div className="mini-range"><label>{minutes} minute{minutes>1?'s':''}</label><input type="range" min="1" max="10" value={minutes} onChange={e=>setMinutes(+e.target.value)}/></div>}<button className="primary" onClick={start}>Start practice</button></Shell>;
  if (screen === 'play') { const q=questions[index]; if(!q) return null; const choices=options(q); return <Shell player={player} back={leavePractice}><div className="play-head"><span>{mode==='challenge' ? `${index+1} of ${questions.length}` : 'Practice time'} </span>{secondsLeft!==null && <span>⏱ {Math.ceil(secondsLeft/60)} min</span>}</div><main className="question"><div>{q.table} <span>×</span> {q.multiplier}</div><p>What is the answer?</p>{answerMode==='choice'?<div className="answers">{choices.map((x,i)=><button key={i} onClick={()=>answer(x)}>{x}</button>)}</div>:<form onSubmit={e=>{e.preventDefault();if(input)answer(input)}}><input className="type" inputMode="numeric" autoFocus value={input} onChange={e=>setInput(e.target.value.replace(/\D/g,''))}/><button className="primary">Check answer</button></form>}</main>{mode==='practice'&&<button className="text-button" onClick={leavePractice}>End practice</button>}{feedback&&<div className={`feedback ${feedback.correct?'good':'try'}`}>{feedback.correct?'✓ Nice!':'Not quite'}<small>{q.table} × {q.multiplier} = {feedback.answer}</small></div>}</Shell>; }
  if (screen === 'results') return <Results player={player} results={results} data={data} playerId={playerId} mode={mode} max={max} answerMode={answerMode} again={()=>setScreen('table')} home={()=>setScreen('activity')} />;
  return <Shell player={player}><button onClick={()=>setScreen('players')}>Home</button></Shell>;
}

function Shell({player, back, children}) { return <div className="app"><header>{back?<button className="back" onClick={back}>‹</button>:<span/>}<div className="brand">multiply<span>!</span></div>{player?<div className="avatar">{player.name[0]}</div>:<span/>}</header><section className="content">{children}</section></div>; }
function Players({data,choose,setData,leaderboard}) { const [edit,setEdit]=useState(null); const [name,setName]=useState(''); const submit=e=>{e.preventDefault();if(!name.trim())return; const p={id:makeId(),name:name.trim(),maxTable:5,maxMultiplier:5,createdAt:Date.now()};setData(d=>({...d,players:[...d.players,p]}));setName('');}; return <div className="app"><header><span/><div className="brand">multiply<span>!</span></div><button className="cup" onClick={leaderboard}>🏆</button></header><section className="content"><h1>Who&apos;s playing?</h1><p className="sub">Pick your name to get started.</p><div className="players">{data.players.map((p,i)=><div className="player-row" key={p.id}><button className={`player p${i%4}`} onClick={()=>choose(p.id)}><span>{p.name[0]}</span><b>{p.name}</b><small>Up to {p.maxTable} × {p.maxMultiplier}</small></button><button className="gear" onClick={()=>setEdit(p)}>⚙</button></div>)}</div><form className="add" onSubmit={submit}><input placeholder="Add a player" value={name} onChange={e=>setName(e.target.value)}/><button>+</button></form></section>{edit&&<Edit player={edit} close={()=>setEdit(null)} setData={setData}/>}</div> }
function Edit({player,close,setData}) { const [name,setName]=useState(player.name),[maxTable,setT]=useState(player.maxTable),[maxMultiplier,setM]=useState(player.maxMultiplier); return <div className="modal"><form onSubmit={e=>{e.preventDefault();setData(d=>({...d,players:d.players.map(p=>p.id===player.id?{...p,name,maxTable,maxMultiplier}:p)}));close();}}><h2>Edit player</h2><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Max table <b>{maxTable}</b><input type="range" min="1" max="15" value={maxTable} onChange={e=>setT(+e.target.value)}/></label><label>Max multiplier <b>{maxMultiplier}</b><input type="range" min="1" max="15" value={maxMultiplier} onChange={e=>setM(+e.target.value)}/></label><button className="primary">Save changes</button><button type="button" className="text-button" onClick={close}>Cancel</button></form></div> }
function Progress({player,stats}) { const tracked=stats.filter(Boolean), attempts=tracked.reduce((a,s)=>a+s.attempts,0), correct=tracked.reduce((a,s)=>a+s.correct,0), mastered=stats.filter(s=>s?.recent?.length>=5&&recentAccuracy(s)>=80).length; return <div className="progress"><h2>Your progress</h2><b>Overall accuracy: {pct(correct,attempts)}%</b><p>Mastered: {mastered} / {player.maxTable*player.maxMultiplier} facts</p><p>Needs work: {player.maxTable*player.maxMultiplier-mastered}</p></div> }
function Results({player,results,data,playerId,mode,max,answerMode,again,home}) { const correct=results.filter(r=>r.correct).length, grouped=Object.values(results.reduce((a,r)=>{const k=keyFor(r.table,r.multiplier);(a[k]??=[]).push(r);return a},{})).map(x=>({...x[0], accuracy:pct(x.filter(q=>q.correct).length,x.length)})).sort((a,b)=>a.accuracy-b.accuracy); const weak=grouped.filter(x=>x.accuracy<80).slice(0,3); const score=mode==='challenge'?Math.round(correct/max*(answerMode==='type'?125:100)):null; return <Shell player={player}><div className="results"><div className="celebrate">{correct/results.length>=.8?'🌟':'💪'}</div><h1>{mode==='challenge'?'Challenge complete!':'Nice work!'}</h1>{score!==null&&<div className="score">{score}<small>points</small></div>}<b>{pct(correct,results.length)}% correct</b><p>{correct} correct / {results.length} answered</p>{weak.length>0&&<div className="results-card"><h2>Needs more practice</h2>{weak.map(x=><p key={keyFor(x.table,x.multiplier)}><b>{x.table} × {x.multiplier}</b><span>{x.accuracy}%</span></p>)}</div>}<button className="primary" onClick={again}>Try another table</button><button className="text-button" onClick={home}>Back to {player.name}</button></div></Shell> }
function Leaderboard({data, back}) {
  const rows = data.players.map(player => {
    const challenges = data.sessions.filter(s => s.playerId === player.id && s.mode === 'challenge' && typeof s.score === 'number');
    const best = challenges.length ? Math.max(...challenges.map(s => s.score)) : null;
    const all = data.sessions.filter(s => s.playerId === player.id).sort((a,b) => b.date-a.date);
    const avg = list => list.length ? Math.round(list.reduce((sum,s)=>sum+s.percentage,0)/list.length) : null;
    const recent = avg(all.slice(0,5)), earlier = avg(all.slice(5,10));
    return { player, best, improvement: recent !== null && earlier !== null ? recent-earlier : null };
  }).sort((a,b)=>(b.best??-1)-(a.best??-1));
  return <div className="app"><header><button className="back" onClick={back}>‹</button><div className="brand">multiply<span>!</span></div><span/></header><section className="content"><h1>Family high scores</h1><p className="sub">Everyone can be a champion.</p><div className="leader-card"><h2>🏆 Personal best</h2>{rows.map((r,i)=><div className="leader-row" key={r.player.id}><span className="rank">{i+1}</span><span className={`leader-dot p${i%4}`}>{r.player.name[0]}</span><b>{r.player.name}</b><strong>{r.best === null ? '—' : r.best}</strong></div>)}</div><div className="leader-card"><h2>🌱 Improvement</h2><p className="leader-note">Getting better is a win, too.</p>{rows.map((r,i)=><div className="leader-row" key={r.player.id}><span className={`leader-dot p${i%4}`}>{r.player.name[0]}</span><b>{r.player.name}</b><strong className={r.improvement>0?'up':''}>{r.improvement === null ? 'Keep playing!' : `${r.improvement>=0?'↑ +':'↓ '}${r.improvement}%`}</strong></div>)}</div></section></div>
}
function tableMastered(stats,id,t,max) { const facts=Array.from({length:max},(_,i)=>stats[`${id}:${t}x${i+1}`]); return facts.every(s=>s?.recent?.length>=5&&recentAccuracy(s)>=80); }
createRoot(document.getElementById('root')).render(<App/>);
