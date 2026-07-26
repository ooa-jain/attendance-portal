from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI'))
db = client.get_database()
bcrypt = Bcrypt()

# New admin credentials
username = "admin"
password = "admin123"  # Change this!
email = "admin@example.com"

# Check if user exists
if db.users.find_one({"username": username}):
    print(f"✗ User '{username}' already exists. Use reset script instead.")
else:
    hashed = bcrypt.generate_password_hash(password).decode("utf-8")
    db.users.insert_one({
        "username": username,
        "password": hashed,
        "role": "admin",
        "email": email,
        "created_at": datetime.utcnow()
    })
    print(f"✓ Admin user created successfully!")
    print(f"Username: {username}")
    print(f"Password: {password}")

client.close()