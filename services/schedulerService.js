const Stream = require('../models/Stream');

const scheduledTerminations = new Map();
const SCHEDULE_CHECK_INTERVAL = 15000;
const DURATION_CHECK_INTERVAL = 30000;

let streamingService = null;
let initialized = false;
let scheduleIntervalId = null;
let durationIntervalId = null;

function init(streamingServiceInstance) {
  if (initialized) {
    return;
  }

  streamingService = streamingServiceInstance;
  streamingService.setSchedulerService(module.exports);
  initialized = true;

  scheduleIntervalId = setInterval(checkScheduledStreams, SCHEDULE_CHECK_INTERVAL);
  durationIntervalId = setInterval(checkStreamDurations, DURATION_CHECK_INTERVAL);

  checkScheduledStreams();
  checkStreamDurations();
}

async function checkScheduledStreams() {
  try {
    if (!streamingService) {
      return;
    }

    const now = new Date();
    const streams = await Stream.findScheduledInRange(null, now);

    for (const stream of streams) {
      if (streamingService.isStreamActive(stream.id)) {
        continue;
      }

      const currentStream = await Stream.findById(stream.id);
      if (!currentStream || currentStream.status !== 'scheduled') {
        continue;
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:7575';
      const result = await streamingService.startStream(stream.id, false, baseUrl);

      if (!result.success) {
        console.error(`[Scheduler] Failed to start stream ${stream.id}: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking scheduled streams:', error);
  }
}

async function checkStreamDurations() {
  try {
    if (!streamingService) {
      return;
    }

    const liveStreams = await Stream.findAll(null, 'live');

    for (const stream of liveStreams) {
      if (!stream.end_time) {
        continue;
      }

      const endTime = new Date(stream.end_time);
      const now = new Date();
      const timeUntilEnd = endTime.getTime() - now.getTime();

      if (timeUntilEnd <= 0) {
        scheduledTerminations.delete(stream.id);

        try {
          await streamingService.stopStream(stream.id);
        } catch (e) {
          await Stream.updateStatus(stream.id, 'offline', stream.user_id);
        }
      } else if (timeUntilEnd <= 60000 && !scheduledTerminations.has(stream.id)) {
        scheduleStreamTermination(stream.id, timeUntilEnd / 60000, stream.user_id);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking stream durations:', error);
  }
}

function scheduleStreamTermination(streamId, durationMinutes, userId = null) {
  if (!streamingService) {
    return;
  }

  if (typeof durationMinutes !== 'number' || Number.isNaN(durationMinutes) || durationMinutes < 0) {
    return;
  }

  if (scheduledTerminations.has(streamId)) {
    const existing = scheduledTerminations.get(streamId);
    if (existing.timeoutId) {
      clearTimeout(existing.timeoutId);
    }
  }

  const durationMs = Math.max(0, durationMinutes * 60 * 1000);
  const targetEndTime = Date.now() + durationMs;

  const timeoutId = setTimeout(async () => {
    try {
      const stream = await Stream.findById(streamId);
      if (!stream || stream.status !== 'live') {
        scheduledTerminations.delete(streamId);
        return;
      }

      await streamingService.stopStream(streamId);
      scheduledTerminations.delete(streamId);
    } catch (error) {
      scheduledTerminations.delete(streamId);
    }
  }, durationMs);

  scheduledTerminations.set(streamId, {
    timeoutId,
    targetEndTime,
    userId
  });
}

function cancelStreamTermination(streamId) {
  if (scheduledTerminations.has(streamId)) {
    const scheduled = scheduledTerminations.get(streamId);
    if (scheduled.timeoutId) {
      clearTimeout(scheduled.timeoutId);
    }
    scheduledTerminations.delete(streamId);
    return true;
  }
  return false;
}

function getScheduledTermination(streamId) {
  const scheduled = scheduledTerminations.get(streamId);
  if (!scheduled) return null;

  return {
    streamId,
    targetEndTime: scheduled.targetEndTime,
    remainingMs: scheduled.targetEndTime ? scheduled.targetEndTime - Date.now() : null
  };
}

function handleStreamStopped(streamId) {
  return cancelStreamTermination(streamId);
}

function shutdown() {
  if (scheduleIntervalId) {
    clearInterval(scheduleIntervalId);
  }
  if (durationIntervalId) {
    clearInterval(durationIntervalId);
  }

  for (const [streamId, scheduled] of scheduledTerminations) {
    if (scheduled.timeoutId) {
      clearTimeout(scheduled.timeoutId);
    }
  }
  scheduledTerminations.clear();
}

module.exports = {
  init,
  scheduleStreamTermination,
  cancelStreamTermination,
  getScheduledTermination,
  handleStreamStopped,
  checkScheduledStreams,
  checkStreamDurations,
  shutdown
};
