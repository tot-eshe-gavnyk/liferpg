import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from bson.objectid import ObjectId

# Инициализация приложения
app = FastAPI(title="LifeRPG Backend v4.0")

# Настройка CORS для беспрепятственной связи с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ MONGODB
# ==========================================
MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("⚠️ ВНИМАНИЕ: Переменная MONGO_URI не найдена. Проверьте настройки Render!")

try:
    client = MongoClient(MONGO_URI)
    db = client["liferpg_cloud"]
    
    # Инициализация коллекций
    profile_collection = db["game_data"]  # Статистика профиля
    quests_collection = db["quests"]      # Активные задачи
    history_collection = db["history"]    # Летопись для графиков (НОВОЕ)
    
    print("🚀 Успешно подключено к вечной базе данных MongoDB Atlas!")
except Exception as e:
    print(f"⚠️ Ошибка подключения к базе: {e}")


# ==========================================
# 2. PYDANTIC МОДЕЛИ (Схемы данных)
# ==========================================
class QuestBase(BaseModel):
    title: str
    category: str = "Разное"
    xp: int = 10
    gold: int = 10

class HistoryEntry(BaseModel):
    action_type: str
    category: str
    title: str
    xp_gained: int
    gold_earned: int
    timestamp: datetime


# ==========================================
# 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ==========================================
def get_or_create_profile():
    """Ищет профиль в базе. Если его нет — создает стартовый шаблон."""
    profile = profile_collection.find_one({"_id": "main_profile"})
    if not profile:
        profile = {
            "_id": "main_profile",
            "level": 1,
            "current_xp": 0,
            "gold": 0,
            "rank": "⚔️ Новичок",
            "streak": 0
        }
        profile_collection.insert_one(profile)
    return profile


# ==========================================
# 4. ОСНОВНЫЕ ЭНДПОИНТЫ API
# ==========================================

@app.get("/profile")
def get_profile():
    """Отдает статистику профиля на фронтенд"""
    return get_or_create_profile()

@app.get("/quests")
def get_quests():
    """Отдает список всех невыполненных квестов"""
    quests = []
    for q in quests_collection.find({"completed": {"$ne": True}}):
        q["_id"] = str(q["_id"])  # MongoDB использует ObjectId, переводим в строку
        quests.append(q)
    return quests

@app.post("/quests")
def create_quest(quest: QuestBase):
    """Создает новый квест (Кузница)"""
    new_quest = quest.dict()
    new_quest["completed"] = False
    result = quests_collection.insert_one(new_quest)
    new_quest["_id"] = str(result.inserted_id)
    return new_quest

@app.post("/quests/{quest_id}/complete")
def complete_quest(quest_id: str):
    """Боевой эндпоинт: Зачет квеста, начисление наград и запись в историю"""
    
    # Шаг 1: Ищем квест в базе
    quest = quests_collection.find_one({"_id": ObjectId(quest_id)})
    if not quest:
        raise HTTPException(status_code=404, detail="Квест не найден")
    if quest.get("completed"):
        raise HTTPException(status_code=400, detail="Квест уже выполнен")

    # Шаг 2: Закрываем квест
    quests_collection.update_one({"_id": ObjectId(quest_id)}, {"$set": {"completed": True}})

    # Шаг 3: Начисляем Опыт и Золото в профиль
    profile = get_or_create_profile()
    new_xp = profile["current_xp"] + quest.get("xp", 0)
    new_gold = profile["gold"] + quest.get("gold", 0)
    
    # Простая система уровней (каждые 100 XP = level up)
    level_up = False
    new_level = profile["level"]
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
            "gold": new_gold
        }}
    )

    # Шаг 4: ЛЕТОПИСЬ (Сохраняем шаг для круговой аналитики)
    history_entry = {
        "action_type": "quest_completed",
        "category": quest.get("category", "Разное"),
        "title": quest.get("title", "Неизвестный квест"),
        "xp_gained": quest.get("xp", 0),
        "gold_earned": quest.get("gold", 0),
        "timestamp": datetime.utcnow()
    }
    history_collection.insert_one(history_entry)

    return {
        "status": "success",
        "level_up": level_up,
        "new_level": new_level,
        "current_xp": new_xp,
        "gold": new_gold,
        "message": f"Получено {quest.get('xp')} XP и {quest.get('gold')} Золота!"
    }


# ==========================================
# 5. АНАЛИТИКА (Для графиков на фронтенде)
# ==========================================

@app.get("/analytics/categories")
def get_category_stats():
    """Агрегирует данные из Летописи и выдает готовую статистику для Chart.js"""
    
    # Инструкция для базы: найти выполненные квесты и сгруппировать их по категориям
    pipeline = [
        {"$match": {"action_type": "quest_completed"}},
        {"$group": {
            "_id": "$category", 
            "count": {"$sum": 1},
            "total_xp": {"$sum": "$xp_gained"}
        }}
    ]
    
    db_results = list(history_collection.aggregate(pipeline))
    
    # Форматируем массивы ровно так, как любит библиотека графиков
    labels = []
    quest_counts = []
    xp_distribution = []
    
    for row in db_results:
        category_name = row["_id"] if row["_id"] else "Разное"
        labels.append(category_name)
        quest_counts.append(row["count"])
        xp_distribution.append(row["total_xp"])
        
    return {
        "labels": labels,                       # ['Дейлики', 'Личный Бренд', 'Гараж']
        "quest_counts": quest_counts,           # [15, 5, 2] (Количество задач)
        "xp_distribution": xp_distribution      # [150, 200, 80] (Сколько опыта принесла сфера)
    }