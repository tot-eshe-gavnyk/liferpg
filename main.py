from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import datetime
from pymongo import MongoClient

app = FastAPI(title="LifeRPG API v3.5")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ (MONGO ИЛИ JSON) ---
MONGO_URI = os.getenv("MONGO_URI")
use_mongo = False

if MONGO_URI:
    try:
        # Подключаемся к удаленному кластеру
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info() # Проверка связи
        mongo_db = client["liferpg_cloud"]
        db_collection = mongo_db["game_data"]
        use_mongo = True
        print("🚀 Успешно подключено к вечной базе данных MongoDB Atlas!")
    except Exception as e:
        print("⚠️ Не удалось связаться с MongoDB, включен аварийный JSON-режим:", e)

DB_FILE = "database.json"

def load_db():
    if use_mongo:
        data = db_collection.find_one({"_id": "main_player_data"})
        if data:
            return data
    else:
        if os.path.exists(DB_FILE):
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    
    # Базовая матрица, если базы пусты
    default_db = {
        "_id": "main_player_data", # Нужно для MongoDB
        "player": {"name": "Creator", "level": 1, "current_xp": 0, "gold": 0, "streak": 0, "last_reset": ""},
        "quests": [
            {"id": 1, "category": "🎬 Личный Бренд", "title": "Дебют", "description": "Смонтировать 1-е видео", "xp": 20, "gold": 20, "completed": False},
            {"id": 99, "category": "🔥 Дейлики", "title": "Ежедневная активность", "description": "Выполнить норму шагов", "xp": 5, "gold": 5, "completed": False}
        ],
        "rewards": [
            {"id": 1, "title": "Посмотреть серию любимого сериала", "cost": 30},
            {"id": 2, "title": "Вкусный читмил / Заказать пиццу", "cost": 150}
        ],
        "logs": [{"text": "[Система] Ядро v3.5 запущено. Матрица стабильна."}]
    }
    save_db(default_db)
    return default_db

def save_db(db_data):
    if use_mongo:
        db_collection.replace_one({"_id": "main_player_data"}, db_data, upsert=True)
    else:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(db_data, f, ensure_ascii=False, indent=4)

# --- СИСТЕМА ИГРОВЫХ РАНГОВ ---
def get_rank(level: int) -> str:
    if level < 3: return "⚔️ Новичок"
    elif level < 7: return "🔮 Искатель"
    elif level < 12: return "🔱 Мастер Матрицы"
    elif level < 20: return "🌌 Повелитель Судьбы"
    return "👑 Легенда Реальности"

# --- ЛОГИКА КАЛЕНДАРНОГО СБРОСА ДЕЙЛИКОВ ---
def update_daily_calendar(db):
    today = datetime.date.today().isoformat()
    last_reset = db["player"].get("last_reset", "")
    
    if last_reset != today:
        time_str = datetime.datetime.now().strftime("%H:%M")
        
        # Проверяем, не пропущен ли вчерашний день для стрика
        if last_reset:
            yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
            if last_reset != yesterday and db["player"]["streak"] > 0:
                db["player"]["streak"] = 0
                db["logs"].insert(0, {"text": f"[{time_str}] ❄️ Серия дней прервана. Стрик обнулен."})
        
        # Сбрасываем бесконечный дейлик
        for quest in db["quests"]:
            if quest["id"] == 99:
                quest["completed"] = False
        
        db["player"]["last_reset"] = today
        save_db(db)

# --- МОДЕЛИ ДАННЫХ ---
class QuestCompleteRequest(BaseModel):
    quest_id: int

class QuestAddRequest(BaseModel):
    category: str
    title: str
    description: str
    xp: int
    gold: int

class RewardAddRequest(BaseModel):
    title: str
    cost: int

class RewardBuyRequest(BaseModel):
    reward_id: int

# --- ЭНДПОИНТЫ ---
@app.get("/profile")
def get_profile():
    db = load_db()
    update_daily_calendar(db)
    xp_to_next = db["player"]["level"] * 100
    rank = get_rank(db["player"]["level"])
    return {"profile": db["player"], "xp_to_next_level": xp_to_next, "rank": rank}

@app.get("/quests")
def get_quests():
    db = load_db()
    return {"quests": db["quests"]}

@app.get("/rewards")
def get_rewards():
    db = load_db()
    return {"rewards": db.get("rewards", [])}

@app.get("/logs")
def get_logs():
    db = load_db()
    return {"logs": db.get("logs", [])}

@app.post("/complete_quest")
def complete_quest(req: QuestCompleteRequest):
    db = load_db()
    time_str = datetime.datetime.now().strftime("%H:%M")
    
    for quest in db["quests"]:
        if quest["id"] == req.quest_id:
            if quest["completed"] and quest["id"] != 99:
                return {"status": "error", "message": "Квест уже выполнен"}
            
            # Если это дейлик, который уже был выполнен сегодня, повторно стрик не качаем
            if quest["id"] == 99 and quest["completed"] == False:
                db["player"]["streak"] += 1
                if db["player"]["streak"] % 3 == 0:
                    db["player"]["current_xp"] += 15
                    db["logs"].insert(0, {"text": f"[{time_str}] 🔥 СТРИК БОНУС! Серия {db['player']['streak']} дн. (+15 XP!)"})
            
            quest["completed"] = True
            db["player"]["current_xp"] += quest["xp"]
            db["player"]["gold"] += quest["gold"]
            
            # Обновление статистики по категориям
            if "stats" not in db["player"]: db["player"]["stats"] = {}
            cat = quest["category"]
            db["player"]["stats"][cat] = db["player"]["stats"].get(cat, 0) + quest["xp"]
            
            db["logs"].insert(0, {"text": f"[{time_str}] Сдано: {quest['title']} (+{quest['xp']}XP, +{quest['gold']}💰)"})
            
            level_up = False
            xp_to_next = db["player"]["level"] * 100
            if db["player"]["current_xp"] >= xp_to_next:
                db["player"]["level"] += 1
                db["player"]["current_xp"] -= xp_to_next
                level_up = True
            
            save_db(db)
            return {"status": "success", "level_up": level_up}
    return {"status": "error", "message": "Квест не найден"}

@app.post("/add_quest")
def add_quest(req: QuestAddRequest):
    db = load_db()
    new_id = max([q["id"] for q in db["quests"]], default=0) + 1
    db["quests"].append({
        "id": new_id, "category": req.category, "title": req.title,
        "description": req.description, "xp": req.xp, "gold": req.gold, "completed": False
    })
    save_db(db)
    return {"status": "success"}

@app.delete("/delete_quest/{quest_id}")
def delete_quest(quest_id: int):
    db = load_db()
    db["quests"] = [q for q in db["quests"] if q["id"] != quest_id]
    save_db(db)
    return {"status": "success"}

@app.post("/add_reward")
def add_reward(req: RewardAddRequest):
    db = load_db()
    new_id = max([r["id"] for r in db.get("rewards", [])], default=0) + 1
    db["rewards"].append({"id": new_id, "title": req.title, "cost": req.cost})
    save_db(db)
    return {"status": "success"}

@app.delete("/delete_reward/{reward_id}")
def delete_reward(reward_id: int):
    db = load_db()
    db["rewards"] = [r for r in db.get("rewards", []) if r["id"] != reward_id]
    save_db(db)
    return {"status": "success"}

@app.post("/buy_reward")
def buy_reward(req: RewardBuyRequest):
    db = load_db()
    time_str = datetime.datetime.now().strftime("%H:%M")
    for r in db.get("rewards", []):
        if r["id"] == req.reward_id and db["player"]["gold"] >= r["cost"]:
            db["player"]["gold"] -= r["cost"]
            db["logs"].insert(0, {"text": f"[{time_str}] Магазин: {r['title']} (-{r['cost']}💰)"})
            save_db(db)
            return {"status": "success"}
    return {"status": "error", "message": "Не хватает золота"}