import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'https://liferpg-backend.onrender.com'

function App() {
  const [profile, setProfile] = useState(null)
  const [xpToNext, setXpToNext] = useState(100)
  const [quests, setQuests] = useState([])
  const [rewards, setRewards] = useState([])
  const [logs, setLogs] = useState([])
  const [chartData, setChartData] = useState(null)
  const [dbCategories, setDbCategories] = useState([])
  
  const [activeTab, setActiveTab] = useState('play')
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [showCatLevelUpModal, setShowCatLevelUpModal] = useState(false)
  const [newCatLevelData, setNewCatLevelData] = useState({ name: '', level: 1 })
  const [rank, setRank] = useState('⚔️ Новичок')

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newXp, setNewXp] = useState(15)
  const [newGold, setNewGold] = useState(15)
  const [newCategory, setNewCategory] = useState('')
  const [newRequiresId, setNewRequiresId] = useState('')
  const [newIsDaily, setNewIsDaily] = useState(false)
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardCost, setNewRewardCost] = useState(30)
  const [newCategoryInput, setNewCategoryInput] = useState('')

  const checkAndResetDailies = async (currentQuests) => {
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('matrixDailyReset');
    
    if (lastReset !== today) {
      const completedDailies = currentQuests.filter(q => 
        q.completed && (q.is_daily || q.title.toLowerCase().includes('дейлик'))
      );
      
      if (completedDailies.length > 0) {
        for (const quest of completedDailies) {
          await axios.delete(`${API_URL}/delete_quest/${quest.id}`);
          await axios.post(`${API_URL}/add_quest`, {
            title: quest.title, description: quest.description || "",
            xp: Number(quest.xp), gold: Number(quest.gold),
            category: quest.category || "✨ Разное", requires_id: quest.requires_id || "", is_daily: true
          });
        }
        localStorage.setItem('matrixDailyReset', today);
        fetchData();
      } else {
        localStorage.setItem('matrixDailyReset', today);
      }
    }
  };

  const playRetroSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(350, ctx.currentTime); osc.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'coin') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.setValueAtTime(950, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'levelup') {
        osc.type = 'square'; const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5];
        notes.forEach((f, i) => { osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.07); });
        gain.gain.setValueAtTime(0.05, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) { console.log("Audio API init skipped") }
  }

  const fetchData = async () => {
    try {
      const [profRes, questRes, catRes, rewRes, logsRes, chartRes] = await Promise.allSettled([
        axios.get(`${API_URL}/profile`),
        axios.get(`${API_URL}/quests`),
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/rewards`),
        axios.get(`${API_URL}/logs`),
        axios.get(`${API_URL}/analytics/categories`)
      ]);

      if (profRes.status === 'fulfilled') {
        const pData = profRes.value.data.profile || profRes.value.data;
        setProfile({ ...pData, category_levels: profRes.value.data.category_levels });
        setXpToNext(profRes.value.data.xp_to_next_level || pData.level * 100);
        setRank(pData.rank || '⚔️ Новичок');
      }

      if (catRes.status === 'fulfilled') {
        const loadedCats = catRes.value.data.categories || [];
        setDbCategories(loadedCats);
        if (!newCategory && loadedCats.length > 0) setNewCategory(loadedCats[0].name);
      }

      if (questRes.status === 'fulfilled') {
        const qData = questRes.value.data.quests || [];
        setQuests(qData);
        checkAndResetDailies(qData);
      }

      if (rewRes.status === 'fulfilled') setRewards(rewRes.value.data.rewards || []);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data.logs || []);
      if (chartRes.status === 'fulfilled') setChartData(chartRes.value.data);

    } catch (error) { console.error("Sync error:", error) }
  }

  useEffect(() => { fetchData() }, [])

  const completeQuest = async (quest) => {
    const res = await axios.post(`${API_URL}/complete_quest`, { quest_id: quest.id });
    
    if (res.data.level_up) {
      playRetroSound('levelup');
      setShowLevelUpModal(true);
    } else if (res.data.cat_level_up) {
      playRetroSound('levelup');
      const currentCatLevel = profile?.category_levels?.[quest.category]?.level || 1;
      setNewCatLevelData({ name: quest.category, level: currentCatLevel + 1 });
      setShowCatLevelUpModal(true);
    } else {
      playRetroSound('click');
    }
    fetchData();
  }

  const buyReward = async (id) => {
    const res = await axios.post(`${API_URL}/buy_reward`, { reward_id: id });
    if (res.data.status === "success") { playRetroSound('coin'); fetchData(); }
  }

  const handleAddQuest = async (e) => {
    e.preventDefault(); if (!newTitle) return;
    const finalCategory = newCategory || (dbCategories.length > 0 ? dbCategories[0].name : "✨ Разное");
    await axios.post(`${API_URL}/add_quest`, {
      title: newTitle, description: newDesc, xp: Number(newXp), gold: Number(newGold), 
      category: finalCategory, requires_id: newRequiresId, is_daily: newIsDaily
    });
    setNewTitle(''); setNewDesc(''); setNewRequiresId(''); setNewIsDaily(false);
    fetchData(); setActiveTab('play');
  }

  const handleAddReward = async (e) => {
    e.preventDefault(); if (!newRewardTitle) return;
    await axios.post(`${API_URL}/add_reward`, { title: newRewardTitle, cost: Number(newRewardCost) });
    setNewRewardTitle(''); fetchData(); setActiveTab('shop');
  }

  const handleAddCategory = async (e) => {
    e.preventDefault(); if (!newCategoryInput) return;
    await axios.post(`${API_URL}/add_category`, { name: newCategoryInput });
    setNewCategoryInput(''); fetchData();
  }

  const handleDeleteQuest = async (id) => { await axios.delete(`${API_URL}/delete_quest/${id}`); fetchData(); }
  const handleDeleteReward = async (id) => { await axios.delete(`${API_URL}/delete_reward/${id}`); fetchData(); }
  const handleDeleteCategory = async (id) => { await axios.delete(`${API_URL}/delete_category/${id}`); fetchData(); }

  useEffect(() => {
    if (activeTab === 'analytics' && chartData?.labels?.length > 0) {
      const ctx = document.getElementById('analyticsChart')?.getContext('2d');
      if (!ctx) return;
      if (window.currentLiferpgChart) window.currentLiferpgChart.destroy();
      
      window.currentLiferpgChart = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartData.labels,
          datasets: [{
            data: chartData.xp_distribution,
            backgroundColor: ['#2dd4bf', '#a78bfa', '#fb923c', '#f43f5e', '#38bdf8', '#a3e635'],
            borderWidth: 0, hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '82%',
          plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', padding: 25, usePointStyle: true, font: { size: 12, family: 'system-ui' } } } }
        }
      });
    }
  }, [activeTab, chartData]);

  if (!profile) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-teal-400/50 font-mono tracking-[0.3em] text-xs animate-pulse">
      ПОДКЛЮЧЕНИЕ К НЕЙРОСЕТИ...
    </div>
  )

  const progressPercent = Math.min((profile.current_xp / xpToNext) * 100, 100)
  
  const getSortedQuests = (catName) => {
    return quests.filter(q => (q.category || '✨ Разное') === catName).sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    });
  };

  const activeQuestCategories = [...new Set(quests.map(q => q.category || '✨ Разное'))];

  return (
    <div className="relative min-h-screen bg-[#040914] text-slate-200 flex flex-col items-center py-8 px-4 font-sans pb-28 overflow-x-hidden selection:bg-teal-500/30">
      
      {/* МЯГКИЕ ФОНОВЫЕ СВЕЧЕНИЯ (GLASSMORPHISM BLOBS) */}
      <div className="fixed top-[-10%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-teal-600/10 blur-[120px] pointer-events-none mix-blend-screen"></div>
      <div className="fixed bottom-[-10%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none mix-blend-screen"></div>
      <div className="fixed top-[40%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-amber-600/5 blur-[100px] pointer-events-none mix-blend-screen"></div>

      {/* МОДАЛКА GLOBAL LEVEL UP */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4 transition-all duration-500">
          <div className="bg-white/10 border border-white/20 rounded-[2rem] p-10 max-w-sm w-full text-center shadow-[0_0_80px_rgba(45,212,191,0.2)] backdrop-blur-2xl">
            <div className="text-7xl mb-6 drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]">✨</div>
            <h2 className="text-3xl font-light text-white mb-2 tracking-wide">Новая Ступень</h2>
            <p className="text-slate-300 font-light mb-8">Матрица признала ваши заслуги. Достигнут <span className="text-teal-400 font-semibold">{profile.level} уровень</span>.</p>
            <button onClick={() => setShowLevelUpModal(false)} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-4 rounded-2xl text-sm font-medium tracking-wider transition-all shadow-lg backdrop-blur-md">Продолжить Путь</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА CATEGORY LEVEL UP */}
      {showCatLevelUpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4 transition-all duration-500">
          <div className="bg-white/10 border border-white/20 rounded-[2rem] p-10 max-w-sm w-full text-center shadow-[0_0_80px_rgba(167,139,250,0.2)] backdrop-blur-2xl">
            <div className="text-7xl mb-6 drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]">🔮</div>
            <h2 className="text-3xl font-light text-white mb-2 tracking-wide">Ветвь Развита</h2>
            <p className="text-slate-300 font-light mb-8">Направление <span className="text-purple-400 font-semibold">{newCatLevelData.name}</span> достигло {newCatLevelData.level} уровня!</p>
            <button onClick={() => setShowCatLevelUpModal(false)} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-4 rounded-2xl text-sm font-medium tracking-wider transition-all shadow-lg backdrop-blur-md">Принять Силу</button>
          </div>
        </div>
      )}

      {/* НАВИГАЦИЯ GLASSMORPHISM */}
      <div className="w-full max-w-md bg-white/5 p-1.5 rounded-2xl border border-white/10 flex gap-1 mb-8 backdrop-blur-2xl sticky top-4 z-40 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
        <button onClick={() => setActiveTab('play')} className={`flex-1 py-3 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 ${activeTab === 'play' ? 'bg-white/15 text-white shadow-lg border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>Квесты</button>
        <button onClick={() => setActiveTab('shop')} className={`flex-1 py-3 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 ${activeTab === 'shop' ? 'bg-white/15 text-white shadow-lg border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>Магазин</button>
        <button onClick={() => setActiveTab('forge')} className={`flex-1 py-3 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 ${activeTab === 'forge' ? 'bg-white/15 text-white shadow-lg border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>Кузница</button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-3 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 ${activeTab === 'analytics' ? 'bg-white/15 text-white shadow-lg border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>Аналитика</button>
      </div>

      {/* === ВКЛАДКА 1: PLAY === */}
      {activeTab === 'play' && (
        <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* ПРОФИЛЬ КАРТОЧКА СТЕКЛО */}
          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl group-hover:bg-teal-400/30 transition-all duration-1000"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex-1">
                <h1 className="text-3xl font-light text-white tracking-tight mb-1">{profile.name}</h1>
                <p className="text-xs text-teal-400 font-medium tracking-widest uppercase mb-6">{rank} • {profile.level} УРОВЕНЬ</p>
                <div className="mb-2 flex justify-between text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                  <span>Прогресс</span>
                  <span>{profile.current_xp} / {xpToNext}</span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-1.5 border border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-emerald-300 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(45,212,191,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
              <div className="ml-5 bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-center backdrop-blur-md shadow-inner flex flex-col items-center justify-center min-w-[80px]">
                <span className="block text-[9px] font-semibold text-slate-400 tracking-widest mb-1.5 uppercase">Золото</span>
                <span className="text-2xl font-light text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.4)]">{profile.gold}</span>
              </div>
            </div>
          </div>

          {/* СПИСОК ПУТЕЙ */}
          <div className="space-y-8">
            {activeQuestCategories.map(category => {
              const catData = profile.category_levels?.[category] || { level: 1, percent: 0, is_maxed: false };
              
              return (
                <div key={category} className="space-y-4">
                  {/* Заголовок Категории */}
                  <div className="flex items-end justify-between px-2">
                    <div>
                      <h2 className="text-base font-medium text-white tracking-wide">{category}</h2>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{catData.is_maxed ? 'Максимальный уровень' : `Ступень ${catData.level}`}</p>
                    </div>
                    {!catData.is_maxed && (
                      <div className="w-24 text-right">
                         <span className="text-[9px] text-slate-400 font-medium mb-1.5 inline-block tracking-widest">{catData.percent}%</span>
                         <div className="w-full bg-black/30 border border-white/5 rounded-full h-1 overflow-hidden">
                           <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]" style={{ width: `${catData.percent}%` }}></div>
                         </div>
                      </div>
                    )}
                  </div>

                  {/* Карточки Квестов */}
                  <div className="space-y-3">
                    {getSortedQuests(category).map((quest) => {
                      const parentQuest = quest.requires_id ? quests.find(q => q.id === quest.requires_id) : null;
                      const isLocked = quest.requires_id && (!parentQuest || !parentQuest.completed);
                      
                      return (
                        <div key={quest.id} className={`p-4.5 rounded-[1.25rem] flex justify-between items-center transition-all duration-500 backdrop-blur-md ${quest.completed ? 'bg-white/5 border border-transparent opacity-40 grayscale' : isLocked ? 'bg-black/20 border border-white/5 opacity-60' : 'bg-white/10 border border-white/10 hover:bg-white/15 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]'}`}>
                          <div className="pr-4 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {isLocked && <span className="text-[9px] text-slate-300 bg-black/40 border border-white/10 px-2.5 py-1 rounded-full font-medium tracking-wide">🔒 Ожидает: {parentQuest?.title || '...'}</span>}
                              {quest.is_daily && <span className="text-[9px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium tracking-wide">Ежедневно</span>}
                            </div>
                            <h3 className={`text-sm font-normal leading-snug tracking-wide ${quest.completed ? 'text-slate-500 line-through' : isLocked ? 'text-slate-400' : 'text-slate-100'}`}>{quest.title}</h3>
                            {quest.description && <p className="text-[11px] text-slate-400/80 mt-1.5 line-clamp-2 font-light">{quest.description}</p>}
                          </div>
                          
                          <div className="flex flex-col items-end justify-center gap-2.5 min-w-[75px]">
                            {!quest.completed && (
                              <div className="text-[10px] font-medium flex gap-2 tracking-wide">
                                <span className={isLocked ? 'text-slate-600' : 'text-teal-300/80'}>{quest.xp} XP</span>
                                <span className={isLocked ? 'text-slate-600' : 'text-amber-300/80'}>{quest.gold} G</span>
                              </div>
                            )}
                            <button onClick={() => completeQuest(quest)} disabled={quest.completed || isLocked} className={`w-full py-2.5 rounded-xl text-[10px] font-medium tracking-widest uppercase transition-all duration-300 ${quest.completed ? 'bg-transparent text-slate-600' : isLocked ? 'bg-black/30 text-slate-600 border border-white/5' : 'bg-white/10 text-white hover:bg-white border border-white/20 hover:text-black shadow-lg backdrop-blur-sm'}`}>
                              {quest.completed ? 'Сдано' : isLocked ? 'Закрыто' : 'Зачет'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {quests.length === 0 && <div className="text-center text-slate-500 text-xs py-20 font-light tracking-widest uppercase">Нет активных задач</div>}
          </div>
        </div>
      )}

      {/* === ВКЛАДКА 2: МАГАЗИН === */}
      {activeTab === 'shop' && (
        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <p className="text-[10px] text-amber-300/60 font-medium mb-3 uppercase tracking-[0.2em]">Доступные средства</p>
            <h2 className="text-5xl font-light text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.3)]">{profile.gold}</h2>
          </div>
          <div className="space-y-3">
            {rewards.map(reward => (
              <div key={reward.id} className="p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex justify-between items-center hover:bg-white/10 transition-all duration-300 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]">
                <div>
                  <h3 className="font-light text-base text-slate-100 tracking-wide">{reward.title}</h3>
                  <p className="text-xs text-amber-300/80 font-medium mt-1.5 tracking-wide">{reward.cost} G</p>
                </div>
                <button onClick={() => buyReward(reward.id)} disabled={profile.gold < reward.cost} className={`px-6 py-3 rounded-xl text-[10px] font-medium tracking-widest uppercase transition-all duration-300 ${profile.gold >= reward.cost ? 'bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'bg-black/30 text-slate-600 border border-white/5'}`}>Приобрести</button>
              </div>
            ))}
            {rewards.length === 0 && <div className="text-center text-slate-500 text-xs py-20 font-light tracking-widest uppercase">Витрина пуста</div>}
          </div>
        </div>
      )}

      {/* === ВКЛАДКА 3: КУЗНИЦА === */}
      {activeTab === 'forge' && (
        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* СОЗДАНИЕ КВЕСТА */}
          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <h3 className="text-sm font-light text-white mb-6 tracking-wide">Новая инициатива</h3>
            <form onSubmit={handleAddQuest}>
              <div className="space-y-4 mb-6">
                <input type="text" placeholder="Название..." required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-black/20 text-slate-200 rounded-xl px-5 py-4 border border-white/10 text-sm focus:border-white/30 focus:bg-black/40 outline-none transition-all placeholder:text-slate-600 font-light" />
                <textarea placeholder="Детали или шаги (опционально)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-black/20 text-slate-300 rounded-xl px-5 py-4 border border-white/10 text-xs min-h-[90px] focus:border-white/30 focus:bg-black/40 outline-none transition-all resize-none placeholder:text-slate-600 font-light leading-relaxed" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="col-span-2">
                  <label className="block text-[10px] text-slate-500 mb-2 ml-1 uppercase tracking-widest">Категория</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-black/20 text-slate-300 rounded-xl px-4 py-3.5 border border-white/10 text-sm focus:border-white/30 outline-none appearance-none font-light">
                    {dbCategories.map(c => <option key={c.id} value={c.name} className="bg-slate-900">{c.name}</option>)}
                    {dbCategories.length === 0 && <option value="✨ Разное" className="bg-slate-900">✨ Разное</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-2 ml-1 uppercase tracking-widest">Опыт (XP)</label>
                  <input type="number" required min="1" value={newXp} onChange={(e) => setNewXp(e.target.value)} className="w-full bg-black/20 text-teal-300 rounded-xl px-4 py-3.5 border border-white/10 text-sm focus:border-white/30 outline-none font-light" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-2 ml-1 uppercase tracking-widest">Золото</label>
                  <input type="number" required min="1" value={newGold} onChange={(e) => setNewGold(e.target.value)} className="w-full bg-black/20 text-amber-300 rounded-xl px-4 py-3.5 border border-white/10 text-sm focus:border-white/30 outline-none font-light" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[10px] text-slate-500 mb-2 ml-1 uppercase tracking-widest">Цепочка (Блокировка)</label>
                <select value={newRequiresId} onChange={(e) => setNewRequiresId(e.target.value)} className="w-full bg-black/20 text-slate-400 rounded-xl px-4 py-3.5 border border-white/10 text-xs focus:border-white/30 outline-none appearance-none font-light">
                  <option value="" className="bg-slate-900">Без зависимости</option>
                  {quests.map(q => <option key={q.id} value={q.id} className="bg-slate-900">Ждать: {q.title}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-3 mb-8 p-4 rounded-xl bg-black/20 border border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
                <input type="checkbox" checked={newIsDaily} onChange={(e) => setNewIsDaily(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-black/50 text-teal-500 focus:ring-0 focus:ring-offset-0" />
                <span className="text-xs text-slate-300 font-light tracking-wide">Ежедневный респаун (Дейлик)</span>
              </label>

              <button type="submit" className="w-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-xs font-medium tracking-widest uppercase py-4 rounded-xl transition-all duration-300 shadow-lg backdrop-blur-sm">Создать</button>
            </form>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <h3 className="text-sm font-light text-white mb-5 tracking-wide">Конфигурация Базы</h3>
            <form onSubmit={handleAddCategory} className="flex gap-3 mb-5">
              <input type="text" placeholder="Новый Путь..." required value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="flex-1 bg-black/20 text-slate-200 rounded-xl px-5 py-3.5 border border-white/10 text-xs focus:border-white/30 outline-none placeholder:text-slate-600 font-light" />
              <button type="submit" className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 rounded-xl text-sm font-light transition-colors">+</button>
            </form>
            <form onSubmit={handleAddReward} className="flex gap-3">
              <input type="text" placeholder="Новая награда..." required value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} className="flex-1 bg-black/20 text-slate-200 rounded-xl px-5 py-3.5 border border-white/10 text-xs focus:border-white/30 outline-none placeholder:text-slate-600 font-light" />
              <input type="number" placeholder="Цена" required min="1" value={newRewardCost} onChange={(e) => setNewRewardCost(e.target.value)} className="w-24 bg-black/20 text-amber-300 rounded-xl px-4 py-3.5 border border-white/10 text-xs text-center outline-none font-light" />
              <button type="submit" className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 rounded-xl text-sm font-light transition-colors">+</button>
            </form>
          </div>

          {/* УПРАВЛЕНИЕ ДАННЫМИ (СТЕКЛЯННЫЕ АККОРДЕОНЫ) */}
          <div className="space-y-3">
            <details className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden group">
              <summary className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:text-white group-open:bg-white/5 transition-colors">Управление задачами</summary>
              <div className="px-6 pb-5 max-h-48 overflow-y-auto space-y-3 border-t border-white/10 pt-4">
                {quests.map(q => (<div key={q.id} className="flex justify-between items-center"><span className="text-xs text-slate-400 truncate pr-3 font-light">{q.title}</span><button onClick={() => handleDeleteQuest(q.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 px-3 py-1.5 bg-black/30 rounded-lg border border-white/5 transition-colors">Удалить</button></div>))}
              </div>
            </details>
            <details className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden group">
              <summary className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:text-white group-open:bg-white/5 transition-colors">Управление ветвями</summary>
              <div className="px-6 pb-5 max-h-48 overflow-y-auto space-y-3 border-t border-white/10 pt-4">
                {dbCategories.map(c => (<div key={c.id} className="flex justify-between items-center"><span className="text-xs text-slate-400 truncate pr-3 font-light">{c.name}</span><button onClick={() => handleDeleteCategory(c.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 px-3 py-1.5 bg-black/30 rounded-lg border border-white/5 transition-colors">Удалить</button></div>))}
              </div>
            </details>
            <details className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden group">
              <summary className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:text-white group-open:bg-white/5 transition-colors">Управление магазином</summary>
              <div className="px-6 pb-5 max-h-48 overflow-y-auto space-y-3 border-t border-white/10 pt-4">
                {rewards.map(r => (<div key={r.id} className="flex justify-between items-center"><span className="text-xs text-slate-400 truncate pr-3 font-light">{r.title}</span><button onClick={() => handleDeleteReward(r.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 px-3 py-1.5 bg-black/30 rounded-lg border border-white/5 transition-colors">Удалить</button></div>))}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* === ВКЛАДКА 4: АНАЛИТИКА === */}
      {activeTab === 'analytics' && (
        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <h2 className="text-sm font-light text-white mb-8 tracking-wide text-center">Распределение опыта</h2>
            {chartData?.labels?.length > 0 ? (
              <div className="relative w-full h-72"><canvas id="analyticsChart"></canvas></div>
            ) : (<div className="text-center py-16 text-xs text-slate-500 font-light tracking-widest uppercase">Нет данных для анализа</div>)}
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-7 border border-white/10 shadow-[0_4px_16px_0_rgba(0,0,0,0.1)]">
              <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-5">Журнал событий</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {logs.map(log => (<div key={log.id} className="text-xs text-slate-400 border-l border-white/10 pl-4 py-1 font-light tracking-wide">{log.text}</div>))}
                {logs.length === 0 && <div className="text-xs text-slate-600 font-light">Система ожидает действий.</div>}
              </div>
            </div>
        </div>
      )}

    </div>
  )
}

export default App