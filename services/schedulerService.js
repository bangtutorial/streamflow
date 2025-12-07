const Stream = require('../models/Stream');

const scheduledTerminations = new Map();
const SCHEDULE_LOOKAHEAD_SECONDS = 60;

let streamingService = null;
let initialized = false;
let scheduleIntervalId = null;
let durationIntervalId = null;

// ---------------------- INIT -------------------------

function init(streamingServiceInstance) {
    if (initialized) {
        console.log('Stream scheduler already initialized');
        return;
    }

    streamingService = streamingServiceInstance;
    initialized = true;

    console.log('Stream scheduler initialized');

    // Schedule start & end check every 1 minute
    scheduleIntervalId = setInterval(() => {
        checkScheduledStreams();
        checkScheduleEnds(); // FIX: now valid
    }, 60 * 1000);

    durationIntervalId = setInterval(checkStreamDurations, 60 * 1000);

    // Run immediately on startup
    checkScheduledStreams();
    checkScheduleEnds();
    checkStreamDurations();
}

// ---------------------- SCHEDULE START -------------------------

async function checkScheduledStreams() {
    try {
        if (!streamingService) return console.error('StreamingService not initialized');

        const now = new Date();
        const lookAheadTime = new Date(now.getTime() + SCHEDULE_LOOKAHEAD_SECONDS * 1000);

        const streams = await Stream.findScheduledInRange(now, lookAheadTime);

        for (const stream of streams) {
            console.log(`Starting scheduled stream: ${stream.id} - ${stream.title}`);

            const result = await streamingService.startStream(stream.id);
            if (result.success) {
                console.log(`Successfully started scheduled stream: ${stream.id}`);
            } else {
                console.error(`Failed to start scheduled stream ${stream.id}: ${result.error}`);
            }
        }
    } catch (error) {
        console.error('Error checking scheduled streams:', error);
    }
}

// ---------------------- SCHEDULE END (FIX) -------------------------

async function checkScheduleEnds() {
    try {
        if (!streamingService) return console.error('StreamingService not initialized');

        const now = new Date();
        const liveStreams = await Stream.findAll(null, 'live');

        for (const stream of liveStreams) {
            if (!stream.schedule_end_time) continue;

            const endTime = new Date(stream.schedule_end_time);

            if (now >= endTime) {
                console.log(`[Scheduler] Scheduled END reached for stream ${stream.id}, stopping...`);

                // Stop stream
                await streamingService.stopStream(stream.id);

                // Reset schedule fields
                await Stream.update(stream.id, {
                    schedule_end_time: null,
                    schedule_start_time: null
                });

                cancelStreamTermination(stream.id);
            }
        }
    } catch (error) {
        console.error('Error checking schedule ends:', error);
    }
}

// ---------------------- DURATION HANDLING -------------------------

async function checkStreamDurations() {
    try {
        if (!streamingService) return console.error('StreamingService not initialized');

        const liveStreams = await Stream.findAll(null, 'live');

        for (const stream of liveStreams) {
            if (stream.duration && stream.start_time && !scheduledTerminations.has(stream.id)) {
                const startTime = new Date(stream.start_time);
                const durationMs = stream.duration * 60 * 1000;

                const shouldEndAt = new Date(startTime.getTime() + durationMs);
                const now = new Date();

                if (shouldEndAt <= now) {
                    console.log(`Stream ${stream.id} exceeded duration, stopping now`);
                    await streamingService.stopStream(stream.id);
                } else {
                    const timeUntilEnd = shouldEndAt.getTime() - now.getTime();
                    scheduleStreamTermination(stream.id, timeUntilEnd / 60000);
                }
            }
        }
    } catch (error) {
        console.error('Error checking stream durations:', error);
    }
}

// ---------------------- TERMINATION CONTROL -------------------------

function scheduleStreamTermination(streamId, durationMinutes) {
    if (!streamingService) return console.error('StreamingService not initialized');

    if (typeof durationMinutes !== 'number' || Number.isNaN(durationMinutes)) {
        console.error(`Invalid duration for stream ${streamId}: ${durationMinutes}`);
        return;
    }

    if (scheduledTerminations.has(streamId)) {
        clearTimeout(scheduledTerminations.get(streamId));
    }

    const durationMs = Math.max(0, durationMinutes) * 60 * 1000;

    console.log(`Scheduling termination for stream ${streamId} after ${durationMinutes} minutes`);

    const timeoutId = setTimeout(async () => {
        try {
            console.log(`Terminating stream ${streamId} after scheduled duration`);
            await streamingService.stopStream(streamId);
            scheduledTerminations.delete(streamId);
        } catch (err) {
            console.error(`Error terminating stream ${streamId}:`, err);
        }
    }, durationMs);

    scheduledTerminations.set(streamId, timeoutId);
}

function cancelStreamTermination(streamId) {
    if (scheduledTerminations.has(streamId)) {
        clearTimeout(scheduledTerminations.get(streamId));
        scheduledTerminations.delete(streamId);
        console.log(`Cancelled scheduled termination for stream ${streamId}`);
        return true;
    }
    return false;
}

function handleStreamStopped(streamId) {
    return cancelStreamTermination(streamId);
}

module.exports = {
    init,
    scheduleStreamTermination,
    cancelStreamTermination,
    handleStreamStopped
};
