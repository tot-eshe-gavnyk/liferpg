import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = 'https://liferpg-backend.onrender.com'
// const API_URL = 'http://localhost:8000'

function App() {
  const [profile, setProfile] = useState(null)
  const [xpToNext, setXpToNext] = useState(100)
  const [quests, setQuests] = useState([])
  const [rewards, setRewards] = useState([])
  const [logs, setLogs] = useState([])
  const [chartData, setChartData] = useState(null)
  const [dbCategories, setDbCategories] = useState([])
  
  const [ideas, setIdeas] = useState([])
  const [scripts, setScripts] = useState([])
  const [newIdeaText, setNewIdeaText] = useState('')
  const [newScriptTitle, setNewScriptTitle] = useState('')
  const [newScriptRules, setNewScriptRules] = useState('')
  
  const [activeTab, setActiveTab] = useState('play') 
  const [brainSubTab, setBrainSubTab] = useState('ideas') // ideas, scripts, chat
  const [forgeSubTab, setForgeSubTab] = useState('create') 

  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [showCatLevelUpModal, setShowCatLevelUpModal] = useState(false)
  const [newCatLevelData, setNewCatLevelData] = useState({ name: '', level: 1 })
  const [rank, setRank] = useState('⚔️ Новичок')

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newXp, setNewXp] = useState(15)
  const [newGold, setNewGold] = useState(15)
  const [newCategory, setNewCategory] = useState('')
  const [newSubcategory, setNewSubcategory] = useState('')
  const [newRequiresId, setNewRequiresId] = useState('')
  const [newIsDaily, setNewIsDaily] = useState(false)
  
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardDesc, setNewRewardDesc] = useState('')
  const [newRewardCost, setNewRewardCost] = useState(30)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  
  // СТЕЙТЫ ИИ И ЧАТА
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: 'Салют, Творец. Твой Кибер-Продюсер на связи. Матрицы синхронизированы, бэклог и лог событий у меня перед глазами. Какой проект сегодня штурмуем? Пиши сценарий, докрутим за секунду.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const triggerDailySync = async () => {
    try { await axios.post(`${API_URL}/sync_new_day`); } catch (e) { console.error("Sync error:", e) }
  }

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
      await triggerDailySync();
      const [profRes, questRes, catRes, rewRes, logsRes, chartRes, ideasRes, scriptsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/profile`),
        axios.get(`${API_URL}/quests`),
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/rewards`),
        axios.get(`${API_URL}/logs`),
        axios.get(`${API_URL}/analytics/categories`),
        axios.get(`${API_URL}/ideas`),
        axios.get(`${API_URL}/scripts`)
      ]);

      if (profRes.status === 'fulfilled') {
        const pData = profRes.value.data.profile || profRes.value.data;
        setProfile({ ...pData, category_levels: profRes.value.data.category_levels, current_multiplier: profRes.value.data.current_multiplier });
        setXpToNext(profRes.value.data.xp_to_next_level || pData.level * 100);
        setRank(pData.rank || '⚔️ Новичок');
      }
      if (catRes.status === 'fulfilled') {
        const loadedCats = catRes.value.data.categories || [];
        setDbCategories(loadedCats);
        if (!newCategory && loadedCats.length > 0) setNewCategory(loadedCats[0].name);
      }
      if (questRes.status === 'fulfilled') setQuests(questRes.value.data.quests || []);
      if (rewRes.status === 'fulfilled') setRewards(rewRes.value.data.rewards || []);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data.logs || []);
      if (chartRes.status === 'fulfilled') setChartData(chartRes.value.data);
      if (ideasRes.status === 'fulfilled') setIdeas(ideasRes.value.data.ideas || []);
      if (scriptsRes.status === 'fulfilled') setScripts(scriptsRes.value.data.scripts || []);
    } catch (error) { console.error("Sync error:", error) }
  }

  useEffect(() => { fetchData() }, [])

  // ОТПРАВКА СООБЩЕНИЯ В КИБЕР-ЧАТ С ИИ
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    // Добавляем сообщение пользователя на экран мгновенно
    const updatedHistory = [...chatMessages, { role: 'user', text: userMessage }];
    setChatMessages(updatedHistory);
    setIsChatLoading(true);
    playRetroSound('click');

    try {
      // Отправляем всю историю + новое сообщение на сервер
      const res = await axios.post(`${API_URL}/ai_chat`, {
        history: chatMessages,
        message: userMessage
      });
      
      setChatMessages([...updatedHistory, { role: 'model', text: res.data.reply }]);
      playRetroSound('coin');
    } catch (error) {
      const errMsg = error.response?.data?.detail || "Продюсер потерял связь с базой данных.";
      alert(`❌ ${errMsg}`);
    } finally {
      setIsChatLoading(false);
    }
  }

  const handleGenerateAIQuest = async () => {
    setIsAiLoading(true);
    try {
      const selectedCategory = newCategory || (dbCategories.length > 0 ? dbCategories[0].name : "✨ Разное");
      const res = await axios.get(`${API_URL}/generate_ai_quest?category=${encodeURIComponent(selectedCategory)}`);
      const aiData = res.data.quest;
      
      setNewTitle(aiData.title);
      setNewDesc(aiData.description);
      setNewXp(aiData.xp);
      setNewGold(aiData.gold);
      setNewCategory(selectedCategory); 
      
      playRetroSound('levelup');
    } catch (error) {
      const errMsg = error.response?.data?.detail || "Ошибка связи с кибер-мозгом.";
      alert(`❌ ${errMsg}`);
    } finally {
      setIsAiLoading(false);
    }
  }

  const handleAddIdea = async (e) => {
    e.preventDefault(); if (!newIdeaText) return;
    try {
      await axios.post(`${API_URL}/add_idea`, { text: newIdeaText });
      setNewIdeaText(''); fetchData(); playRetroSound('click');
    } catch (error) { alert("❌ Ошибка соединения!"); }
  }

  const handleAddScript = async (e) => {
    e.preventDefault(); if (!newScriptTitle) return;
    try {
      await axios.post(`${API_URL}/add_script`, { title: newScriptTitle, rules: newScriptRules });
      setNewScriptTitle(''); setNewScriptRules(''); fetchData(); playRetroSound('levelup');
    } catch (error) { alert("❌ Ошибка соединения!"); }
  }

  const completeQuest = async (quest) => {
    const res = await axios.post(`${API_URL}/complete_quest`, { quest_id: quest.id });
    if (res.data.level_up) { playRetroSound('levelup'); setShowLevelUpModal(true); } 
    else if (res.data.cat_level_up) {
      playRetroSound('levelup');
      const currentCatLevel = profile?.category_levels?.[quest.category]?.level || 1;
      setNewCatLevelData({ name: quest.category, level: currentCatLevel + 1 });
      setShowCatLevelUpModal(true);
    } else { playRetroSound('click'); }
    fetchData();
  }

  const handleAddQuest = async (e) => {
    e.preventDefault(); if (!newTitle) return;
    const finalCategory = newCategory || (dbCategories.length > 0 ? dbCategories[0].name : "✨ Разное");
    await axios.post(`${API_URL}/add_quest`, {
      title: newTitle, description: newDesc, xp: Number(newXp), gold: Number(newGold), 
      category: finalCategory, subcategory: newSubcategory, requires_id: newRequiresId, is_daily: newIsDaily
    });
    setNewTitle(''); setNewDesc(''); setNewRequiresId(''); setNewIsDaily(false); setNewSubcategory('');
    fetchData(); setForgeSubTab('manage'); setActiveTab('play');
  }

  const handleAddReward = async (e) => { e.preventDefault(); if (!newRewardTitle) return; await axios.post(`${API_URL}/add_reward`, { title: newRewardTitle, description: newRewardDesc, cost: Number(newRewardCost) }); setNewRewardTitle(''); setNewRewardDesc(''); fetchData(); }
  const handleAddCategory = async (e) => { e.preventDefault(); if (!newCategoryInput) return; await axios.post(`${API_URL}/add_category`, { name: newCategoryInput }); setNewCategoryInput(''); fetchData(); }

  const handleDeleteQuest = async (id) => { await axios.delete(`${API_URL}/delete_quest/${id}`); fetchData(); }
  const handleDeleteCategory = async (id) => { await axios.delete(`${API_URL}/delete_category/${id}`); fetchData(); }
  const handleDeleteReward = async (id) => { await axios.delete(`${API_URL}/delete_reward/${id}`); fetchData(); }
  const handleDeleteIdea = async (id) => { await axios.delete(`${API_URL}/delete_idea/${id}`); fetchData(); }
  const handleDeleteScript = async (id) => { await axios.delete(`${API_URL}/delete_script/${id}`); fetchData(); }

  const buyReward = async (id) => { const res = await axios.post(`${API_URL}/buy_reward`, { reward_id: id }); if (res.data.status === "success") { playRetroSound('coin'); fetchData(); } }
  const useInventoryItem = async (title) => { const res = await axios.post(`${API_URL}/use_item`, { item_title: title }); if (res.data.status === "success") { playRetroSound('click'); fetchData(); } }

  useEffect(() => {
    if (activeTab === 'forge' && forgeSubTab === 'logs' && chartData?.labels?.length > 0) {
      setTimeout(() => {
        const ctx = document.getElementById('analyticsChart')?.getContext('2d');
        if (!ctx) return;
        if (window.currentLiferpgChart) window.currentLiferpgChart.destroy();
        window.currentLiferpgChart = new window.Chart(ctx, {
          type: 'doughnut',
          data: { labels: chartData.labels, datasets: [{ data: chartData.xp_distribution, backgroundColor: ['#2dd4bf', '#a78bfa', '#fb923c', '#f43f5e', '#38bdf8', '#a3e635'], borderWidth: 0, hoverOffset: 8 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '82%', plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', padding: 25, usePointStyle: true, font: { size: 12, family: 'system-ui' } } } } }
        });
      }, 100);
    }
  }, [activeTab, forgeSubTab, chartData]);

  if (!profile) return (<div className="min-h-screen bg-[#020617] flex items-center justify-center text-teal-400/50 font-mono tracking-[0.3em] text-xs animate-pulse">ИНИЦИАЛИЗАЦИЯ ИИ...</div>)

  const progressPercent = Math.min((profile.current_xp / xpToNext) * 100, 100)
  const hpPercent = Math.min((profile.hp / profile.max_hp) * 100, 100)
  const getSortedQuests = (catName) => { return quests.filter(q => (q.category || '✨ Разное') === catName).sort((a, b) => { if (a.completed && !b.completed) return 1; if (!a.completed && b.completed) return -1; return 0; }); };
  const activeQuestCategories = [...new Set(quests.map(q => q.category || '✨ Разное'))];
  const currentCategoryForForge = newCategory || (dbCategories.length > 0 ? dbCategories[0].name : "✨ Разное");
  const availableSubcategories = [...new Set(quests.filter(q => (q.category || '✨ Разное') === currentCategoryForForge && q.subcategory).map(q => q.subcategory))];

  return (
    <div className="relative min-h-screen bg-[#040914] text-slate-200 flex flex-col items-center py-6 px-4 font-sans pb-28 overflow-x-hidden selection:bg-teal-500/30">
      
      {/* ФОНОВЫЕ СВЕЧЕНИЯ */}
      <div className="fixed top-[-10%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-teal-600/10 blur-[120px] pointer-events-none mix-blend-screen"></div>
      <div className="fixed bottom-[-10%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none mix-blend-screen"></div>

      {/* МОДАЛКИ */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 border border-white/20 rounded-[2rem] p-10 max-w-sm w-full text-center shadow-[0_0_80px_rgba(45,212,191,0.2)] backdrop-blur-2xl">
            <div className="text-7xl mb-6 drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]">✨</div>
            <h2 className="text-3xl font-light text-white mb-2 tracking-wide">Новая Ступень</h2>
            <p className="text-slate-300 font-light mb-8">Матрица признала ваши заслуги. Достигнут <span className="text-teal-400 font-semibold">{profile.level} уровень</span>.</p>
            <button onClick={() => setShowLevelUpModal(false)} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-4 rounded-2xl text-sm font-medium tracking-wider transition-all shadow-lg backdrop-blur-md">Продолжить Путь</button>
          </div>
        </div>
      )}

      {showCatLevelUpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 border border-white/20 rounded-[2rem] p-10 max-w-sm w-full text-center shadow-[0_0_80px_rgba(167,139,250,0.2)] backdrop-blur-2xl">
            <div className="text-7xl mb-6 drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]">🔮</div>
            <h2 className="text-3xl font-light text-white mb-2 tracking-wide">Ветвь Развита</h2>
            <p className="text-slate-300 font-light mb-8">Направление <span className="text-purple-400 font-semibold">{newCatLevelData.name}</span> достигло {newCatLevelData.level} уровня!</p>
            <button onClick={() => setShowCatLevelUpModal(false)} className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-4 rounded-2xl text-sm font-medium tracking-wider transition-all shadow-lg backdrop-blur-md">Принять Силу</button>
          </div>
        </div>
      )}

      {/* ЭКРАН 1: КВЕСТЫ */}
      {activeTab === 'play' && (
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden group mb-8 mt-2">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl group-hover:bg-teal-400/30 transition-all duration-1000"></div>
            <div className="flex justify-between items-start relative z-10 mb-5">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-light text-white tracking-tight">Творец</h1>
                  {profile.streak > 0 && <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-widest">🔥 x{profile.current_multiplier?.toFixed(2)}</span>}
                </div>
                <p className="text-xs text-teal-400 font-medium tracking-widest uppercase">{rank} • {profile.level} УРОВЕНЬ</p>
              </div>
              <div className="ml-5 bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-center backdrop-blur-md shadow-inner min-w-[80px]">
                <span className="block text-[9px] font-semibold text-slate-400 tracking-widest mb-1.5 uppercase">Золото</span>
                <span className="text-2xl font-light text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.4)]">{profile.gold}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                  <span>Опыт</span>
                  <span>{profile.current_xp} / {xpToNext}</span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-1.5 border border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-emerald-300 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(45,212,191,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                  <span>Здоровье (HP)</span>
                  <span className={profile.hp < 50 ? 'text-rose-400' : ''}>{profile.hp} / {profile.max_hp}</span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-1.5 border border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(225,29,72,0.5)]" style={{ width: `${hpPercent}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {activeQuestCategories.map(category => {
              const catData = profile.category_levels?.[category] || { level: 1, percent: 0, is_maxed: false };
              const isDefaultOpen = category === '🔥 Дейлики' || category.toLowerCase().includes('дейлик');
              const catQuests = getSortedQuests(category);
              const groupedQuests = catQuests.reduce((acc, quest) => { const sub = quest.subcategory || ''; if (!acc[sub]) acc[sub] = []; acc[sub].push(quest); return acc; }, {});
              const sortedSubcategories = Object.keys(groupedQuests).sort((a, b) => { if (a === '') return -1; if (b === '') return 1; return a.localeCompare(b); });
              
              return (
                <details key={category} open={isDefaultOpen} className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-sm transition-all duration-300 open:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
                  <summary className="flex items-center justify-between p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden outline-none">
                    <div>
                      <h2 className="text-base font-medium text-white tracking-wide group-open:text-teal-300 transition-colors">{category}</h2>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{catData.is_maxed ? 'Максимальный уровень' : `Ступень ${catData.level}`}</p>
                    </div>
                    <div className="flex items-center gap-5">
                      {!catData.is_maxed && (
                        <div className="w-20 text-right opacity-0 group-open:opacity-100 transition-opacity duration-300 hidden sm:block">
                           <span className="text-[9px] text-slate-400 font-medium mb-1.5 inline-block tracking-widest">{catData.percent}%</span>
                           <div className="w-full bg-black/30 border border-white/5 rounded-full h-1 overflow-hidden">
                             <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full" style={{ width: `${catData.percent}%` }}></div>
                           </div>
                        </div>
                      )}
                      <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="px-5 pb-6 border-t border-white/5 pt-5 space-y-6">
                    {catQuests.length === 0 ? (
                      <div className="text-center text-slate-500 text-xs py-4 font-light tracking-widest uppercase">Нет задач</div>
                    ) : (
                      sortedSubcategories.map(sub => (
                        <div key={sub} className="space-y-3">
                          {sub && (
                            <div className="flex items-center gap-3 mb-4 px-2">
                              <span className="h-px bg-white/10 w-4"></span>
                              <h4 className="text-[9px] text-teal-400/60 font-medium uppercase tracking-[0.25em]">{sub}</h4>
                              <span className="h-px bg-white/10 flex-1"></span>
                            </div>
                          )}
                          {groupedQuests[sub].map((quest) => {
                            const parentQuest = quest.requires_id ? quests.find(q => q.id === quest.requires_id) : null;
                            const isLocked = parentQuest && !parentQuest.completed;
                            return (
                              <div key={quest.id} className={`p-5 rounded-2xl flex justify-between items-center transition-all duration-500 backdrop-blur-md ${quest.completed ? 'bg-white/5 border border-transparent opacity-40 grayscale' : isLocked ? 'bg-black/20 border border-white/5 opacity-50' : 'bg-white/10 border border-white/10 hover:bg-white/15 shadow-sm'}`}>
                                <div className="pr-4 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    {isLocked && <span className="text-[9px] text-slate-400 bg-black/40 border border-white/5 px-2.5 py-1 rounded-full font-medium tracking-wide">🔒 Ждет: {parentQuest?.title || '...'}</span>}
                                    {quest.is_daily && <span className="text-[9px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full font-medium tracking-wide">🔥 Дейлик</span>}
                                  </div>
                                  <h3 className={`text-[15px] font-medium tracking-wide ${quest.completed ? 'text-slate-500 line-through' : isLocked ? 'text-slate-500' : 'text-slate-100'}`}>{quest.title}</h3>
                                  {quest.description && <p className="text-[11px] text-slate-400/80 mt-1 line-clamp-2 font-light">{quest.description}</p>}
                                </div>
                                <div className="flex flex-col items-end justify-center gap-2 min-w-[75px]">
                                  {!quest.completed && (
                                    <div className="text-[10px] font-medium flex gap-2 tracking-wide mb-0.5">
                                      <span className={isLocked ? 'text-slate-600' : 'text-teal-300/90'}>{quest.xp} XP</span>
                                      <span className={isLocked ? 'text-slate-600' : 'text-amber-300/90'}>{quest.gold} G</span>
                                    </div>
                                  )}
                                  <button onClick={() => completeQuest(quest)} disabled={quest.completed || isLocked} className={`px-4 py-2 rounded-lg text-[10px] font-medium tracking-widest uppercase transition-all duration-300 ${quest.completed ? 'bg-transparent text-slate-600' : isLocked ? 'bg-black/30 text-slate-600 border border-white/5' : 'bg-white/10 text-white hover:bg-white border border-white/20 hover:text-black shadow-md backdrop-blur-sm'}`}>
                                    {quest.completed ? 'Сдано' : isLocked ? 'Блок' : 'Зачет'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* ЭКРАН 2: ВТОРОЙ МОЗГ (ТЕПЕРЬ С ЧАТОМ АССИСТЕНТА) */}
      {activeTab === 'brain' && (
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-light text-white mb-6 tracking-wide text-center mt-2">🧠 Второй Мозг</h2>
          
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mb-6">
            <button onClick={() => setBrainSubTab('ideas')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium tracking-widest uppercase transition-all ${brainSubTab === 'ideas' ? 'bg-white/15 text-teal-300 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Бэклог</button>
            <button onClick={() => setBrainSubTab('scripts')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium tracking-widest uppercase transition-all ${brainSubTab === 'scripts' ? 'bg-white/15 text-purple-300 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Сценарии</button>
            <button onClick={() => setBrainSubTab('chat')} className={`flex-1 py-2 rounded-lg text-[11px] font-medium tracking-widest uppercase transition-all ${brainSubTab === 'chat' ? 'bg-white/15 text-amber-300 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>🤖 Чат</button>
          </div>

          {brainSubTab === 'ideas' && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-7">
              <form onSubmit={handleAddIdea} className="flex gap-2 mb-8 border-b border-white/10 pb-6">
                <input type="text" placeholder="Быстрая мысль..." required value={newIdeaText} onChange={(e) => setNewIdeaText(e.target.value)} className="flex-1 bg-black/20 text-teal-100 rounded-xl px-5 py-4 border border-teal-500/20 text-sm focus:border-teal-500/50 outline-none font-light placeholder:text-teal-800/50" />
                <button type="submit" className="bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 border border-teal-500/30 px-6 rounded-xl text-lg transition-all">+</button>
              </form>
              <div className="space-y-3">
                {ideas.length === 0 ? <div className="text-center text-slate-500 text-xs py-4 font-light tracking-widest uppercase">Бэклог пуст</div> : 
                  ideas.map(idea => (
                    <div key={idea.id} className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-xl hover:bg-white/10 transition-colors">
                      <span className="text-xs text-slate-200 font-light pr-4">{idea.text}</span>
                      <button onClick={() => handleDeleteIdea(idea.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5 transition-colors">Удалить</button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {brainSubTab === 'scripts' && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-7">
              <form onSubmit={handleAddScript} className="space-y-3 mb-8">
                <input type="text" placeholder="Название шоу..." required value={newScriptTitle} onChange={(e) => setNewScriptTitle(e.target.value)} className="w-full bg-black/20 text-slate-200 rounded-xl px-5 py-4 border border-white/10 text-sm focus:border-white/30 outline-none font-light" />
                <textarea placeholder="Правила на день (24 часа)..." required value={newScriptRules} onChange={(e) => setNewScriptRules(e.target.value)} className="w-full bg-black/20 text-slate-300 rounded-xl px-5 py-4 border border-white/10 text-xs min-h-[100px] focus:border-white/30 outline-none font-light custom-scrollbar" />
                <button type="submit" className="w-full bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 border border-purple-500/30 text-xs font-medium uppercase py-4 rounded-xl transition-all duration-300">Сохранить сценарий</button>
              </form>
              <div className="space-y-4 border-t border-white/10 pt-6">
                {scripts.length === 0 ? <div className="text-center text-slate-500 text-xs py-4 font-light tracking-widest uppercase">Нет сценариев</div> : 
                  scripts.map(script => (
                    <div key={script.id} className="bg-black/30 border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-medium text-purple-300 tracking-wide">{script.title}</h3>
                        <button onClick={() => handleDeleteScript(script.id)} className="text-[10px] text-slate-500 hover:text-red-400 transition-all">✖</button>
                      </div>
                      <p className="text-xs text-slate-300 font-light whitespace-pre-wrap leading-relaxed">{script.rules}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* НОВЫЙ ИНТЕРФЕЙС КИБЕР-ЧАТА */}
          {brainSubTab === 'chat' && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 flex flex-col h-[65vh] relative overflow-hidden shadow-inner">
              
              {/* Лента сообщений */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 custom-scrollbar flex flex-col pt-2">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed font-light ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-teal-500/20 to-teal-600/10 border border-teal-500/30 text-teal-100 rounded-br-none shadow-sm' 
                        : 'bg-black/40 border border-white/5 text-slate-200 rounded-bl-none shadow-inner whitespace-pre-wrap'
                    }`}>
                      {msg.role !== 'user' && <span className="block text-[8px] uppercase tracking-wider font-bold text-amber-400 mb-1">Правая рука</span>}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start animate-pulse">
                    <div className="bg-black/40 border border-white/5 text-amber-300/60 rounded-2xl rounded-bl-none px-4 py-3 text-[10px] font-mono tracking-widest uppercase">
                      Продюсер пишет сценарий...
                    </div>
                  </div>
                )}
              </div>

              {/* Форма отправки */}
              <form onSubmit={handleSendChatMessage} className="flex gap-2 bg-black/30 p-1.5 rounded-xl border border-white/10 backdrop-blur-md">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Прикажи или спроси..."
                  disabled={isChatLoading}
                  className="flex-1 bg-transparent text-slate-200 px-3 py-3 text-xs outline-none font-light placeholder:text-slate-600"
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isChatLoading}
                  className={`px-5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    chatInput.trim() && !isChatLoading
                      ? 'bg-amber-400 text-black hover:bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]' 
                      : 'bg-white/5 text-slate-600 border border-white/5'
                  }`}
                >
                  📡
                </button>
              </form>

            </div>
          )}
        </div>
      )}

      {/* ЭКРАН 3: МАГАЗИН */}
      {activeTab === 'shop' && (
        <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] mt-2">
            <p className="text-[10px] text-amber-300/60 font-medium mb-3 uppercase tracking-[0.2em]">Доступные средства</p>
            <h2 className="text-5xl font-light text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.3)]">{profile.gold}</h2>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white px-2 tracking-wide">🎒 Мой Рюкзак</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(profile.inventory || {}).map(([itemTitle, count]) => (
                <div key={itemTitle} className="bg-purple-900/10 backdrop-blur-md border border-purple-500/20 p-4 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xs font-medium text-purple-200 mb-1">{itemTitle}</span>
                  <span className="text-[10px] text-purple-400/80 mb-3">В наличии: {count} шт.</span>
                  <button onClick={() => useInventoryItem(itemTitle)} className="bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 text-purple-100 text-[10px] py-1.5 px-4 rounded-xl transition-colors">Активировать</button>
                </div>
              ))}
              {Object.keys(profile.inventory || {}).length === 0 && (
                <div className="col-span-2 text-center text-slate-600 text-xs py-6 font-light uppercase tracking-widest border border-dashed border-white/10 rounded-2xl">Рюкзак пуст</div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white px-2 tracking-wide">🛒 Витрина Наград</h3>
            <div className="space-y-3">
              {rewards.map(reward => (
                <div key={reward.id} className="p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex justify-between items-center hover:bg-white/10 transition-all duration-300">
                  <div className="pr-4">
                    <h3 className="font-light text-base text-slate-100 tracking-wide">{reward.title}</h3>
                    {reward.description && <p className="text-[11px] text-slate-400/80 mt-1 line-clamp-2 font-light">{reward.description}</p>}
                    <p className="text-xs text-amber-300/80 font-medium mt-2 tracking-wide">{reward.cost} G</p>
                  </div>
                  <button onClick={() => buyReward(reward.id)} disabled={profile.gold < reward.cost} className={`px-6 py-2.5 rounded-xl text-[10px] font-medium tracking-widest uppercase transition-all duration-300 ${profile.gold >= reward.cost ? 'bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.4)]' : 'bg-black/30 text-slate-600 border border-white/5'}`}>Купить</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ЭКРАН 4: БАЗА (КУЗНИЦА / УПРАВЛЕНИЕ / ЛОГИ) */}
      {activeTab === 'forge' && (
        <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-light text-white mb-6 tracking-wide text-center mt-2">⚙️ Ядро Базы</h2>

          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 mb-6">
            <button onClick={() => setForgeSubTab('create')} className={`flex-1 py-2 rounded-lg text-[10px] font-medium tracking-widest uppercase transition-all ${forgeSubTab === 'create' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Создать</button>
            <button onClick={() => setForgeSubTab('manage')} className={`flex-1 py-2 rounded-lg text-[10px] font-medium tracking-widest uppercase transition-all ${forgeSubTab === 'manage' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Управление</button>
            <button onClick={() => setForgeSubTab('logs')} className={`flex-1 py-2 rounded-lg text-[10px] font-medium tracking-widest uppercase transition-all ${forgeSubTab === 'logs' ? 'bg-white/15 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Аналитика</button>
          </div>

          {forgeSubTab === 'create' && (
            <div className="space-y-6">
              {/* ФОРМА 1: КВЕСТ + ИИ */}
              <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 relative overflow-hidden">
                <h3 className="text-sm font-medium text-white mb-6 tracking-wide uppercase">Добавить Задачу</h3>
                
                <button 
                  onClick={handleGenerateAIQuest} 
                  disabled={isAiLoading}
                  className="w-full mb-6 bg-gradient-to-r from-teal-500/20 to-purple-500/20 hover:from-teal-500/30 hover:to-purple-500/30 border border-teal-500/30 text-teal-100 text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(45,212,191,0.1)] flex items-center justify-center gap-2"
                >
                  {isAiLoading ? 'Мозг думает...' : '✨ Сгенерировать ИИ-Квест'}
                </button>

                <form onSubmit={handleAddQuest}>
                  <div className="space-y-4 mb-6">
                    <input type="text" placeholder="Название..." required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-black/20 text-slate-200 rounded-xl px-5 py-4 border border-white/10 text-sm focus:border-white/30 outline-none font-light" />
                    <textarea placeholder="Детали или шаги (опционально)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-black/20 text-slate-300 rounded-xl px-5 py-4 border border-white/10 text-xs min-h-[90px] focus:border-white/30 outline-none font-light custom-scrollbar" />
                  </div>
                  <div className="flex gap-3 mb-2">
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-1/2 bg-black/20 text-slate-300 rounded-xl px-4 py-3.5 border border-white/10 text-sm focus:border-white/30 outline-none appearance-none font-light">
                      {dbCategories.map(c => <option key={c.id} value={c.name} className="bg-slate-900">{c.name}</option>)}
                      {dbCategories.length === 0 && <option value="✨ Разное" className="bg-slate-900">✨ Разное</option>}
                    </select>
                    <input type="text" placeholder="Подкатегория" value={newSubcategory} onChange={(e) => setNewSubcategory(e.target.value)} className="w-1/2 bg-black/20 text-teal-300 rounded-xl px-4 py-3.5 border border-white/10 text-xs outline-none font-light" />
                  </div>
                  {availableSubcategories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-5 px-1">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest mr-1">Быстрый выбор:</span>
                      {availableSubcategories.map(sub => (
                        <button key={sub} type="button" onClick={() => setNewSubcategory(sub)} className="text-[9px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-slate-300 hover:text-teal-300 hover:border-teal-500/30 transition-all font-medium">{sub}</button>
                      ))}
                    </div>
                  )}
                  {availableSubcategories.length === 0 && <div className="mb-5"></div>}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <input type="number" placeholder="XP" required min="1" value={newXp} onChange={(e) => setNewXp(e.target.value)} className="w-full bg-black/20 text-teal-300 rounded-xl px-4 py-3.5 border border-white/10 text-sm focus:border-white/30 outline-none font-light" />
                    <input type="number" placeholder="Gold" required min="1" value={newGold} onChange={(e) => setNewGold(e.target.value)} className="w-full bg-black/20 text-amber-300 rounded-xl px-4 py-3.5 border border-white/10 text-sm focus:border-white/30 outline-none font-light" />
                  </div>
                  <div className="mb-6">
                    <select value={newRequiresId} onChange={(e) => setNewRequiresId(e.target.value)} className="w-full bg-black/20 text-slate-400 rounded-xl px-4 py-3.5 border border-white/10 text-xs focus:border-white/30 outline-none appearance-none font-light">
                      <option value="" className="bg-slate-900">Без зависимости (Доступен сразу)</option>
                      {quests.map(q => <option key={q.id} value={q.id} className="bg-slate-900">Ждать: {q.title}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-3 mb-8 p-4 rounded-xl bg-black/20 border border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
                    <input type="checkbox" checked={newIsDaily} onChange={(e) => setNewIsDaily(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-black/50 text-teal-500 focus:ring-0" />
                    <span className="text-xs text-slate-300 font-light">Ежедневный респаун (Дейлик)</span>
                  </label>
                  <button type="submit" className="w-full bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-xs font-medium uppercase py-4 rounded-xl transition-all shadow-lg">Создать квест</button>
                </form>
              </div>

              {/* ФОРМА 2: КАТЕГОРИИ И НАГРАДЫ */}
              <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10">
                <h3 className="text-sm font-medium text-white mb-5 tracking-wide uppercase">Добавить Путь (Категорию)</h3>
                <form onSubmit={handleAddCategory} className="flex gap-3 mb-8">
                  <input type="text" placeholder="Новый Путь..." required value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="flex-1 bg-black/20 text-slate-200 rounded-xl px-5 py-3.5 border border-white/10 text-xs focus:border-white/30 outline-none font-light" />
                  <button type="submit" className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 rounded-xl text-sm font-light transition-colors">+</button>
                </form>
                <h3 className="text-sm font-medium text-white mb-4 tracking-wide text-center border-t border-white/10 pt-6 uppercase">Добавить Награду в Магазин</h3>
                <form onSubmit={handleAddReward} className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <input type="text" placeholder="Название награды..." required value={newRewardTitle} onChange={(e) => setNewRewardTitle(e.target.value)} className="flex-1 bg-black/20 text-slate-200 rounded-xl px-5 py-3.5 border border-white/10 text-xs focus:border-white/30 outline-none font-light" />
                    <input type="number" placeholder="Цена" required min="1" value={newRewardCost} onChange={(e) => setNewRewardCost(e.target.value)} className="w-24 bg-black/20 text-amber-300 rounded-xl px-4 py-3.5 border border-white/10 text-xs text-center outline-none font-light" />
                  </div>
                  <textarea placeholder="Опиши ценность и правила..." value={newRewardDesc} onChange={(e) => setNewRewardDesc(e.target.value)} className="w-full bg-black/20 text-slate-300 rounded-xl px-5 py-3 border border-white/10 text-xs min-h-[60px] focus:border-white/30 outline-none font-light custom-scrollbar" />
                  <button type="submit" className="bg-white/10 hover:bg-white/20 border border-white/10 text-white py-3 rounded-xl text-xs font-light transition-colors w-full uppercase tracking-widest mt-2">Добавить награду</button>
                </form>
              </div>
            </div>
          )}

          {forgeSubTab === 'manage' && (
            <div className="space-y-3">
              <details className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden group" open>
                <summary className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:text-white group-open:bg-white/5 transition-colors">Удаление Задач</summary>
                <div className="px-6 pb-5 max-h-60 overflow-y-auto space-y-3 border-t border-white/10 pt-4 custom-scrollbar">
                  {quests.map(q => (<div key={q.id} className="flex justify-between items-center"><span className="text-xs text-slate-400 truncate pr-3 font-light">{q.title}</span><button onClick={() => handleDeleteQuest(q.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 px-3 py-1.5 bg-black/30 rounded-lg border border-white/5 transition-colors">Удалить</button></div>))}
                </div>
              </details>
              <details className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden group">
                <summary className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:text-white group-open:bg-white/5 transition-colors">Удаление Ветвей</summary>
                <div className="px-6 pb-5 max-h-48 overflow-y-auto space-y-3 border-t border-white/10 pt-4 custom-scrollbar">
                  {dbCategories.map(c => (<div key={c.id} className="flex justify-between items-center"><span className="text-xs text-slate-400 truncate pr-3 font-light">{c.name}</span><button onClick={() => handleDeleteCategory(c.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 px-3 py-1.5 bg-black/30 rounded-lg border border-white/5 transition-colors">Удалить</button></div>))}
                </div>
              </details>
              <details className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden group">
                <summary className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest cursor-pointer select-none group-open:text-white group-open:bg-white/5 transition-colors">Удаление из Магазина</summary>
                <div className="px-6 pb-5 max-h-48 overflow-y-auto space-y-3 border-t border-white/10 pt-4 custom-scrollbar">
                  {rewards.map(r => (<div key={r.id} className="flex justify-between items-center"><span className="text-xs text-slate-400 truncate pr-3 font-light">{r.title}</span><button onClick={() => handleDeleteReward(r.id)} className="text-[10px] font-medium text-slate-500 hover:text-red-400 px-3 py-1.5 bg-black/30 rounded-lg border border-white/5 transition-colors">Удалить</button></div>))}
                </div>
              </details>
            </div>
          )}

          {forgeSubTab === 'logs' && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-7 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
                <h2 className="text-sm font-light text-white mb-8 tracking-wide text-center uppercase">Распределение опыта</h2>
                {chartData?.labels?.length > 0 ? (
                  <div className="relative w-full h-72"><canvas id="analyticsChart"></canvas></div>
                ) : (<div className="text-center py-16 text-xs text-slate-500 font-light tracking-widest uppercase">Нет данных для анализа</div>)}
              </div>
              <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-7 border border-white/10">
                <h3 className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-5">Системный Журнал</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {logs.map(log => (<div key={log.id} className="text-[11px] text-slate-400 border-l border-white/10 pl-4 py-1 font-light tracking-wide">{log.text}</div>))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* НИЖНЯЯ ПАНЕЛЬ НАВИГАЦИИ */}
      <nav className="fixed bottom-0 w-full max-w-md bg-[#040914]/80 backdrop-blur-2xl border-t border-white/10 z-50 px-6 py-4 flex justify-between items-center pb-safe">
        <button onClick={() => setActiveTab('play')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 w-16 ${activeTab === 'play' ? 'text-teal-400 scale-110 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <span className="text-xl">⚔️</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Квесты</span>
        </button>
        <button onClick={() => setActiveTab('brain')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 w-16 ${activeTab === 'brain' ? 'text-purple-400 scale-110 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <span className="text-xl">🧠</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Идеи</span>
        </button>
        <button onClick={() => setActiveTab('shop')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 w-16 ${activeTab === 'shop' ? 'text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <span className="text-xl">🛒</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">Магазин</span>
        </button>
        <button onClick={() => setActiveTab('forge')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 w-16 ${activeTab === 'forge' ? 'text-slate-200 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}>
          <span className="text-xl">⚙️</span>
          <span className="text-[8px] font-bold tracking-widest uppercase">База</span>
        </button>
      </nav>

    </div>
  )
}

export default App