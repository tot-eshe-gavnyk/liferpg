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
        // Сохраняем расширенный профиль, который теперь включает category_levels
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
      // Пытаемся предсказать новый уровень категории для красивого алерта
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
            backgroundColor: ['#14b8a6', '#8b5cf6', '#f43f5e', '#eab308', '#22c55e', '#f97316'],
            borderWidth: 0, hoverOffset: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '80%',
          plugins: { legend: { position: 'bottom', labels: { color: '#a1a1aa', padding: 20, usePointStyle: true, font: { size: 12, family: 'Inter, sans-serif' } } } }
        }
      });
    }
  }, [activeTab, chartData]);

  if (!profile) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono tracking-widest text-xs animate-pulse">ИНИЦИАЛИЗАЦИЯ...</div>

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
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col items-center py-6 px-4 font-sans pb-28 selection:bg-teal-500/30">
      
      {/* МОДАЛКА GLOBAL LEVEL UP */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Новый уровень</h2>
            <p className="text-zinc-400 text-sm mb-6">Вы достигли <span className="text-teal-400 font-semibold">{profile.level} уровня</span></p>
            <button onClick={() => setShowLevelUpModal(false)} className="w-full bg-white text-zinc-950 hover:bg-zinc-200 py-3.5 rounded-xl text-sm font-semibold transition-colors">Продолжить</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА CATEGORY LEVEL UP */}
      {showCatLevelUpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">🔥</div>
            <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Путь прокачан</h2>
            <p className="text-zinc-400 text-sm mb-6">Направление <span className="text-purple-400 font-semibold">{newCatLevelData.name}</span> достигло {newCatLevelData.level} уровня!</p>
            <button onClick={() => setShowCatLevelUpModal(false)} className="w-full bg-white text-zinc-950 hover:bg-zinc-200 py-3.5 rounded-xl text-sm font-semibold transition-colors">Продолжить</button>
          </div>
        </div>
      )}

      {/* НАВИГАЦИЯ */}
      <div className="w-full max-w-md bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5 flex gap-1.5 mb-8 backdrop-blur-xl sticky top-4 z-40 shadow-lg shadow-black/20">
        <button onClick={() => setActiveTab('play')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${activeTab === 'play' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>Квесты</button>
        <button onClick={() => setActiveTab('shop')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${activeTab === 'shop' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>Магазин</button>
        <button onClick={() => setActiveTab('forge')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${activeTab === 'forge' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>Кузница</button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${activeTab === 'analytics' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>Аналитика</button>
      </div>

      {/* === ВКЛАДКА 1: PLAY === */}
      {activeTab === 'play' && (
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          {/* ПРОФИЛЬ КАРТОЧКА */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-3xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white tracking-tight">{profile.name}</h1>
                <p className="text-sm text-teal-400 font-medium mt-0.5">{rank} • {profile.level} Ур.</p>
                <div className="mt-5 mb-2 flex justify-between text-xs text-zinc-400 font-medium">
                  <span>Опыт</span>
                  <span>{profile.current_xp} / {xpToNext}</span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-2 border border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
              <div className="ml-4 bg-zinc-950/50 border border-white/5 rounded-2xl px-4 py-3 text-center backdrop-blur-md">
                <span className="block text-[10px] font-semibold text-zinc-500 tracking-wider mb-1 uppercase">Баланс</span>
                <span className="text-xl font-bold text-amber-400">{profile.gold}</span>
              </div>
            </div>
          </div>

          {/* СПИСОК ПУТЕЙ (КАТЕГОРИЙ) С УРОВНЯМИ И КВЕСТАМИ */}
          <div className="space-y-8">
            {activeQuestCategories.map(category => {
              // Достаем данные об уровне категории
              const catData = profile.category_levels?.[category] || { level: 1, percent: 0, is_maxed: false };
              
              return (
                <div key={category} className="space-y-4">
                  {/* Заголовок Категории с Прогрессом */}
                  <div className="flex items-end justify-between px-1">
                    <div>
                      <h2 className="text-sm font-semibold text-white tracking-tight">{category}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">{catData.is_maxed ? 'Максимальный уровень' : `Уровень ${catData.level}`}</p>
                    </div>
                    {!catData.is_maxed && (
                      <div className="w-24 text-right">
                         <span className="text-[10px] text-zinc-500 font-medium mb-1 inline-block">{catData.percent}%</span>
                         <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                           <div className="bg-purple-500 h-full rounded-full" style={{ width: `${catData.percent}%` }}></div>
                         </div>
                      </div>
                    )}
                  </div>

                  {/* Карточки Квестов */}
                  <div className="space-y-2.5">
                    {getSortedQuests(category).map((quest) => {
                      const parentQuest = quest.requires_id ? quests.find(q => q.id === quest.requires_id) : null;
                      const isLocked = quest.requires_id && (!parentQuest || !parentQuest.completed);
                      
                      return (
                        <div key={quest.id} className={`p-4 rounded-2xl flex justify-between items-center transition-all duration-300 ${quest.completed ? 'bg-zinc-900/30 opacity-50' : isLocked ? 'bg-zinc-900/40 border border-white/5 opacity-70' : 'bg-zinc-900 border border-white/5 hover:border-white/10 shadow-sm'}`}>
                          <div className="pr-4 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              {isLocked && <span className="text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full font-medium">🔒 Ждет: {parentQuest?.title || '...'}</span>}
                              {quest.is_daily && <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-medium">Ежедневно</span>}
                            </div>
                            <h3 className={`text-sm font-medium leading-snug ${quest.completed ? 'text-zinc-500 line-through' : isLocked ? 'text-zinc-500' : 'text-zinc-100'}`}>{quest.title}</h3>
                            {quest.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{quest.description}</p>}
                          </div>
                          
                          <div className="flex flex-col items-end justify-center gap-2 min-w-[70px]">
                            {!quest.completed && (
                              <div className="text-[10px] font-medium flex gap-1.5">
                                <span className={isLocked ? 'text-zinc-600' : 'text-zinc-400'}>{quest.xp} XP</span>
                                <span className={isLocked ? 'text-zinc-600' : 'text-amber-400/80'}>{quest.gold} G</span>
                              </div>
                            )}
                            <button onClick={() => completeQuest(quest)} disabled={quest.completed || isLocked} className={`w-full py-2 rounded-xl text-xs font-semibold transition-all ${quest.completed ? 'bg-transparent text-zinc-600' : isLocked ? 'bg-zinc-950 text-zinc-600' : 'bg-white text-zinc-900 hover:bg-zinc-200'}`}>
                              {quest.completed ? 'Выполнено' : isLocked ? 'Закрыто' : 'Зачет'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {quests.length === 0 && <div className="text-center text-zinc-600 text-sm py-16">Нет активных задач. Загляните в Кузницу.</div>}
          </div>
        </div>
      )}

      {/* === ВКЛАДКА 2: МАГАЗИН === */}
      {activeTab === 'shop' && (
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-zinc-900 border border-white/5 rounded-3xl p-8 text-center shadow-lg">
            <p className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-widest">Доступные средства</p>
            <h2 className="text-4xl font-bold text-amber-400">{profile.gold}</h2>
          </div>
          <div className="space-y-3">
            {rewards.map(reward => (
              <div key={reward.id} className="p-4 bg-zinc-900 border border-white/5 rounded-2xl flex justify-between items-center hover:border-white/10 transition-colors">
                <div>
                  <h3 className="font-medium text-sm text-zinc-100">{reward.title}</h3>
                  <p className="text-xs text-amber-400/80 font-medium mt-1">{reward.cost} G</p>
                </div>
                <button onClick={() => buyReward(reward.id)} disabled={profile.gold < reward.cost} className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${profile.gold >= reward.cost ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' : 'bg-zinc-950 text-zinc-600'}`}>Купить</button>
              </div>
            ))}
            {rewards.length === 0 && <div className="text-center text-zinc-600 text-sm py-16">Витрина пуста.</div>}
          </div>
        </div>
      )}

      {/* === ВКЛАДКА 3: КУЗНИЦА === */}
      {activeTab === 'forge' && (
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-lg">
            <h3 className="text-sm font-semibold text-white mb-5">Создать задачу</h3>
            <form onSubmit={handleAddQuest}>
              <div className="space-y-3 mb-5">
                <input type="text" placeholder="Название..." required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-zinc-950 text-zinc-200 rounded-xl px-4 py-3.5 border border-white/5 text-sm focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all placeholder:text-zinc-600" />
                <textarea placeholder="Детали или шаги (опционально)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-zinc-950 text-zinc-400 rounded-xl px-4 py-3 border border-white/5 text-xs min-h-[80px] focus:border-white/20 focus:ring-1 focus:ring-white/20 outline-none transition-all resize-none placeholder:text-zinc-600" />
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Категория</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-zinc-950 text-zinc-300 rounded-xl px-3 py-3 border border-white/5 text-sm focus:border-white/20 outline-none appearance-none">
                    {dbCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    {dbCategories.length === 0 && <option value="✨ Разное">✨ Разное</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Опыт (XP)</label>
                  <input type="number" required min="1" value={newXp} onChange={(e) => setNewXp(e.target.value)} className="w-full bg-zinc-950 text-teal-400 rounded-xl px-4 py-3 border border-white/5 text-sm focus:border-white/20 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Золото</label>
                  <input type="number" required min="1" value={newGold} onChange={(e) => setNewGold(e.target.value)} className="w-full bg-zinc-950 text-amber-400 rounded-xl px-4 py-3 border border-white/5 text-sm focus:border-white/20 outline-none" />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs text-zinc-500 mb-1.5 ml-1">Блокировка (Цепочка)</label>
                <select value={newRequiresId} onChange={(e) => setNewRequiresId(e.target.value)} className="w-full bg-zinc-950 text-zinc-400 rounded-xl px-3 py-3 border border-white/5 text-xs focus:border-white/20 outline-none appearance-none">
                  <option value="">Без зависимости</option>
                  {quests.map(q => <option key={q.id} value={q.id}>Ждать: {q.title}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-zinc-950/50 border border-white/5 cursor-pointer">
                <input type="checkbox" checked={newIsDaily} onChange={(e) => setNewIsDaily(e.target.checked)} className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 accent-zinc-500" />
                <span className="text-xs text-zinc-300 font-medium">Ежедневная задача</span>
              </label>

              <button type="submit" className="w-full bg-white hover:bg-zinc-200 text-zinc-950 text-sm font-semibold py-3.5 rounded-xl transition-colors">Добавить задачу</button>
            </form>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-lg">
            <h3 className="text-sm font-semibold text-white mb-4">Настройки системы</h3>
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <input type="text" placeholder="Новая категория..." required value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="flex-1 bg-zinc-950 text-zinc-200 rounded-xl px-4 py-3 border border-white/5 text-xs focus:border-white/20 outline-none placeholder:text-zinc-600" />
              <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 rounded-xl text-xs font-semibold transition-colors">+</button>
            </form>
            <form onSubmit={handleAddReward} className="flex gap-2">
              <input type="text" placeholder="Награда..." required value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} className="flex-1 bg-zinc-950 text-zinc-200 rounded-xl px-4 py-3 border border-white/5 text-xs focus:border-white/20 outline-none placeholder:text-zinc-600" />
              <input type="number" placeholder="Цена" required min="1" value={newRewardCost} onChange={(e) => setNewRewardCost(e.target.value)} className="w-20 bg-zinc-950 text-amber-400 rounded-xl px-3 py-3 border border-white/5 text-xs text-center outline-none" />
              <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 rounded-xl text-xs font-semibold transition-colors">+</button>
            </form>
          </div>

          {/* УПРАВЛЕНИЕ ДАННЫМИ (АККОРДЕОНЫ) */}
          <div className="space-y-2">
            <details className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden group">
              <summary className="px-5 py-4 text-xs font-medium text-zinc-400 cursor-pointer select-none group-open:text-white">Управление задачами</summary>
              <div className="px-5 pb-4 max-h-48 overflow-y-auto space-y-2 border-t border-white/5 pt-3">
                {quests.map(q => (<div key={q.id} className="flex justify-between items-center"><span className="text-xs text-zinc-400 truncate pr-2">{q.title}</span><button onClick={() => handleDeleteQuest(q.id)} className="text-[10px] font-bold text-zinc-500 hover:text-red-400 px-2 py-1 bg-zinc-950 rounded-lg">Удалить</button></div>))}
              </div>
            </details>
            <details className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden group">
              <summary className="px-5 py-4 text-xs font-medium text-zinc-400 cursor-pointer select-none group-open:text-white">Управление категориями</summary>
              <div className="px-5 pb-4 max-h-48 overflow-y-auto space-y-2 border-t border-white/5 pt-3">
                {dbCategories.map(c => (<div key={c.id} className="flex justify-between items-center"><span className="text-xs text-zinc-400 truncate pr-2">{c.name}</span><button onClick={() => handleDeleteCategory(c.id)} className="text-[10px] font-bold text-zinc-500 hover:text-red-400 px-2 py-1 bg-zinc-950 rounded-lg">Удалить</button></div>))}
              </div>
            </details>
            <details className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden group">
              <summary className="px-5 py-4 text-xs font-medium text-zinc-400 cursor-pointer select-none group-open:text-white">Управление магазином</summary>
              <div className="px-5 pb-4 max-h-48 overflow-y-auto space-y-2 border-t border-white/5 pt-3">
                {rewards.map(r => (<div key={r.id} className="flex justify-between items-center"><span className="text-xs text-zinc-400 truncate pr-2">{r.title}</span><button onClick={() => handleDeleteReward(r.id)} className="text-[10px] font-bold text-zinc-500 hover:text-red-400 px-2 py-1 bg-zinc-950 rounded-lg">Удалить</button></div>))}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* === ВКЛАДКА 4: АНАЛИТИКА === */}
      {activeTab === 'analytics' && (
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="bg-zinc-900 rounded-3xl p-6 border border-white/5 shadow-lg">
            <h2 className="text-sm font-semibold text-white mb-6">Распределение опыта</h2>
            {chartData?.labels?.length > 0 ? (
              <div className="relative w-full h-64"><canvas id="analyticsChart"></canvas></div>
            ) : (<div className="text-center py-12 text-xs text-zinc-600">Нет данных для графика</div>)}
          </div>

          <div className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-4">Журнал событий</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {logs.map(log => (<div key={log.id} className="text-xs text-zinc-400 border-l-2 border-zinc-800 pl-3 py-0.5">{log.text}</div>))}
                {logs.length === 0 && <div className="text-xs text-zinc-600">Система ожидает действий.</div>}
              </div>
            </div>
        </div>
      )}

    </div>
  )
}

export default App