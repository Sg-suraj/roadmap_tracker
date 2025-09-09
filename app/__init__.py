from flask import Flask
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from config import config

db = None # Firestore client instance

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize Firebase Admin SDK
    try:
        cred = credentials.Certificate(app.config['FIREBASE_CREDENTIALS'])
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