import { useState, useEffect, biographies } from 'react'
import axios from 'axios'

function App() {
  const [profile, setProfile] = useState(null)
  const [xpToNext, setXpToNext] = useState(100)
  const [quests, setQuests] = useState([])
  const [rewards, setRewards] = useState([])
  const [logs, setLogs] = useState([])
  const [chartData, setChartData] = useState(null) // Стейт для данных круглого графика
  
  const [activeTab, setActiveTab] = useState('play')
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [rank, setRank] = useState('⚔️ Новичок')

  // Поля форм в Кузнице
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newXp, setNewXp] = useState(15)
  const [newGold, setNewGold] = useState(15)
  const [newCategory, setNewCategory] = useState('')
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardCost, setNewRewardCost] = useState(30)

  // НАВТИВНЫЙ РЕТРО-СИНТЕЗАТОР ЗВУКА
  const playRetroSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(950, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'levelup') {
        osc.type = 'square';
        const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0, 1046.5];
        notes.forEach((f, i) => {
          osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.07);
        });
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(); osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) { console.error("Аудио контекст заблокирован до первого клика", e) }
  }

  const fetchData = async () => {
    try {
      // Синхронизация профиля
      const profResponse = await axios.get('https://liferpg-backend.onrender.com/profile')
      const profData = profResponse.data.profile ? profResponse.data.profile : profResponse.data
      setProfile(profData)
      
      // Авторасчет необходимого опыта на основе уровня бэкенда v4.0
      const nextXp = profResponse.data.xp_to_next_level ? profResponse.data.xp_to_next_level : (profData.level * 100)
      setXpToNext(nextXp)
      setRank(profData.rank || '⚔️ Новичок')

      // Синхронизация квестов с поддержкой прямого списочного ответа v4.0
      const questResponse = await axios.get('https://liferpg-backend.onrender.com/quests')
      const activeQuests = Array.isArray(questResponse.data) ? questResponse.data : (questResponse.data.quests || [])
      setQuests(activeQuests)

      // Магазин
      try {
        const rewardResponse = await axios.get('https://liferpg-backend.onrender.com/rewards')
        setRewards(rewardResponse.data.rewards || rewardResponse.data || [])
      } catch(e) { console.log("Эндпоинт магазина пока настраивается") }

      // Логи ленты
      try {
        const logsResponse = await axios.get('https://liferpg-backend.onrender.com/logs')
        setLogs(logsResponse.data.logs || [])
      } catch(e) { console.log("Лента логов пуста") }

      // Подтягиваем свежую агрегацию для круглого графика
      const analyticsResponse = await axios.get('https://liferpg-backend.onrender.com/analytics/categories')
      setChartData(analyticsResponse.data)

    } catch (error) { 
      console.error("Сбой синхронизации с облаком Render:", error) 
    }
  }

  const completeQuest = async (questId) => {
    try {
      // Поддержка роутинга v4.0 (параметр в пути)
      const res = await axios.post(`https://liferpg-backend.onrender.com/quests/${questId}/complete`)
      if (res.data.level_up) {
        playRetroSound('levelup');
        setShowLevelUpModal(true);
      } else {
        playRetroSound('click');
      }
      fetchData();
    } catch (error) { 
      // Резервный вызов для старого роута, если бэкенд не обновился
      try {
        const res = await axios.post('https://liferpg-backend.onrender.com/complete_quest', { quest_id: questId })
        if (res.data.level_up) { playRetroSound('levelup'); setShowLevelUpModal(true); } else { playRetroSound('click'); }
        fetchData();
      } catch(e) { console.error("Ошибка закрытия квеста:", e) }
    }
  }

  const buyReward = async (rewardId) => {
    try {
      const res = await axios.post('https://liferpg-backend.onrender.com/buy_reward', { reward_id: rewardId })
      if (res.data.status === "success") {
        playRetroSound('coin');
        fetchData();
      }
    } catch (error) { console.error(error) }
  }

  const handleAddQuest = async (e) => {
    e.preventDefault(); if (!newTitle) return;
    // Унифицированный эндпоинт v4.0
    await axios.post('https://liferpg-backend.onrender.com/quests', {
      title: newTitle, category: newCategory || '✨ Разное', xp: Number(newXp), gold: Number(newGold)
    });
    setNewTitle(''); setNewDesc(''); setNewCategory('');
    fetchData(); setActiveTab('play');
  }

  const handleAddReward = async (e) => {
    e.preventDefault(); if (!newRewardTitle) return;
    await axios.post('https://liferpg-backend.onrender.com/add_reward', { title: newRewardTitle, cost: Number(newRewardCost) });
    setNewRewardTitle('');
    fetchData(); setActiveTab('shop');
  }

  const handleDeleteQuest = async (id) => { await axios.delete(`https://liferpg-backend.onrender.com/delete_quest/${id}`); fetchData(); }
  const handleDeleteReward = async (id) => { await axios.delete(`https://liferpg-backend.onrender.com/delete_reward/${id}`); fetchData(); }

  useEffect(() => { fetchData() }, [])

  // ЖИЗНЕННЫЙ ЦИКЛ КРУГОВОГО ГРАФИКА (CHART.JS)
  useEffect(() => {
    if (activeTab === 'analytics' && chartData && chartData.labels && chartData.labels.length > 0) {
      const chartCanvas = document.getElementById('analyticsChart');
      if (!chartCanvas) return;

      const ctx = chartCanvas.getContext('2d');
      
      // Если экземпляр графика уже существует глобально — сносим его перед перерисовкой
      if (window.currentLiferpgChart) {
        window.currentLiferpgChart.destroy();
      }

      window.currentLiferpgChart = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartData.labels,
          datasets: [{
            label: 'Заработано XP',
            data: chartData.xp_distribution,
            backgroundColor: [
              '#00E5FF', // Неоновый бирюзовый (Твой фирменный кастом)
              '#AF52DE', // Фиолетовый
              '#FF3B30', // Красный
              '#FFCC00', // Желтый
              '#34C759', // Зеленый
              '#FF9500'  // Оранжевый
            ],
            borderWidth: 3,
            borderColor: '#06070a', // Совпадает с фоном body
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '73%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#9CA3AF',
                padding: 16,
                usePointStyle: true,
                font: { size: 12, weight: '600', family: 'system-ui' }
              }
            }
          },
          animation: {
            animateScale: true,
            animateRotate: true
          }
        }
      });
    }

    // Чистим память при закрытии вкладки аналитики
    return () => {
      if (window.currentLiferpgChart) {
        window.currentLiferpgChart.destroy();
        window.currentLiferpgChart = null;
      }
    };
  }, [activeTab, chartData]);

  if (!profile) return <div className="text-center mt-20 text-gray-500 font-mono tracking-widest animate-pulse">SYNCHRONIZING WITH CLUSTER_ATLAS OS...</div>

  const progressPercent = Math.min((profile.current_xp / xpToNext) * 100, 100)
  const categories = [...new Set(quests.map(q => q.category))]
  const statsEntries = Object.entries(profile.stats || {})

  return (
    <div className="min-h-screen bg-[#06070a] text-gray-100 flex flex-col items-center py-6 px-4 font-sans pb-24 select-none">
      
      {/* LEVEL UP ОКНО ТРИУМФА */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-cyan-500 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(6,182,212,0.5)]">
            <div className="text-6xl mb-4 animate-bounce">⚡</div>
            <h2 className="text-3xl font-black text-cyan-400 tracking-wider mb-2 uppercase">LEVEL UP!</h2>
            <p className="text-gray-300 text-sm mb-6">Вы достигли <span className="text-green-400 font-bold font-mono">{profile.level} уровня</span>. Код матрицы переписан!</p>
            <button onClick={() => setShowLevelUpModal(false)} className="w-full bg-cyan-600 hover:bg-cyan-500 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all">Продолжить путь</button>
          </div>
        </div>
      )}

      {/* ТАБ-НАВИГАЦИЯ С ЧЕТЫРЬМЯ ВКЛАДКАМИ */}
      <div className="w-full max-w-md bg-gray-900/90 p-1 rounded-xl border border-gray-800 flex gap-1 mb-6 backdrop-blur-md sticky top-4 z-40 shadow-2xl">
        <button onClick={() => setActiveTab('play')} className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest ${activeTab === 'play' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400'}`}>⚔️ КВЕСТЫ</button>
        <button onClick={() => setActiveTab('shop')} className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest ${activeTab === 'shop' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-400'}`}>💰 МАГАЗИН</button>
        <button onClick={() => setActiveTab('forge')} className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest ${activeTab === 'forge' ? 'bg-gray-800 text-cyan-400' : 'text-gray-400'}`}>🛠️ КУЗНИЦА</button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest ${activeTab === 'analytics' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400'}`}>📊 АНАЛИТИКА</button>
      </div>

      {/* --- ВКЛАДКА 1: ИГРОВОЙ ЭКРАН --- */}
      {activeTab === 'play' && (
        <div className="w-full max-w-md space-y-6">
          
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800/80 flex justify-between items-center shadow-2xl relative overflow-hidden">
            <div className="flex-1 pr-2">
              <h1 className="text-xl font-black text-gray-100">{profile.name || "Оператор"}</h1>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span className="text-[10px] text-green-400 font-bold tracking-widest uppercase">УРОВЕНЬ {profile.level}</span>
                <span className="text-[11px] text-cyan-400 font-extrabold tracking-wide">{rank}</span> 
                {profile.streak > 0 && <span className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1">🔥 СТРИК: {profile.streak} ДН.</span>}
              </div>
              <div className="mt-4 mb-1 flex justify-between text-[10px] text-gray-500 font-bold font-mono"><span>{profile.current_xp} / {xpToNext} XP</span></div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden"><div className="bg-cyan-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div></div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-center min-w-[85px]">
              <span className="block text-[9px] font-bold text-amber-500 tracking-wider uppercase mb-0.5">БАЛАНС</span>
              <span className="text-lg font-black text-amber-300 font-mono">{profile.gold}💰</span>
            </div>
          </div>

          {/* ТЕКСТОВАЯ СТАТИСТИКА РАЗВИТИЯ СФЕР ЖИЗНИ */}
          {statsEntries.length > 0 && (
            <div className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-4">
              <h3 className="text-[9px] font-black text-gray-500 tracking-widest uppercase mb-3">📊 ПРОКАЧАННЫЕ НАВЫКИ (ОПЫТ)</h3>
              <div className="space-y-2.5">
                {statsEntries.map(([category, value]) => (
                  <div key={category} className="text-xs">
                    <div className="flex justify-between text-gray-400 mb-1 text-[11px]">
                      <span className="font-semibold truncate pr-2">{category}</span>
                      <span className="font-mono text-cyan-400 font-bold">{value} XP</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-cyan-600 to-teal-400 h-full rounded-full" style={{ width: `${Math.min((value / 500) * 100, 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* СПИСОК КВЕСТОВ */}
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category} className="space-y-2">
                <h2 className="text-[10px] font-black text-gray-500 tracking-widest uppercase px-1">{category}</h2>
                <div className="space-y-2">
                  {quests.filter(q => q.category === category).map((quest) => {
                    const qId = quest._id || quest.id;
                    return (
                      <div key={qId} className={`p-4 rounded-xl flex justify-between items-center border transition-all ${quest.completed ? 'bg-gray-900/30 border-gray-950 opacity-30' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                        <div className="pr-4">
                          <h3 className={`font-bold text-sm ${quest.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{quest.title}</h3>
                          {quest.description && <p className="text-xs text-gray-400 mt-0.5">{quest.description}</p>}
                          <div className="flex gap-2 mt-1.5 text-[9px] font-bold font-mono">
                            <span className="text-cyan-400">+{quest.xp} XP</span>
                            <span className="text-amber-400">+{quest.gold} 💰</span>
                          </div>
                        </div>
                        <button onClick={() => completeQuest(qId)} disabled={quest.completed} className={`min-w-[65px] px-2 py-2.5 rounded-lg font-black text-xs transition-all ${quest.completed ? 'bg-gray-800 text-gray-600' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}>
                          {quest.completed ? '✓' : 'ЗАЧЕТ'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ЖУРНАЛ ЛОГОВ */}
          {logs.length > 0 && (
            <div className="bg-gray-900/50 rounded-2xl p-4 border border-gray-800/60 shadow-inner">
              <h3 className="text-[9px] font-black text-gray-500 tracking-widest uppercase mb-2">📜 ЛЕНТА СОБЫТИЙ</h3>
              <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[11px] text-gray-400">
                {logs.map((log, i) => (
                  <div key={i} className={`pl-2 border-l py-0.5 ${log.text?.includes('ЛЕВЕЛ') ? 'border-green-500 text-green-400 bg-green-500/5' : 'border-gray-800'}`}>{log.text}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ВКЛАДКА 2: МАГАЗИН --- */}
      {activeTab === 'shop' && (
        <div className="w-full max-w-md space-y-6">
          <div className="bg-gradient-to-r from-amber-500/10 to-yellow-600/5 rounded-2xl p-5 border border-amber-500/10 text-center">
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1">РЕСУРСЫ ДЛЯ ОБМЕНА</p>
            <h2 className="text-2xl font-black text-amber-300 font-mono">{profile.gold} ЗОЛОТА</h2>
          </div>
          <div className="space-y-2">
            {rewards.length > 0 ? rewards.map(reward => (
              <div key={reward.id} className="p-4 bg-gray-900 border border-gray-800 rounded-xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm text-gray-200">{reward.title}</h3>
                  <p className="text-xs text-amber-400 font-bold mt-1 font-mono">{reward.cost} 💰</p>
                </div>
                <button onClick={() => buyReward(reward.id)} disabled={profile.gold < reward.cost} className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${profile.gold >= reward.cost ? 'bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-lg' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>КУПИТЬ</button>
              </div>
            )) : <div className="text-center text-gray-600 py-10 text-xs font-mono">МАГАЗИН ПУСТ. ДОБАВЬТЕ НАГРАДЫ В КУЗНИЦЕ.</div>}
          </div>
        </div>
      )}

      {/* --- ВКЛАДКА 3: КУЗНИЦА --- */}
      {activeTab === 'forge' && (
        <div className="w-full max-w-md space-y-6">
          <form onSubmit={handleAddQuest} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <h3 className="text-xs font-black text-cyan-400 tracking-widest uppercase mb-4">Выковать новое достижение</h3>
            <input type="text" placeholder="Название цели" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 mb-3 border border-gray-700 text-sm focus:border-cyan-500 outline-none" />
            <input type="text" placeholder="Описание (детали)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 mb-3 border border-gray-700 text-sm focus:border-cyan-500 outline-none" />
            <div className="grid grid-cols-3 gap-3 mb-4">
              <input type="text" placeholder="Категория" list="existing-categories" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="col-span-1 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm focus:border-cyan-500 outline-none" />
              <datalist id="existing-categories">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
              <input type="number" placeholder="XP" required min="1" value={newXp} onChange={(e) => setNewXp(e.target.value)} className="bg-gray-800 text-white rounded-lg px-2 py-2 border border-gray-700 text-sm text-center focus:border-cyan-500 outline-none" />
              <input type="number" placeholder="Золото" required min="1" value={newGold} onChange={(e) => setNewGold(e.target.value)} className="bg-gray-800 text-white rounded-lg px-2 py-2 border border-gray-700 text-sm text-center focus:border-cyan-500 outline-none" />
            </div>
            <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black py-3 rounded-lg tracking-widest uppercase transition-all">Добавить квест</button>
          </form>

          <form onSubmit={handleAddReward} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <h3 className="text-xs font-black text-amber-400 tracking-widest uppercase mb-4">Добавить товар в магазин</h3>
            <div className="flex gap-3 mb-4">
              <input type="text" placeholder="Что купить за золото?" required value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm focus:border-cyan-500 outline-none" />
              <input type="number" placeholder="Цена" required min="1" value={newRewardCost} onChange={(e) => setNewRewardCost(e.target.value)} className="w-20 bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 text-sm text-center focus:border-cyan-500 outline-none" />
            </div>
            <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black py-3 rounded-lg tracking-widest uppercase transition-all">Создать награду</button>
          </form>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <h4 className="text-[9px] font-black text-red-400 tracking-wider uppercase mb-2">Удаление квестов</h4>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {quests.map(q => {
                  const qId = q._id || q.id;
                  return (
                    <div key={qId} className="flex justify-between items-center text-xs py-1 border-b border-gray-800/40"><span className="truncate text-gray-400 pr-2">{q.title}</span><button onClick={() => handleDeleteQuest(qId)} className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">✕</button></div>
                  );
                })}
              </div>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <h4 className="text-[9px] font-black text-amber-500 tracking-wider uppercase mb-2">Удаление наград</h4>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {rewards.map(r => (
                  <div key={r.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-800/40"><span className="truncate text-gray-400 pr-2">{r.title}</span><button onClick={() => handleDeleteReward(r.id)} className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">✕</button></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ТВОЯ НОВАЯ ВКЛАДКА 4: АНАЛИТИКА КРУГЛЫХ ГРАФИКОВ --- */}
      {activeTab === 'analytics' && (
        <div className="w-full max-w-md space-y-6">
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800/80 shadow-2xl flex flex-col items-center">
            <div className="w-full text-left mb-4">
              <h2 className="text-sm font-black text-purple-400 tracking-widest uppercase mb-1">📊 Сферы Влияния</h2>
              <p className="text-[11px] text-gray-400">Распределение заработанного опыта по жизненным кластерам</p>
            </div>
            
            {chartData && chartData.labels && chartData.labels.length > 0 ? (
              // Обертка с фиксированной высотой для стабильной работы холста Chart.js
              <div className="relative w-full h-64 mt-2">
                <canvas id="analyticsChart"></canvas>
              </div>
            ) : (
              <div className="text-center py-16 text-xs font-mono text-gray-500 tracking-wider uppercase animate-pulse">
                Летопись пуста. Зачтите хотя бы один квест для построения круговой матрицы!
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default App