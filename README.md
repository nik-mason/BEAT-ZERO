# BEAT//ZERO

**BEAT//ZERO** is a hardcore web-based rhythm game designed for players who crave timing accuracy and stunning visuals. Built with modern web technologies, it runs directly in your browser without installation.

![Screenshot](https://via.placeholder.com/800x450?text=BEAT//ZERO+Gameplay)

## 🎮 Game Features

-   **Web-Optimized Engine**: Low-latency input handling and accurate audio synchronization using the Web Audio API.
-   **Immersive Visuals**: Neon-style glow effects, dynamic camera shake, and particle explosions on hit.
-   **Strict Judgment System**: Ranging from **PERFECT** to **MISS**, challenging you to hit notes with millisecond precision.
-   **Custom Chart Support**: Easily modify the chart by editing a local JSON file.

## 🕹️ Controls

| Key | Lane |
| :---: | :---: |
| **F** | Lane 1 |
| **G** | Lane 2 |
| **H** | Lane 3 |
| **J** | Lane 4 |

## 🚀 How to Run

### Prerequisites
-   Python 3.x installed
-   Modern Web Browser (Chrome recommended)

### Installation & Execution

1.  **Clone the repository** (or download source):
    ```bash
    git clone https://github.com/nik-mason/BEAT-ZERO.git
    cd BEAT-ZERO
    ```

2.  **Install dependencies** (if any, currently only Flask is needed):
    ```bash
    pip install flask
    ```

3.  **Run the Server**:
    ```bash
    python backend/server/server.py
    ```

4.  **Play**:
    Open your browser and navigate to: [http://localhost:3937](http://localhost:3937)

## 🎵 Customizing Charts

You can create your own beatmaps by editing `frontend/assets/chart.json`.

**Format:**
```json
{
    "description": "Add timestamps (in seconds)",
    "timestamps": [
        2.5,
        3.0,
        3.5,
        ...
    ]
}
```
-   Simply add the timestamp (in seconds) for each note.
-   The game engine handles lane randomization automatically to prevent monotonous patterns.

## 🛠️ Tech Stack

-   **Frontend**: HTML5 Canvas, CSS3 (Animations), JavaScript (ES6 Modules)
-   **Backend**: Python (Flask) for serving static files
-   **Audio**: Web Audio API

---
*Created by Antigravity*
