import { useState, useEffect } from 'react'
import axios from 'axios'

// Укажи здесь свой URL бэкенда на Render
const API_URL = 'https://liferpg-backend.onrender.com'

function App() {
  // --- СОСТОЯНИЯ ДАННЫХ ---
  const [profile, setProfile] = useState(null)
  const [xpToNext, setXpToNext] = useState(100)
  const [quests, setQuests] = useState([])
  const [rewards, setRewards] = useState([])
  const [logs, setLogs] = useState([])
  const [chartData, setChartData] = useState(null)
  const [dbCategories, setDbCategories] = useState([]) // Новое: категории из базы
  
  // --- СОСТОЯНИЯ ИНТЕРФЕЙСА ---
  const [activeTab, setActiveTab] = useState('play')
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [rank, setRank] = useState('⚔️ Новичок')

  // --- ПОЛЯ КУЗНИЦЫ ---
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newXp, setNewXp] = useState(15)
  const [newGold, setNewGold] = useState(15)
  const [newCategory, setNewCategory] = useState('')
  const [newRequiresId, setNewRequiresId] = useState('')
  const [newIsDaily, setNewIsDaily] = useState(false)
  
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardCost, setNewRewardCost] = useState(30)
  
  const [newCategoryInput, setNewCategoryInput] = useState('') // Поле для новой категории

  // --- АВТОСБРОС ДЕЙЛИКОВ ---
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
            title: quest.title,
            description: quest.description || "",
            xp: Number(quest.xp),
            gold: Number(quest.gold),
            category: quest.category || "✨ Разное",
            requires_id: quest.requires_id || "",
            is_daily: true
          });
        }
        localStorage.setItem('matrixDailyReset', today);
        fetchData();
      } else {
        localStorage.setItem('matrixDailyReset', today);
      }
    }
  };

  // --- РЕТРО-ЗВУКИ ---
  const playRetroSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(350, ctx.currentTime); osc.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'coin') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime); osc.frequency.setValueAtTime(950, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'levelup') {
        osc.type = 'square'; const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5];
        notes.forEach((f, i) => { osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.07); });
        gain.gain.setValueAtTime(0.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) { console.log("Audio API init skipped") }
  }

  // --- ЗАГРУЗКА ДАННЫХ ---
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
        setProfile(pData);
        setXpToNext(profRes.value.data.xp_to_next_level || pData.level * 100);
        setRank(pData.rank || '⚔️ Новичок');
      }

      if (catRes.status === 'fulfilled') {
        const loadedCats = catRes.value.data.categories || [];
        setDbCategories(loadedCats);
        // Если категория не выбрана, ставим первую из базы
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

    } catch (error) { 
      console.error("Глобальная ошибка синхронизации:", error) 
    }
  }

  useEffect(() => { fetchData() }, [])

  // --- ЭКШЕНЫ ---
  const completeQuest = async (id) => {
    const res = await axios.post(`${API_URL}/complete_quest`, { quest_id: id });
    res.data.level_up ? (playRetroSound('levelup'), setShowLevelUpModal(true)) : playRetroSound('click');
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

  // --- ГРАФИК ---
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
            backgroundColor: ['#00E5FF', '#AF52DE', '#FF3B30', '#FFCC00', '#34C759', '#FF9500'],
            borderWidth: 2, borderColor: '#06070a', hoverOffset: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '75%',
          plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF', padding: 15, usePointStyle: true, font: { size: 11, weight: '600' } } } }
        }
      });
    }
  }, [activeTab, chartData]);

  if (!profile) return <div className="min-h-screen bg-[#06070a] flex items-center justify-center text-cyan-500 font-mono tracking-widest text-xs animate-pulse">ИНИЦИАЛИЗАЦИЯ МАТРИЦЫ...</div>

  const progressPercent = Math.min((profile.current_xp / xpToNext) * 100, 100)
  const statsEntries = Object.entries(profile.stats || {})

  // Умная группировка квестов (Активные -> Заблокированные -> Выполненные)
  const getSortedQuests = (catName) => {
    return quests.filter(q => (q.category || '✨ Разное') === catName).sort((a, b) => {
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      return 0;
    });
  };

  // Собираем уникальные категории из существующих квестов, чтобы не выводить пустые блоки
  const activeQuestCategories = [...new Set(quests.map(q => q.category || '✨ Разное'))];

  return (
    <div className="min-h-screen bg-[#06070a] text-gray-200 flex flex-col items-center py-6 px-4 font-sans pb-24 select-none">
      
      {/* МОДАЛЬНОЕ ОКНО LEVEL UP */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-cyan-500/50 rounded-2xl p-8 max-w-xs w-full text-center shadow-[0_0_40px_rgba(6,182,212,0.3)]">
            <div className="text-5xl mb-3 animate-bounce">⚡</div>
            <h2 className="text-2xl font-black text-cyan-400 mb-1 uppercase tracking-widest">LEVEL UP</h2>
            <p className="text-gray-400 text-xs mb-6">Текущий уровень: <span className="text-green-400 font-bold">{profile.level}</span></p>
            <button onClick={() => setShowLevelUpModal(false)} className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">Продолжить</button>
          </div>
        </div>
      )}

      {/* НАВИГАЦИЯ (TABS) */}
      <div className="w-full max-w-md bg-gray-900/80 p-1 rounded-xl border border-gray-800/60 flex gap-1 mb-6 backdrop-blur-md sticky top-4 z-40 shadow-xl">
        <button onClick={() => setActiveTab('play')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${activeTab === 'play' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>⚔️ КВЕСТЫ</button>
        <button onClick={() => setActiveTab('shop')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${activeTab === 'shop' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>💰 МАГАЗИН</button>
        <button onClick={() => setActiveTab('forge')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${activeTab === 'forge' ? 'bg-gray-800 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>🛠️ КУЗНИЦА</button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>📊 АНАЛИТИКА</button>
      </div>

      {/* =========================================
          ВКЛАДКА 1: PLAY (КВЕСТЫ И ПРОФИЛЬ)
      ========================================= */}
      {activeTab === 'play' && (
        <div className="w-full max-w-md space-y-5">
          {/* ПРОФИЛЬ */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800/50 flex justify-between items-center relative overflow-hidden">
            <div className="flex-1 pr-3">
              <h1 className="text-lg font-black text-gray-100 leading-tight">{profile.name}</h1>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-[9px] text-green-400 font-bold tracking-widest uppercase">УРОВЕНЬ {profile.level}</span>
                <span className="text-[10px] text-cyan-400 font-extrabold">{rank}</span> 
              </div>
              <div className="mt-3 mb-1 flex justify-between text-[9px] text-gray-500 font-bold font-mono"><span>{profile.current_xp} / {xpToNext} XP</span></div>
              <div className="w-full bg-gray-800 rounded-full h-1.5"><div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div></div>
            </div>
            <div className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-center min-w-[70px]">
              <span className="block text-[8px] font-bold text-gray-500 tracking-wider mb-0.5">ЗОЛОТО</span>
              <span className="text-base font-black text-amber-400 font-mono">{profile.gold}</span>
            </div>
          </div>

          {/* НАВЫКИ (Скрыты, если нет) */}
          {statsEntries.length > 0 && (
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-3">
              <h3 className="text-[8px] font-black text-gray-500 tracking-widest uppercase mb-2">Навыки (XP)</h3>
              <div className="space-y-2">
                {statsEntries.map(([cat, val]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-gray-400 mb-1 text-[10px]"><span className="truncate pr-2">{cat}</span><span className="text-cyan-400 font-bold font-mono">{val}</span></div>
                    <div className="w-full bg-gray-800 h-1 rounded-full"><div className="bg-cyan-600 h-full rounded-full" style={{ width: `${Math.min((val / 500) * 100, 100)}%` }}></div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* СПИСОК КВЕСТОВ ПО КАТЕГОРИЯМ */}
          <div className="space-y-5">
            {activeQuestCategories.map(category => (
              <div key={category} className="space-y-2">
                <h2 className="text-[9px] font-black text-cyan-500/70 tracking-widest uppercase px-1 border-b border-gray-800/50 pb-1">{category}</h2>
                <div className="space-y-1.5">
                  {getSortedQuests(category).map((quest) => {
                    const parentQuest = quest.requires_id ? quests.find(q => q.id === quest.requires_id) : null;
                    const isLocked = quest.requires_id && (!parentQuest || !parentQuest.completed);
                    
                    return (
                      <div key={quest.id} className={`p-3 rounded-xl flex justify-between items-center border transition-all ${quest.completed ? 'bg-gray-900/20 border-transparent opacity-40' : isLocked ? 'bg-gray-900/40 border-gray-800/50 opacity-60' : 'bg-gray-900 border-gray-700/60 hover:border-gray-600'}`}>
                        <div className="pr-3 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            {isLocked && <span className="text-[7px] bg-purple-500/10 text-purple-400 px-1 rounded font-black uppercase tracking-wider">🔒 Ждет: {parentQuest?.title || '...'}</span>}
                            {quest.is_daily && <span className="text-[7px] bg-cyan-500/10 text-cyan-400 px-1 rounded font-black uppercase tracking-wider">🔄 Дейлик</span>}
                          </div>
                          <h3 className={`font-bold text-xs leading-tight ${quest.completed ? 'text-gray-500 line-through' : isLocked ? 'text-gray-400' : 'text-gray-200'}`}>{quest.title}</h3>
                          {quest.description && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{quest.description}</p>}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5 min-w-[60px]">
                          {!quest.completed && <div className="text-[8px] font-bold font-mono"><span className={isLocked ? 'text-gray-600' : 'text-cyan-500'}>+{quest.xp} XP</span> <span className={isLocked ? 'text-gray-600' : 'text-amber-500'}>+{quest.gold}💰</span></div>}
                          <button onClick={() => completeQuest(quest.id)} disabled={quest.completed || isLocked} className={`w-full py-1.5 rounded-md font-black text-[9px] transition-all ${quest.completed ? 'bg-gray-800 text-gray-600' : isLocked ? 'bg-gray-900 text-gray-700 border border-gray-800' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'}`}>
                            {quest.completed ? '✓' : isLocked ? '🔒' : 'ЗАЧЕТ'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {quests.length === 0 && <div className="text-center text-gray-600 text-[10px] uppercase tracking-widest py-10 font-mono">Доска чиста. Загляни в Кузницу.</div>}
          </div>
        </div>
      )}

      {/* =========================================
          ВКЛАДКА 2: SHOP (МАГАЗИН)
      ========================================= */}
      {activeTab === 'shop' && (
        <div className="w-full max-w-md space-y-4">
          <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-4 text-center">
            <p className="text-[9px] text-amber-500/70 font-bold uppercase tracking-widest mb-1">ДОСТУПНО ДЛЯ ТРАТ</p>
            <h2 className="text-2xl font-black text-amber-400 font-mono">{profile.gold} 💰</h2>
          </div>
          <div className="space-y-2">
            {rewards.map(reward => (
              <div key={reward.id} className="p-3 bg-gray-900 border border-gray-800/60 rounded-xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-xs text-gray-200">{reward.title}</h3>
                  <p className="text-[10px] text-amber-500 font-bold mt-0.5 font-mono">{reward.cost} 💰</p>
                </div>
                <button onClick={() => buyReward(reward.id)} disabled={profile.gold < reward.cost} className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all ${profile.gold >= reward.cost ? 'bg-amber-500 hover:bg-amber-400 text-gray-900' : 'bg-gray-800 text-gray-600'}`}>КУПИТЬ</button>
              </div>
            ))}
            {rewards.length === 0 && <div className="text-center text-gray-600 text-[10px] uppercase tracking-widest py-10 font-mono">Товаров нет.</div>}
          </div>
        </div>
      )}

      {/* =========================================
          ВКЛАДКА 3: FORGE (ПРЕМИУМ КУЗНИЦА)
      ========================================= */}
      {activeTab === 'forge' && (
        <div className="w-full max-w-md space-y-4">
          
          {/* БЛОК: СОЗДАНИЕ КВЕСТА */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800/60">
            <h3 className="text-[10px] font-black text-cyan-500 tracking-widest uppercase mb-3">🔨 Выковать квест</h3>
            <form onSubmit={handleAddQuest}>
              <input type="text" placeholder="Суть задачи..." required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-gray-950 text-gray-200 rounded-lg px-3 py-2 mb-2 border border-gray-800 text-xs focus:border-cyan-500 outline-none" />
              <input type="text" placeholder="Детали (необязательно)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-gray-950 text-gray-400 rounded-lg px-3 py-2 mb-3 border border-gray-800 text-[11px] focus:border-cyan-500 outline-none" />
              
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-[8px] text-gray-500 uppercase font-bold mb-1 ml-1">Категория</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-gray-950 text-gray-300 rounded-lg px-2 py-2 border border-gray-800 text-[11px] focus:border-cyan-500 outline-none cursor-pointer">
                    {dbCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    {dbCategories.length === 0 && <option value="✨ Разное">✨ Разное</option>}
                  </select>
                </div>
                <div className="w-16">
                  <label className="block text-[8px] text-gray-500 uppercase font-bold mb-1 ml-1">XP</label>
                  <input type="number" required min="1" value={newXp} onChange={(e) => setNewXp(e.target.value)} className="w-full bg-gray-950 text-cyan-400 rounded-lg px-2 py-2 border border-gray-800 text-[11px] text-center focus:border-cyan-500 outline-none font-mono" />
                </div>
                <div className="w-16">
                  <label className="block text-[8px] text-gray-500 uppercase font-bold mb-1 ml-1">Gold</label>
                  <input type="number" required min="1" value={newGold} onChange={(e) => setNewGold(e.target.value)} className="w-full bg-gray-950 text-amber-400 rounded-lg px-2 py-2 border border-gray-800 text-[11px] text-center focus:border-cyan-500 outline-none font-mono" />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[8px] text-gray-500 uppercase font-bold mb-1 ml-1">🔒 Блокировка (Цепочка)</label>
                <select value={newRequiresId} onChange={(e) => setNewRequiresId(e.target.value)} className="w-full bg-gray-950 text-gray-400 rounded-lg px-2 py-2 border border-gray-800 text-[10px] focus:border-cyan-500 outline-none cursor-pointer">
                  <option value="">🔓 Нет зависимости (Доступен сразу)</option>
                  {quests.map(q => <option key={q.id} value={q.id}>Требует: {q.title}</option>)}
                </select>
              </div>

              <label className="flex items-center gap-2 mb-4 px-1 cursor-pointer w-max">
                <input type="checkbox" checked={newIsDaily} onChange={(e) => setNewIsDaily(e.target.checked)} className="w-3.5 h-3.5 accent-cyan-600 bg-gray-900 border-gray-700 rounded" />
                <span className="text-[10px] text-gray-400 font-bold select-none">🔄 Сбрасывать каждое утро (Дейлик)</span>
              </label>

              <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black py-2.5 rounded-lg tracking-widest uppercase transition-all">Создать Квест</button>
            </form>
          </div>

          {/* БЛОК: СОЗДАНИЕ КАТЕГОРИИ */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800/60">
            <h3 className="text-[10px] font-black text-purple-400 tracking-widest uppercase mb-3">📂 Добавить категорию</h3>
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input type="text" placeholder="Например: 🚗 Авто-Кастом" required value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="flex-1 bg-gray-950 text-gray-200 rounded-lg px-3 py-2 border border-gray-800 text-xs focus:border-purple-500 outline-none" />
              <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all">Добавить</button>
            </form>
          </div>

          {/* БЛОК: СОЗДАНИЕ НАГРАДЫ */}
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800/60">
            <h3 className="text-[10px] font-black text-amber-500 tracking-widest uppercase mb-3">🎁 Добавить товар</h3>
            <form onSubmit={handleAddReward} className="flex gap-2">
              <input type="text" placeholder="Название награды..." required value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} className="flex-1 bg-gray-950 text-gray-200 rounded-lg px-3 py-2 border border-gray-800 text-xs focus:border-amber-500 outline-none" />
              <input type="number" placeholder="Цена" required min="1" value={newRewardCost} onChange={(e) => setNewRewardCost(e.target.value)} className="w-16 bg-gray-950 text-amber-400 rounded-lg px-2 py-2 border border-gray-800 text-[11px] text-center focus:border-amber-500 outline-none font-mono" />
              <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all">В шоп</button>
            </form>
          </div>

          {/* БЛОК: УПРАВЛЕНИЕ (УДАЛЕНИЕ) СПРЯТАНО В АККОРДЕОНЫ */}
          <div className="space-y-2 pt-2">
            <details className="bg-gray-900 border border-gray-800/60 rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none group-open:bg-gray-800/30">🗑️ Управление Квестами</summary>
              <div className="px-4 pb-3 max-h-40 overflow-y-auto space-y-1 bg-gray-900/50">
                {quests.map(q => (<div key={q.id} className="flex justify-between items-center py-1.5 border-b border-gray-800/40"><span className="text-[10px] text-gray-400 truncate pr-2">{q.title}</span><button onClick={() => handleDeleteQuest(q.id)} className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">✕</button></div>))}
                {quests.length === 0 && <span className="text-[9px] text-gray-600 block pt-2">Нет квестов</span>}
              </div>
            </details>

            <details className="bg-gray-900 border border-gray-800/60 rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none group-open:bg-gray-800/30">🗑️ Управление Категориями</summary>
              <div className="px-4 pb-3 max-h-40 overflow-y-auto space-y-1 bg-gray-900/50">
                {dbCategories.map(c => (<div key={c.id} className="flex justify-between items-center py-1.5 border-b border-gray-800/40"><span className="text-[10px] text-gray-400 truncate pr-2">{c.name}</span><button onClick={() => handleDeleteCategory(c.id)} className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">✕</button></div>))}
              </div>
            </details>

            <details className="bg-gray-900 border border-gray-800/60 rounded-xl overflow-hidden group">
              <summary className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none group-open:bg-gray-800/30">🗑️ Управление Наградами</summary>
              <div className="px-4 pb-3 max-h-40 overflow-y-auto space-y-1 bg-gray-900/50">
                {rewards.map(r => (<div key={r.id} className="flex justify-between items-center py-1.5 border-b border-gray-800/40"><span className="text-[10px] text-gray-400 truncate pr-2">{r.title}</span><button onClick={() => handleDeleteReward(r.id)} className="text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">✕</button></div>))}
                {rewards.length === 0 && <span className="text-[9px] text-gray-600 block pt-2">Нет наград</span>}
              </div>
            </details>
          </div>

        </div>
      )}

      {/* =========================================
          ВКЛАДКА 4: АНАЛИТИКА
      ========================================= */}
      {activeTab === 'analytics' && (
        <div className="w-full max-w-md space-y-6">
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800/60 shadow-xl flex flex-col items-center">
            <div className="w-full text-left mb-2">
              <h2 className="text-xs font-black text-purple-400 tracking-widest uppercase mb-0.5">📊 Матрица Влияния</h2>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Распределение опыта по жизненным путям</p>
            </div>
            {chartData?.labels?.length > 0 ? (
              <div className="relative w-full h-56 mt-2"><canvas id="analyticsChart"></canvas></div>
            ) : (<div className="text-center py-12 text-[10px] text-gray-600 uppercase font-mono">Летопись пуста. Зачтите квесты.</div>)}
          </div>

          <div className="bg-gray-900/40 rounded-2xl p-4 border border-gray-800/40">
              <h3 className="text-[9px] font-black text-gray-500 tracking-widest uppercase mb-2">📜 Логи системы</h3>
              <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[9px] text-gray-400">
                {logs.map(log => (<div key={log.id} className="pl-2 border-l border-gray-700 py-0.5">{log.text}</div>))}
                {logs.length === 0 && <div>Нет событий</div>}
              </div>
            </div>
        </div>
      )}

    </div>
  )
}

export default App