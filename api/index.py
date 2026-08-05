import sys
import os

# Add the backend directory to sys.path so app modules import cleanly
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app as fastapi_app

# Vercel expects a top-level ASGI object named 'app'
app = fastapi_app
