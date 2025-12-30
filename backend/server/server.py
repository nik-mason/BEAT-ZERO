from flask import Flask, request, jsonify, send_from_directory
import os
import json
import threading
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

# Define the frontend directory path explicitly relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
CHART_PATH = os.path.join(FRONTEND_DIR, 'assets', 'chart.json')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
USERS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')
RANKINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rankings.json')
SETTINGS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.json')

# Threading locks for concurrent file access (Full Audit Fix)
users_lock = threading.Lock()
rankings_lock = threading.Lock()
settings_lock = threading.Lock()
charts_lock = threading.Lock()

@app.route('/api/get_settings', methods=['GET'])
def get_settings():
    try:
        username = request.args.get('username')
        if not username:
            return jsonify({"error": "Missing username"}), 400

        with settings_lock:
            if not os.path.exists(SETTINGS_PATH):
                return jsonify({})

            with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                all_settings = json.load(f)
                return jsonify(all_settings.get(username, {}))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save_settings', methods=['POST'])
def save_settings():
    try:
        data = request.json
        username = data.get('username')
        settings = data.get('settings')

        if not username or not settings:
            return jsonify({"error": "Missing data"}), 400

        with settings_lock:
            all_settings = {}
            if os.path.exists(SETTINGS_PATH):
                with open(SETTINGS_PATH, 'r', encoding='utf-8') as f:
                    all_settings = json.load(f)

            all_settings[username] = settings

            with open(SETTINGS_PATH, 'w', encoding='utf-8') as f:
                json.dump(all_settings, f, indent=4)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        
        with users_lock:
            if not os.path.exists(USERS_PATH):
                return jsonify({"error": "Users file not found"}), 500
                
            with open(USERS_PATH, 'r', encoding='utf-8') as f:
                users = json.load(f)
                
        hashed_password = users.get(username)
        if hashed_password and check_password_hash(hashed_password, password):
            return jsonify({"status": "success"})
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        username = data.get('username').strip()
        password = data.get('password').strip()

        if not username or not password:
            return jsonify({"error": "Missing username or password"}), 400

        with users_lock:
            users = {}
            if os.path.exists(USERS_PATH):
                with open(USERS_PATH, 'r', encoding='utf-8') as f:
                    users = json.load(f)

            if username in users:
                return jsonify({"error": "User already exists"}), 400

            # Secure Hashing (Full Audit Fix)
            users[username] = generate_password_hash(password)
            with open(USERS_PATH, 'w', encoding='utf-8') as f:
                json.dump(users, f, indent=4)

        return jsonify({"status": "success"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_rankings', methods=['GET'])
def get_rankings():
    try:
        if not os.path.exists(RANKINGS_PATH):
            return jsonify({})
        with open(RANKINGS_PATH, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save_score', methods=['POST'])
def save_score():
    try:
        data = request.json
        song_name = data.get('song_name')
        username = data.get('username')
        score = data.get('score')
        accuracy = data.get('accuracy')
        grade = data.get('grade')

        if not all([song_name, username, score is not None]):
            return jsonify({"error": "Missing score data"}), 400

        with rankings_lock:
            rankings = {}
            if os.path.exists(RANKINGS_PATH):
                with open(RANKINGS_PATH, 'r', encoding='utf-8') as f:
                    rankings = json.load(f)

            if song_name not in rankings:
                rankings[song_name] = []

            # Add new score entry
            rankings[song_name].append({
                "username": username,
                "score": score,
                "accuracy": accuracy,
                "grade": grade,
                "date": datetime.now().strftime("%Y-%m-%d %H:%M")
            })

            # Keep only top 100 for each song, sorted by score
            rankings[song_name].sort(key=lambda x: x['score'], reverse=True)
            rankings[song_name] = rankings[song_name][:100]

            with open(RANKINGS_PATH, 'w', encoding='utf-8') as f:
                json.dump(rankings, f, indent=4, ensure_ascii=False)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/')
def home():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

@app.route('/api/update_songs', methods=['POST'])
def update_songs():
    try:
        data = request.json
        # Administrative Access Check (Full Audit Fix)
        # Note: In a real app, this would use a secure session token.
        # For this prototype, we check the username provided in the request metadata if available,
        # or simplified check for a specific admin key.
        admin_user = data.get('admin_user')
        if admin_user != 'mason14':
            return jsonify({"error": "Unauthorized. Admin access required."}), 403

        new_songs = data.get('songs')
        if not isinstance(new_songs, list):
            return jsonify({"error": "Invalid format, expected list of songs"}), 400

        with charts_lock:
            with open(CHART_PATH, 'w', encoding='utf-8') as f:
                json.dump(new_songs, f, indent=4, ensure_ascii=False)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print(f"Serving frontend from: {FRONTEND_DIR}")
    app.run(debug=True, port=3937)
