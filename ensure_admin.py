from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI'))
db = client.get_database()
bcrypt = Bcrypt()

username = "admin"
password = "admin123"
hashed = bcrypt.generate_password_hash(password).decode("utf-8")

existing = db.users.find_one({"username": username})
if existing:
    db.users.update_one(
        {"_id": existing["_id"]},
        {"$set": {"password": hashed, "role": "admin"}}
    )
    print("Admin password updated successfully to admin123")
else:
    db.users.insert_one({
        "username": username,
        "password": hashed,
        "role": "admin",
        "email": "admin@jainuniversity.ac.in",
        "created_at": datetime.utcnow()
    })
    print("Admin user created successfully with admin / admin123")

client.close()
