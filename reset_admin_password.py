from flask_bcrypt import Bcrypt
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Connect to MongoDB
client = MongoClient(os.getenv('MONGO_URI'))
db = client.get_database()

# Initialize bcrypt
bcrypt = Bcrypt()

# Set new password
new_password = "admin123"  # Change this to your desired password
hashed = bcrypt.generate_password_hash(new_password).decode("utf-8")

# Update admin user
result = db.users.update_one(
    {"username": "admin"},  # Change "admin" if your admin username is different
    {"$set": {"password": hashed}}
)

if result.modified_count > 0:
    print(f"✓ Password updated successfully!")
    print(f"Username: admin")
    print(f"New Password: {new_password}")
else:
    print("✗ Admin user not found. Available users:")
    for user in db.users.find():
        print(f"  - {user['username']} (role: {user.get('role', 'N/A')})")

client.close()