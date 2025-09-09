import os
from dotenv import load_dotenv
from app import create_app

# Load environment variables from .env file for local development
load_dotenv()

# Create the Flask app instance so Gunicorn can find it
app = create_app(os.getenv('FLASK_CONFIG') or 'default')

# This block will only run when you execute "python run.py" on your computer.
# Gunicorn and Render will ignore it.
if __name__ == '__main__':
    app.run(debug=True)