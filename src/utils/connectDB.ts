import mongoose from "mongoose";
import { appConfig } from "@/config/app-config.js";

const RECONNECT_DELAY_MS = 5000;

// Mongoose readyState values:
// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
const MONGOOSE_READY_STATE = {
    DISCONNECTED: 0,
    CONNECTED: 1,
    CONNECTING: 2,
    DISCONNECTING: 3,
} as const;

let reconnectTimer: NodeJS.Timeout | null = null;
let listenersAttached = false;

function isConnectedOrConnecting() {
    const state = mongoose.connection.readyState;
    return state === MONGOOSE_READY_STATE.CONNECTED || state === MONGOOSE_READY_STATE.CONNECTING;
}

/**
 * Schedules exactly one delayed reconnect attempt.
 *
 * We skip scheduling when:
 * - a retry is already queued (`reconnectTimer` is set), or
 * - Mongoose is already connected/connecting.
 */
function scheduleReconnect() {
    if (reconnectTimer || isConnectedOrConnecting()) {
        return;
    }

    reconnectTimer = setTimeout(async () => {
        // This timer has now fired, so clear the "retry scheduled" marker.
        // Doing this allows future retries to be scheduled if this attempt fails.
        reconnectTimer = null;
        try {
            await connectDB();
        } catch (err) {
            console.error("MongoDB reconnect attempt failed:", err);
            scheduleReconnect();
        }
    }, RECONNECT_DELAY_MS);
}

/**
 * Ensures DB event listeners are registered only once.
 * Without this guard, each reconnect could attach duplicate listeners.
 */
function attachConnectionListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    mongoose.connection.on("error", (err) => {
        console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected");
        scheduleReconnect();
    });
}

/**
 * Opens the initial Mongo connection (or no-ops if already connected/connecting).
 */
export async function connectDB() {
    const uri = appConfig.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI environment variable is not set");

    if (isConnectedOrConnecting()) {
        return;
    }

    await mongoose.connect(uri);
    attachConnectionListeners();
    console.log('✅ Connected to MongoDB');

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}
