import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson.objectid import ObjectId

# Инициализация FastAPI
app = FastAPI(title="LifeRPG Core Engine v4.5")

# Настройка CORS для беспрепятственной связи с React-фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ MONGODB ATLAS
# ==========================================
MONGO_URI = os.getenv("MONGO_URI")

try:
    client = MongoClient(MONGO_URI)
    db = client["liferpg_cloud"]
    
    # Объявляем коллекции
    profile_collection = db["game_data"]
    quests_collection = db["quests"]
    rewards_collection = db["rewards"]
    logs_collection = db["logs"]
    history_collection = db["history"] # Наша летопись для круглого графика
    
    print("🚀 Успешно подключено к вечной базе данных MongoDB Atlas!")
except Exception as e:
    print(f"⚠️ Критическая ошибка подключения к кластеру: {e}")


# ==========================================
# PYDANTIC МОДЕЛИ (Точное совпадение с React)
# ==========================================
class QuestCreateInput(BaseModel):
    title: str
    description: str = ""
    xp: int = 15
    gold: int = 15
    category: str = "✨ Разное"

class CompleteQuestInput(BaseModel):
    quest_id: str

class RewardCreateInput(BaseModel):
    title: str
    cost: int = 30

class BuyRewardInput(BaseModel):
    reward_id: str


# ==========================================
# ВСПОМОГАТЕЛЬНАЯ ЛОГИКА ПРОФИЛЯ
# ==========================================
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
            "stats": {} # Здесь будут храниться прокачанные навыки по сферам
        }
        profile_collection.insert_one(profile)
    return profile


# ==========================================
# СИНХРОНИЗИРОВАННЫЕ ЭНДПОИНТЫ API
# ==========================================

@app.get("/profile")
def get_profile():
    profile = get_or_create_profile()
    xp_to_next = profile["level"] * 100
    return {
        "profile": profile,
        "xp_to_next_level": xp_to_next,
        "rank": profile.get("rank", "⚔️ Новичок")
    }

@app.get("/quests")
def get_quests():
    active_quests = []
    for q in quests_collection.find({"completed": {"$ne": True}}):
        q["id"] = str(q["_id"]) # Конвертируем ObjectId в строку для React key={quest.id}
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
    
    # Закидываем событие в ленту
    logs_collection.insert_one({
        "text": f"🔨 Выкован новый квест: {quest.title}",
        "timestamp": datetime.utcnow()
    })
    return new_quest

@app.post("/complete_quest")
def complete_quest(data: CompleteQuestInput):
    try:
        obj_id = ObjectId(data.quest_id)
    except:
        raise HTTPException(status_code=400, detail="Неверный формат ID квеста")
        
    quest = quests_collection.find_one({"_id": obj_id})
    if not quest:
        raise HTTPException(status_code=404, detail="Квест не найден в матрице")
    if quest.get("completed"):
        return {"status": "already_completed", "level_up": False}

    # Помечаем квест выполненным
    quests_collection.update_one({"_id": obj_id}, {"$set": {"completed": True}})

    profile = get_or_create_profile()
    category = quest.get("category", "✨ Разное")
    xp_gain = quest.get("xp", 15)
    gold_gain = quest.get("gold", 15)

    # 📊 АПГРЕЙД СФЕР ЖИЗНИ (Те самые прогресс-бары на главном экране)
    stats = profile.get("stats", {})
    stats[category] = stats.get(category, 0) + xp_gain

    # Расчет нового уровня
    new_xp = profile["current_xp"] + xp_gain
    new_gold = profile["gold"] + gold_gain
    new_level = profile["level"]
    level_up = False

    xp_needed = new_level * 100
    if new_xp >= xp_needed:
        new_level += 1
        new_xp -= xp_needed
        level_up = True
        
        # Динамический расчет рангов в зависимости от уровня
        if new_level >= 15: profile["rank"] = "👑 Легенда"
        elif new_level >= 10: profile["rank"] = "🦅 Магистр"
        elif new_level >= 5: profile["rank"] = "🛡️ Рыцарь"
        else: profile["rank"] = "⚔️ Новичок"

    # Сохраняем обновленного персонажа в базу
    profile_collection.update_one(
        {"_id": "main_profile"},
        {"$set": {
            "level": new_level,
            "current_xp": new_xp,
            "gold": new_gold,
            "stats": stats,
            "rank": profile.get("rank", "⚔️ Новичок")
        }}
    )

    # 📈 ЗАПИСЬ В ЛЕТОПИСЬ (Для генерации круглого графика)
    history_collection.insert_one({
        "action_type": "quest_completed",
        "category": category,
        "title": quest["title"],
        "xp_gained": xp_gain,
        "gold_earned": gold_gain,
        "timestamp": datetime.utcnow()
    })

    # 📜 ЗАПИСЬ В ЛЕНТУ СОБЫТИЙ (Оживляем лог-журнал на фронтенде)
    logs_collection.insert_one({
        "text": f"✓ Выполнен квест: {quest['title']} (+{xp_gain} XP, +{gold_gain} 💰)",
        "timestamp": datetime.utcnow()
    })
    
    if level_up:
        logs_collection.insert_one({
            "text": f"🚀 ЛЕВЕЛ АП! Вы достигли {new_level} уровня. Код матрицы переписан!",
            "timestamp": datetime.utcnow()
        })

    return {"status": "success", "level_up": level_up}

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
        raise HTTPException(status_code=400, detail="Неверный ID товара")
        
    reward = rewards_collection.find_one({"_id": obj_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Товар распродан или не найден")

    profile = get_or_create_profile()
    if profile["gold"] < reward["cost"]:
        raise HTTPException(status_code=400, detail="Недостаточно золота для транзакции")

    # Списываем золото
    profile_collection.update_one(
        {"_id": "main_profile"},
        {"$inc": {"gold": -reward["cost"]}}
    )

    # Фиксируем покупку в логах и истории
    history_collection.insert_one({
        "action_type": "reward_bought",
        "category": "🛒 Магазин Наград",
        "title": reward["title"],
        "xp_gained": 0,
        "gold_earned": -reward["cost"],
        "timestamp": datetime.utcnow()
    })

    logs_collection.insert_one({
        "text": f"💰 Куплена награда: {reward['title']} (-{reward['cost']} 💰)",
        "timestamp": datetime.utcnow()
    })

    return {"status": "success"}

@app.get("/logs")
def get_logs():
    latest_logs = []
    # Берем последние 30 событий и сортируем их по дате (от свежих к старым)
    for l in logs_collection.find().sort("timestamp", -1).limit(30):
        l["id"] = str(l["_id"])
        del l["_id"]
        if "timestamp" in l: del l["timestamp"]
        latest_logs.append(l)
    return {"logs": latest_logs}

@app.delete("/delete_quest/{id}")
def delete_quest(id: str):
    quests_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}

@app.delete("/delete_reward/{id}")
def delete_reward(id: str):
    rewards_collection.delete_one({"_id": ObjectId(id)})
    return {"status": "success"}


# ==========================================
# ПОДГОТОВКА ДАННЫХ ДЛЯ КРУГЛОГО ГРАФИКА
# ==========================================
@app.get("/analytics/categories")
def get_category_stats():
    pipeline = [
        {"$match": {"action_type": "quest_completed"}},
        {"$group": {
            "_id": "$category", 
            "count": {"$sum": 1},
            "total_xp": {"$sum": "$xp_gained"}
        }}
    ]
    
    db_results = list(history_collection.aggregate(pipeline))
    labels = []
    quest_counts = []
    xp_distribution = []
    
    for row in db_results:
        category_name = row["_id"] if row["_id"] else "✨ Разное"
        labels.append(category_name)
        quest_counts.append(row["count"])
        xp_distribution.append(row["total_xp"])
        
    return {
        "labels": labels,
        "quest_counts": quest_counts,
        "xp_distribution": xp_distribution
    }