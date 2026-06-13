from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import datetime

app = FastAPI(title="LifeRPG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "database.json"

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Миграция данных под версию 3.0
        if "gold" not in data["player"]: data["player"]["gold"] = 0
        if "streak" not in data["player"]: data["player"]["streak"] = 0
        if "stats" not in data["player"]: data["player"]["stats"] = {}
        if "rewards" not in data:
            data["rewards"] = [
                {"id": 1, "title": "Посмотреть серию любимого сериала", "cost": 30},
                {"id": 2, "title": "Вкусный читмил / Заказать пиццу", "cost": 150}
            ]
        if "logs" not in data: data["logs"] = []
        
        return data
    
    # Дефолтная база для чистого старта
    default_db = {
        "player": {"name": "Creator", "level": 1, "current_xp": 0, "gold": 0, "streak": 0, "stats": {}},
        "quests": [
            {"id": 1, "category": "🎬 Личный Бренд", "title": "Дебют", "description": "Смонтировать 1-е полноценное видео", "xp": 20, "gold": 20, "completed": False},
            {"id": 99, "category": "🔥 Дейлики", "title": "Ежедневная активность", "description": "Выполнить норму шагов", "xp": 5, "gold": 5, "completed": False}
        ],
        "rewards": [
            {"id": 1, "title": "Посмотреть серию любимого сериала", "cost": 30},
            {"id": 2, "title": "Вкусный читмил / Заказать пиццу", "cost": 150}
        ],
        "logs": [{"text": "[Система] Ядро LifeRPG v3.0 успешно инициализировано."}]
    }
    save_db(default_db)
    return default_db

def save_db(db_data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db_data, f, ensure_ascii=False, indent=4)

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

@app.get("/profile")
def get_profile():
    db = load_db()
    xp_to_next = db["player"]["level"] * 100
    return {"profile": db["player"], "xp_to_next_level": xp_to_next}

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
                
            quest["completed"] = True
            
            # Логика Стриков для дейлика (id 99)
            xp_bonus = 0
            if quest["id"] == 99:
                db["player"]["streak"] += 1
                # Каждые 3 дня стрика дают бонус +5 к золоту и опыту
                if db["player"]["streak"] % 3 == 0:
                    xp_bonus = 10
                    log_msg = f"[{time_str}] 🔥 СТРИК СЕРИИ! {db['player']['streak']} дней подряд! Получен бонус +10 XP!"
                    db["logs"].insert(0, {"text": log_msg})
            
            final_xp = quest["xp"] + xp_bonus
            db["player"]["current_xp"] += final_xp
            db["player"]["gold"] += quest["gold"]
            
            # Запись статистики по категориям
            cat = quest["category"]
            if "stats" not in db["player"]: db["player"]["stats"] = {}
            db["player"]["stats"][cat] = db["player"]["stats"].get(cat, 0) + final_xp
            
            # Лог действия
            log_msg = f"[{time_str}] Выполнено: {quest['title']} (+{final_xp} XP, +{quest['gold']} 💰)"
            db["logs"].insert(0, {"text": log_msg})
            
            level_up = False
            xp_to_next = db["player"]["level"] * 100
            if db["player"]["current_xp"] >= xp_to_next:
                db["player"]["level"] += 1
                db["player"]["current_xp"] -= xp_to_next
                level_up = True
                db["logs"].insert(0, {"text": f"[{time_str}] 🎉 ЛЕВЕЛ АП! Новый уровень: {db['player']['level']}!"})
            
            db["logs"] = db["logs"][:20]
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
            db["logs"].insert(0, {"text": f"[{time_str}] Списание: {r['title']} (-{r['cost']} 💰)"})
            save_db(db)
            return {"status": "success"}
    return {"status": "error", "message": "Ошибка транзакции"}