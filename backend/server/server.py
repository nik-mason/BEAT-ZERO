from flask import Flask, send_from_directory
import os

# Define the frontend directory path explicitly relative to this file
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend'))

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')

@app.route('/')
def home():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)

if __name__ == '__main__':
    print(f"Serving frontend from: {FRONTEND_DIR}")
    app.run(debug=True, port=8000)
