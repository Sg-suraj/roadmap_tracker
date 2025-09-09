import os
from flask import Flask
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from config import config

db = None # Firestore client instance

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # --- UPDATED FIREBASE INITIALIZATION ---
    try:
        # Define the path for Render's secret file directory
        prod_credentials_path = '/etc/secrets/firebase_key.json'
        
        # Define the path for your local development file from your .env
        dev_credentials_path = app.config.get('FIREBASE_CREDENTIALS', 'firebase_key.json')

        # Use the production path if it exists, otherwise use the local path
        if os.path.exists(prod_credentials_path):
            credentials_path = prod_credentials_path
        else:
            credentials_path = dev_credentials_path

        cred = credentials.Certificate(credentials_path)
        firebase_admin.initialize_app(cred)
        global db
        db = firestore.client()
        print("Firebase successfully initialized!")
    except Exception as e:
        print(f"Error initializing Firebase: {e}")

    CORS(app)
    
    # Register blueprints
    from app.views import main
    from app.api import api
    
    app.register_blueprint(main)
    app.register_blueprint(api, url_prefix='/api')
    
    return app