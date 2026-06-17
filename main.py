import os
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson.objectid import ObjectId
import google.generativeai as genai # Импорт ИИ

# ==========================================
# 1. ИНИЦИАЛИЗАЦИЯ ЯДРА И CORS
# ==========================================
app = FastAPI(title="LifeRPG Engine - Cyberbrain Edition")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. ПОДКЛЮЧЕНИЕ К БАЗАМ ДАННЫХ И ИИ
# ==========================================
MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

try:
    client = MongoClient(MONGO_URI)
    db = client["liferpg_cloud"]
    profile_collection = db["game_data"]
    quests_collection = db["quests"]
    rewards_collection = db["rewards"]
    logs_collection = db["logs"]
    history_collection = db["history"] 
    categories_collection = db["categories"] 
    ideas_collection = db["ideas"]
    scripts_collection = db["scripts"]
    print("🚀 MongoDB подключена.")
except Exception as e:
    print(f"⚠️ Ошибка БД: {e}")

try:
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        # Устанавливаем актуальную модель поколения 2026 года
        ai_model = genai.GenerativeModel('gemini-3.5-flash')
        print("🧠 Нейросеть Gemini 3.5 успешно подключена!")
    else:
        print("⚠️ GEMINI_API_KEY не найден в переменной окружения Render!")
except Exception as e:
    print(f"⚠️ Ошибка инициализации ИИ: {e}")

# ==========================================
# 3. PYDANTIC МОДЕЛИ
# ==========================================
class QuestCreateInput(BaseModel):
    title: str
    description: str = ""
    xp: int = 15
    gold: int = 15
    category: str = "✨ Разное"
    subcategory: str = ""  
    requires_id: str = ""  
    is_daily: bool = False 

class CompleteQuestInput(BaseModel):
    quest_id: str

class RewardCreateInput(BaseModel):
    title: str
    cost: int = 30
    description: str | None = None

class BuyRewardInput(BaseModel):
    reward_id: str

class CategoryCreateInput(BaseModel):
    name: str 

class UseItemInput(BaseModel):
    item_title: str

class IdeaCreateInput(BaseModel):
    text: str

class ScriptCreateInput(BaseModel):
    title: str
    rules: str

# ==========================================
# 4. МАТЕМАТИКА И ЯДРО ПРОФИЛЯ
# ==========================================
def get_rank_by_level(level: int) -> str:
    if level >= 20: return "🌌 Архитектор Матрицы"
    if level >= 15: return "👑 Легенда"
    if level >= 10: return "🦅 Магистр"
    if level >= 5:  return "🛡️ Рыцарь"
    return "⚔️ Новичок"

def calculate_category_progress(xp: int):
    level = (xp // 100) + 1
    if level >= 10:
        return {"level": 10, "current_xp_in_level": 100, "xp_needed_for_next": 100, "percent": 100, "is_maxed": True}
    current_xp_in_level = xp % 100
    return {"level": level, "current_xp_in_level": current_xp_in_level, "xp_needed_for_next": 100, "percent": int((current_xp_in_level / 100) * 100), "is_maxed": False}

def get_or_create_profile():
    profile = profile_collection.find_one({"_id": "main_profile"})
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    if not profile:
        profile = {"_id": "main_profile", "name": "Творец", "level": 1, "current_xp": 0, "gold": 0, "rank": "⚔️ Новичок", "streak": 0, "stats": {}, "hp": 100, "max_hp": 100, "inventory": {}, "last_sync_date": today_str}
        profile_collection.insert_one(profile)
    updates = {}
    if "hp" not in profile: updates["hp"] = 100
    if "max_hp" not in profile: updates["max_hp"] = 100
    if "inventory" not in profile: updates["inventory"] = {}
    if "last_sync_date" not in profile: updates["last_sync_date"] = today_str
    expected_rank = get_rank_by_level(profile.get("level", 1))
    if profile.get("rank") != expected_rank: updates["rank"] = expected_rank
    if updates:
        profile_collection.update_one({"_id": "main_profile"}, {"$set": updates})
        profile.update(updates)
    if categories_collection.count_documents({}) == 0:
        categories_collection.insert_many([{"name": "🔥 Дейлики"}, {"name": "📚 Проекты"}, {"name": "🎬 Личный Бренд"}])
    return profile

# ==========================================
# 5. ЭНДПОИНТ ИИ: ТЕМАТИЧЕСКИЙ ГЕНЕРАТОР КВЕСТОВ
# ==========================================
@app.get("/generate_ai_quest")
def generate_ai_quest(category: str = "✨ Разное"):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="API Ключ Gemini не настроен")
    try:
        # Инструкция, затачивающая ИИ под твои реальные интересы
        prompt = f"""
        Ты — ИИ-Оракул для персонального приложения 'Жизнь как RPG'. Твоя задача — придумать ОДИН реалистичный, но круто стилизованный под RPG квест для парня.
        
        Задание должно строго соответствовать выбранной категории: "{category}".
        
        Используй следующие контекстные рельсы для генерации в зависимости от темы:
        1. Если тема связана с "Личным Брендом", блогингом или соцсетями: придумай задачу по съемке динамичного контента, Shorts/TikTok, необычный ракурс, монтаж под бит (например, эстетичный эдит), челлендж на харизму или работу со звуком/светом.
        2. Если тема связана с "Проектами", кодом или учебой: сгенерируй квест на написание чистого кода, рефакторинг, проектирование архитектуры (Swift/SwiftUI/Python), интеграцию ИИ, отлов багов или оптимизацию БД.
        3. Если тема связана с автомобилями, гаражом или DIY: придумай инженерную задачу, квест по кастомизации, обновлению подсветки, замене расходников, поиску редкой детали, наведению идеального порядка в инструментах или работе руками.
        4. Если тема "Дейлики" или "Разное": челлендж по улучшению пространства вокруг (дизайн интерьера, мелкий ремонт, электрика, плитка), утренний ритуал продуктивности или микро-вызов для харизмы в реальном мире.
        
        Квест должен звучать дерзко, эпично и мотивирующе, как миссия из Cyberpunk 2077 или Кодекса Ассасинов, но оставаться на 100% выполнимым в реальности за один день.
        
        Верни ответ строго по схеме JSON:
        {{
          "title": "Эпичное название квеста",
          "description": "Конкретное, вдохновляющее описание шагов, которые нужно сделать в реальной жизни.",
          "xp": случайное число от 35 до 90,
          "gold": случайное число от 25 до 75
        }}
        """
        
        response = ai_model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        clean_text = response.text.strip()
        print(f"📡 Сгенерирован тематический квест [{category}]: {clean_text}")
        
        quest_data = json.loads(clean_text)
        return {"status": "success", "quest": quest_data}
        
    except Exception as e:
        error_msg = str(e)
        print(f"⚠️ Ошибка ИИ: {error_msg}")
        if "429" in error_msg or "quota" in error_msg.lower() or "resource_exhausted" in error_msg.lower():
            raise HTTPException(status_code=429, detail="🧠 Оракул перезагружает матрицы. Подожди 15 секунд!")
        raise HTTPException(status_code=500, detail="🧩 Ошибка генерации. Попробуй еще раз.")

# ==========================================
# 6. ОСТАЛЬНЫЕ ЭНДПОИНТЫ ДВИЖКА
# ==========================================
@app.post("/sync_new_day")
def sync_new_day():
    profile = get_or_create_profile()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    if profile["last_sync_date"] == today_str: return {"status": "already_synced"}
    dailies = list(quests_collection.find({"is_daily": True}))
    uncompleted_count = sum(1 for d in dailies if not d.get("completed", False))
    new_hp, new_streak, new_gold = profile["hp"], profile["streak"], profile["gold"]
    logs = []
    if len(dailies) > 0:
        if uncompleted_count > 0:
            damage = uncompleted_count * 20
            new_hp -= damage
            new_streak = 0
            logs.append({"text": f"💔 ШТРАФ: Пропущено дейликов ({uncompleted_count}). Получено {damage} урона. Стрик сброшен.", "timestamp": datetime.utcnow()})
        else:
            new_streak += 1
            logs.append({"text": f"🔥 ИДЕАЛЬНЫЙ ДЕНЬ: Все дейлики закрыты! Стрик: {new_streak} дн.", "timestamp": datetime.utcnow()})
    if new_hp <= 0:
        penalty_gold = 50
        new_gold = max(0, new_gold - penalty_gold)
        new_hp = profile["max_hp"]
        logs.append({"text": f"☠️ СИСТЕМНЫЙ СБОЙ: HP упало до нуля. Списано {penalty_gold} 💰.", "timestamp": datetime.utcnow()})
    profile_collection.update_one({"_id": "main_profile"}, {"$set": {"hp": new_hp, "streak": new_streak, "gold": new_gold, "last_sync_date": today_str}})
    quests_collection.update_many({"is_daily": True}, {"$set": {"completed": False}})
    if logs: logs_collection.insert_many(logs)
    return {"status": "synced"}

@app.get("/profile")
def get_profile():
    profile = get_or_create_profile()
    raw_stats = profile.get("stats", {})
    enhanced_stats = {cat: {"total_xp": xp, **calculate_category_progress(xp)} for cat, xp in raw_stats.items()}
    multiplier = 1.0 + (min(profile.get("streak", 0), 10) * 0.05)
    return {"profile": profile, "xp_to_next_level": profile["level"] * 100, "rank": profile.get("rank", "⚔️ Новичок"), "category_levels": enhanced_stats, "current_multiplier": multiplier}

@app.get("/categories")
def get_categories():
    get_or_create_profile() 
    cats = [{"id": str(c["_id"]), "name": c["name"]} for c in categories_collection.find()]
    return {"categories": cats}

@app.post("/add_category")
def add_category(cat: CategoryCreateInput):
    trimmed = cat.name.strip()
    if not trimmed or categories_collection.find_one({"name": trimmed}): return {"status": "error"}
    res = categories_collection.insert_one({"name": trimmed})
    return {"status": "success"}

@app.delete("/delete_category/{id}")
def delete_category(id: str):
    categories_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.get("/analytics/categories")
def get_category_stats():
    pipeline = [{"$match": {"action_type": "quest_completed"}}, {"$group": {"_id": "$category", "total_xp": {"$sum": "$xp_gained"}}}]
    db_results = list(history_collection.aggregate(pipeline))
    return {"labels": [r["_id"] or "✨ Разное" for r in db_results], "xp_distribution": [r["total_xp"] for r in db_results]}

@app.get("/quests")
def get_quests():
    active_quests = [{"id": str(q.pop("_id")), **q} for q in quests_collection.find()]
    return {"quests": active_quests}

@app.post("/add_quest")
def add_quest(quest: QuestCreateInput):
    new_q = quest.dict()
    new_q["completed"] = False
    res = quests_collection.insert_one(new_q)
    new_q["id"] = str(res.inserted_id)
    del new_q["_id"]
    return new_q

@app.post("/complete_quest")
def complete_quest(data: CompleteQuestInput):
    try: obj_id = ObjectId(data.quest_id)
    except: raise HTTPException(status_code=400)
    quest = quests_collection.find_one({"_id": obj_id})
    if not quest or quest.get("completed"): return {"status": "error"}
    quests_collection.update_one({"_id": obj_id}, {"$set": {"completed": True}})
    profile = get_or_create_profile()
    streak = profile.get("streak", 0)
    multiplier = 1.0 + (min(streak, 10) * 0.05)
    base_xp = quest.get("xp", 15)
    base_gold = quest.get("gold", 15)
    xp_gain = int(base_xp * multiplier)
    gold_gain = int(base_gold * multiplier)
    category = quest.get("category", "✨ Разное")
    stats = profile.get("stats", {})
    old_cat_xp = stats.get(category, 0)
    stats[category] = old_cat_xp + xp_gain
    cat_level_up = (min(((old_cat_xp + xp_gain) // 100) + 1, 10)) > ((old_cat_xp // 100) + 1)
    new_xp = profile["current_xp"] + xp_gain
    new_level = profile["level"]
    level_up = False
    while new_xp >= (new_level * 100):
        new_xp -= (new_level * 100)
        new_level += 1
        level_up = True
    profile_collection.update_one({"_id": "main_profile"}, {"$set": {
        "level": new_level, "current_xp": new_xp, "gold": profile["gold"] + gold_gain, 
        "stats": stats, "rank": get_rank_by_level(new_level)
    }})
    history_collection.insert_one({"action_type": "quest_completed", "category": category, "title": quest["title"], "xp_gained": xp_gain, "gold_earned": gold_gain, "timestamp": datetime.utcnow()})
    logs_collection.insert_one({"text": f"✓ {quest['title']} (+{xp_gain} XP) [x{multiplier:.2f}]", "timestamp": datetime.utcnow()})
    return {"status": "success", "level_up": level_up, "cat_level_up": cat_level_up}

@app.delete("/delete_quest/{id}")
def delete_quest(id: str):
    quests_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.get("/rewards")
def get_rewards():
    return {"rewards": [{"id": str(r.pop("_id")), **r} for r in rewards_collection.find()]}

@app.post("/add_reward")
def add_reward(reward: RewardCreateInput):
    rewards_collection.insert_one(reward.dict())
    return {"status": "success"}

@app.post("/buy_reward")
def buy_reward(data: BuyRewardInput):
    try: obj_id = ObjectId(data.reward_id)
    except: raise HTTPException(status_code=400)
    reward = rewards_collection.find_one({"_id": obj_id})
    profile = get_or_create_profile()
    if not reward or profile["gold"] < reward["cost"]: raise HTTPException(status_code=400)
    inventory = profile.get("inventory", {})
    item_title = reward["title"]
    inventory[item_title] = inventory.get(item_title, 0) + 1
    profile_collection.update_one({"_id": "main_profile"}, {"$inc": {"gold": -reward["cost"]}, "$set": {"inventory": inventory}})
    logs_collection.insert_one({"text": f"🛒 Куплено: {item_title}", "timestamp": datetime.utcnow()})
    return {"status": "success"}

@app.post("/use_item")
def use_item(data: UseItemInput):
    profile = get_or_create_profile()
    inventory = profile.get("inventory", {})
    title = data.item_title
    if inventory.get(title, 0) > 0:
        inventory[title] -= 1
        if inventory[title] <= 0: del inventory[title]
        profile_collection.update_one({"_id": "main_profile"}, {"$set": {"inventory": inventory}})
        logs_collection.insert_one({"text": f"🎒 Активирован предмет: {title}", "timestamp": datetime.utcnow()})
        return {"status": "success"}
    raise HTTPException(400, "Предмет не найден")

@app.delete("/delete_reward/{id}")
def delete_reward(id: str):
    rewards_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.get("/ideas")
def get_ideas():
    return {"ideas": [{"id": str(i.pop("_id")), **i} for i in ideas_collection.find().sort("_id", -1)]}

@app.post("/add_idea")
def add_idea(idea: IdeaCreateInput):
    res = ideas_collection.insert_one({"text": idea.text, "timestamp": datetime.utcnow()})
    return {"status": "success", "id": str(res.inserted_id)}

@app.delete("/delete_idea/{id}")
def delete_idea(id: str):
    ideas_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.get("/scripts")
def get_scripts():
    return {"scripts": [{"id": str(s.pop("_id")), **s} for s in scripts_collection.find().sort("_id", -1)]}

@app.post("/add_script")
def add_script(script: ScriptCreateInput):
    res = scripts_collection.insert_one(script.dict())
    return {"status": "success", "id": str(res.inserted_id)}

@app.delete("/delete_script/{id}")
def delete_script(id: str):
    scripts_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.get("/logs")
def get_logs():
    return {"logs": [{"id": str(l.pop("_id")), **l} for l in logs_collection.find({}, {"timestamp": 0}).sort("_id", -1).limit(40)]}