// Game Configuration
export const CONFIG = {
    CANVAS_WIDTH: 1280, // Internal resolution
    CANVAS_HEIGHT: 720,

    // Lanes
    LANE_COUNT: 4,
    KEYS: ['KeyF', 'KeyG', 'KeyH', 'KeyJ'], // Updated mapping

    // Mechanics
    SCROLL_SPEED: 1.0, // Multiplier (Pixels per MS potentially, or scale factor)
    NOTE_SPEED: 300,  // Time in MS for a note to travel from spawn to judge line (Faster = Lower)

    // Visuals
    JUDGE_LINE_Y: 0.85, // 85% down the screen

    // Judgment Windows (in milliseconds)
    JUDGMENT: {
        PERFECT: 35,
        GREAT: 65,
        GOOD: 100,
        NORMAL: 130,
        BAD: 160,
        WORST: 190,
        MISS: 200 // Anything beyond this is ignored or miss
    },

    // Judgment Colors for Text
    COLORS: {
        PERFECT: '#00ffff', // Cyan
        GREAT: '#00ff00',   // Green
        GOOD: '#ffff00',    // Yellow
        NORMAL: '#ffaa00',  // Orange
        BAD: '#ff0000',     // Red
        WORST: '#880000',   // Dark Red
        MISS: '#555555'     // Grey
    }
};
