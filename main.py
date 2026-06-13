import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson.objectid import ObjectId

# ==========================================
# 1. ИНИЦИАЛИЗАЦИЯ ЯДРА И CORS
# ==========================================
app = FastAPI(title="LifeRPG Core Engine v8.0 - Category Leveling System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ MONGODB ATLAS
# ==========================================
MONGO_URI = os.getenv("MONGO_URI")

try:
    client = MongoClient(MONGO_URI)
    db = client["liferpg_cloud"]
    
    # Коллекции матрицы
    profile_collection = db["game_data"]
    quests_collection = db["quests"]
    rewards_collection = db["rewards"]
    logs_collection = db["logs"]
    history_collection = db["history"] 
    categories_collection = db["categories"] 
    
    print("🚀 Успешно подключено к кластеру MongoDB Atlas!")
except Exception as e:
    print(f"⚠️ Critical DB Error: {e}")


# ==========================================
# 3. PYDANTIC МОДЕЛИ (Схемы данных)
# ==========================================
class QuestCreateInput(BaseModel):
    title: str
    description: str = ""
    xp: int = 15
    gold: int = 15
    category: str = "✨ Разное"
    requires_id: str = ""  
    is_daily: bool = False 

class CompleteQuestInput(BaseModel):
    quest_id: str

class RewardCreateInput(BaseModel):
    title: str
    cost: int = 30

class BuyRewardInput(BaseModel):
    reward_id: str

class CategoryCreateInput(BaseModel):
    name: str 


# ==========================================
# 4. ВСПОМОГАТЕЛЬНАЯ МАТЕМАТИКА РАНГОВ И УРОВНЕЙ
# ==========================================
def get_rank_by_level(level: int) -> str:
    if level >= 20: return "🌌 Архитектор Матрицы"
    if level >= 15: return "👑 Легенда"
    if level >= 10: return "🦅 Магистр"
    if level >= 5:  return "🛡️ Рыцарь"
    return "⚔️ Новичок"

def calculate_category_progress(xp: int):
    """
    Каждые 100 XP = 1 уровень категории. Макс уровень = 10.
    Возвращает текущий уровень категории, XP внутри уровня и процент прогресса.
    """
    level = (xp // 100) + 1
    if level >= 10:
        return {
            "level": 10,
            "current_xp_in_level": 100,
            "xp_needed_for_next": 100,
            "percent": 100,
            "is_maxed": True
        }
    
    current_xp_in_level = xp % 100
    return {
        "level": level,
        "current_xp_in_level": current_xp_in_level,
        "xp_needed_for_next": 100,
        "percent": int((current_xp_in_level / 100) * 100),
        "is_maxed": False
    }

def get_or_create_profile():
    profile = profile_collection.find_one({"_id": "main_profile"})
    if not profile:
        profile = {
            "_id": "main_profile",
            "name": "Оператор",
            "level": 1,
            "current_xp": 0,
            "gold": 0,
            "rank": "⚔️ Новичок",
            "streak": 0,
            "stats": {} 
        }
        profile_collection.insert_one(profile)
    
    expected_rank = get_rank_by_level(profile.get("level", 1))
    if profile.get("rank") != expected_rank:
        profile_collection.update_one({"_id": "main_profile"}, {"$set": {"rank": expected_rank}})
        profile["rank"] = expected_rank

    if categories_collection.count_documents({}) == 0:
        categories_collection.insert_many([
            {"name": "🔥 Дейлики"},
            {"name": "📚 Проекты & Академия"},
            {"name": "🎬 Личный Бренд"}
        ])

    return profile


# ==========================================
# 5. ЭНДПОИНТЫ: ПРОФИЛЬ, КАТЕГОРИИ И АНАЛИТИКА
# ==========================================
@app.get("/")
def health_check():
    return {"status": "LifeRPG Engine v8.0 is running perfectly."}

@app.get("/profile")
def get_profile():
    profile = get_or_create_profile()
    xp_to_next = profile["level"] * 100
    
    # Расширяем статистику категорий, добавляя туда данные об уровнях (до 10)
    raw_stats = profile.get("stats", {})
    enhanced_stats = {}
    
    for cat_name, total_xp in raw_stats.items():
        enhanced_stats[cat_name] = {
            "total_xp": total_xp,
            **calculate_category_progress(total_xp)
        }
        
    return {
        "profile": profile,
        "xp_to_next_level": xp_to_next,
        "rank": profile.get("rank", "⚔️ Новичок"),
        "category_levels": enhanced_stats  # Фронтенд заберет эти данные для шкал до 10 уровня
    }

@app.get("/categories")
def get_categories():
    get_or_create_profile() 
    cats = []
    for c in categories_collection.find():
        cats.append({"id": str(c["_id"]), "name": c["name"]})
    return {"categories": cats}

@app.post("/add_category")
def add_category(cat: CategoryCreateInput):
    trimmed_name = cat.name.strip()
    if not trimmed_name:
        raise HTTPException(status_code=400, detail="Название категории пустое")
    
    if categories_collection.find_one({"name": trimmed_name}):
        return {"status": "already_exists"}
        
    res = categories_collection.insert_one({"name": trimmed_name})
    return {"status": "success", "id": str(res.inserted_id), "name": trimmed_name}

@app.delete("/delete_category/{id}")
def delete_category(id: str):
    categories_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.get("/analytics/categories")
def get_category_stats():
    pipeline = [
        {"$match": {"action_type": "quest_completed"}},
        {"$group": {
            "_id": "$category", 
            "total_xp": {"$sum": "$xp_gained"}
        }}
    ]
    db_results = list(history_collection.aggregate(pipeline))
    return {
        "labels": [r["_id"] if r["_id"] else "✨ Разное" for r in db_results],
        "xp_distribution": [r["total_xp"] for r in db_results]
    }


# ==========================================
# 6. ЭНДПОИНТЫ: КВЕСТЫ И ЦЕПОЧКИ
# ==========================================
@app.get("/quests")
def get_quests():
    active_quests = []
    for q in quests_collection.find():
        q["id"] = str(q["_id"])
        del q["_id"]
        active_quests.append(q)
    return {"quests": active_quests}

@app.post("/add_quest")
def add_quest(quest: QuestCreateInput):
    new_quest = quest.dict()
    new_quest["completed"] = False
    result = quests_collection.insert_one(new_quest)
    new_quest["id"] = str(result.inserted_id)
    del new_quest["_id"]
    return new_quest

@app.post("/complete_quest")
def complete_quest(data: CompleteQuestInput):
    try:
        obj_id = ObjectId(data.quest_id)
    except:
        raise HTTPException(status_code=400, detail="Неверный формат ID")
        
    quest = quests_collection.find_one({"_id": obj_id})
    if not quest:
        raise HTTPException(status_code=404, detail="Квест не найден")
    if quest.get("completed"):
        return {"status": "already_completed", "level_up": False}

    quests_collection.update_one({"_id": obj_id}, {"$set": {"completed": True}})

    profile = get_or_create_profile()
    category = quest.get("category", "✨ Разное")
    xp_gain = quest.get("xp", 15)
    gold_gain = quest.get("gold", 15)

    stats = profile.get("stats", {})
    old_xp = stats.get(category, 0)
    new_cat_xp = old_xp + xp_gain
    stats[category] = new_cat_xp

    # Рассчитываем, случился ли левелап внутри категории
    old_cat_level = (old_xp // 100) + 1
    new_cat_level = min((new_cat_xp // 100) + 1, 10)
    cat_level_up = new_cat_level > old_cat_level and old_cat_level < 10

    new_xp = profile["current_xp"] + xp_gain
    new_gold = profile["gold"] + gold_gain
    new_level = profile["level"]
    level_up = False

    # Основной левелап персонажа
    xp_needed = new_level * 100
    if new_xp >= xp_needed:
        new_level += 1
        new_xp -= xp_needed
        level_up = True

    profile_collection.update_one(
        {"_id": "main_profile"},
        {"$set": {
            "level": new_level,
            "current_xp": new_xp,
            "gold": new_gold,
            "stats": stats,
            "rank": get_rank_by_level(new_level)
        }}
    )

    history_collection.insert_one({
        "action_type": "quest_completed",
        "category": category,
        "title": quest["title"],
        "xp_gained": xp_gain,
        "gold_earned": gold_gain,
        "timestamp": datetime.utcnow()
    })

    # Оповещения в ленту логов
    logs_collection.insert_one({
        "text": f"✓ Выполнен квест: {quest['title']} (+{xp_gain} XP, +{gold_gain} 💰)",
        "timestamp": datetime.utcnow()
    })
    
    if cat_level_up:
        logs_collection.insert_one({
            "text": f"🔥 ПУТЬ ПОВЫШЕН! Направление '{category}' развилось до {new_cat_level} уровня!",
            "timestamp": datetime.utcnow()
        })

    if level_up:
        logs_collection.insert_one({
            "text": f"🚀 ЛЕВЕЛ АП! Ваш глобальный уровень повышен до {new_level}!",
            "timestamp": datetime.utcnow()
        })

    return {"status": "success", "level_up": level_up, "cat_level_up": cat_level_up}

@app.delete("/delete_quest/{id}")
def delete_quest(id: str):
    quests_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}


# ==========================================
# 8. ЭНДПОИНТЫ: МАГАЗИН
# ==========================================
@app.get("/rewards")
def get_rewards():
    all_rewards = []
    for r in rewards_collection.find():
        r["id"] = str(r["_id"])
        del r["_id"]
        all_rewards.append(r)
    return {"rewards": all_rewards}

@app.post("/add_reward")
def add_reward(reward: RewardCreateInput):
    new_reward = reward.dict()
    result = rewards_collection.insert_one(new_reward)
    new_reward["id"] = str(result.inserted_id)
    del new_reward["_id"]
    return new_reward

@app.post("/buy_reward")
def buy_reward(data: BuyRewardInput):
    try:
        obj_id = ObjectId(data.reward_id)
    except:
        raise HTTPException(status_code=400, detail="Неверный ID")
    reward = rewards_collection.find_one({"_id": obj_id})
    if not reward:
        raise HTTPException(status_code=404)

    profile = get_or_create_profile()
    if profile["gold"] < reward["cost"]:
        raise HTTPException(status_code=400, detail="Недостаточно золота")

    profile_collection.update_one({"_id": "main_profile"}, {"$inc": {"gold": -reward["cost"]}})
    logs_collection.insert_one({
        "text": f"💰 Куплено: {reward['title']} (-{reward['cost']} 💰)",
        "timestamp": datetime.utcnow()
    })
    return {"status": "success"}

@app.delete("/delete_reward/{id}")
def delete_reward(id: str):
    rewards_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}


# ==========================================
# 9. ЭНДПОИНТЫ: ЛОГИ
# ==========================================
@app.get("/logs")
def get_logs():
    return {"logs": [{"id": str(l.pop("_id")), **l} for l in logs_collection.find({}, {"timestamp": 0}).sort("_id", -1).limit(35)]}