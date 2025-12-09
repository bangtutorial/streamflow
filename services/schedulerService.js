const Stream = require('../models/Stream');
const scheduledTerminations = new Map();
const SCHEDULE_LOOKAHEAD_SECONDS = 60;
const MAX_TIMEOUT_MS = 2147483647;
const LONG_DURATION_CHECK_INTERVAL = 5 * 60 * 1000;
let streamingService = null;
let initialized = false;
let scheduleIntervalId = null;
let durationIntervalId = null;
function init(streamingServiceInstance) {
  if (initialized) {
    console.log('Stream scheduler already initialized');
    return;
  }
  streamingService = streamingServiceInstance;
  initialized = true;
  console.log('Stream scheduler initialized');
  scheduleIntervalId = setInterval(checkScheduledStreams, 60 * 1000);
  durationIntervalId = setInterval(checkStreamDurations, 60 * 1000);
  checkScheduledStreams();
  checkStreamDurations();
}
async function checkScheduledStreams() {
  try {
    if (!streamingService) {
      console.error('StreamingService not initialized in scheduler');
      return;
    }
    const now = new Date();
    const lookAheadTime = new Date(now.getTime() + SCHEDULE_LOOKAHEAD_SECONDS * 1000);
    const streams = await Stream.findScheduledInRange(now, lookAheadTime);
    
    if (streams.length > 0) {
      console.log(`Found ${streams.length} streams to schedule start`);
      
      for (const stream of streams) {
        if (streamingService.isStreamActive(stream.id)) {
          console.log(`Stream ${stream.id} is already active, skipping scheduled start`);
          continue;
        }
        
        const currentStream = await Stream.findById(stream.id);
        if (!currentStream || currentStream.status !== 'scheduled') {
          console.log(`Stream ${stream.id} status changed to '${currentStream?.status}', skipping scheduled start`);
          continue;
        }
        
        console.log(`Starting scheduled stream: ${stream.id} - ${stream.title} (user: ${stream.user_id})`);
        const result = await streamingService.startStream(stream.id);
        
        if (result.success) {
          console.log(`Successfully started scheduled stream: ${stream.id}`);
        } else {
          console.error(`Failed to start scheduled stream ${stream.id}: ${result.error}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking scheduled streams:', error);
  }
}
async function checkStreamDurations() {
  try {
    if (!streamingService) {
      console.error('StreamingService not initialized in scheduler');
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
        console.log(`Stream ${stream.id} reached end_time (user: ${stream.user_id}), stopping now`);
        scheduledTerminations.delete(stream.id);
        await streamingService.stopStream(stream.id);
      } else {
        const existing = scheduledTerminations.get(stream.id);

        const expectedEndTime = endTime.getTime();
        const needsReschedule = !existing ||
          !existing.targetEndTime ||
          Math.abs(existing.targetEndTime - expectedEndTime) > 30000;

        if (needsReschedule) {
          const remainingMinutes = timeUntilEnd / 60000;
          console.log(`[Scheduler] Scheduling/updating termination for stream ${stream.id}, ${remainingMinutes.toFixed(1)} min remaining (end_time: ${stream.end_time})`);
          scheduleStreamTermination(stream.id, remainingMinutes, stream.user_id);
        }
      }
    }
  } catch (error) {
    console.error('Error checking stream durations:', error);
  }
}
function scheduleStreamTermination(streamId, durationMinutes, userId = null) {
  if (!streamingService) {
    console.error('StreamingService not initialized in scheduler');
    return;
  }
  
  if (typeof durationMinutes !== 'number' || Number.isNaN(durationMinutes)) {
    console.error(`Invalid duration provided for stream ${streamId}: ${durationMinutes}`);
    return;
  }
  
  if (scheduledTerminations.has(streamId)) {
    const existing = scheduledTerminations.get(streamId);
    if (existing.timeoutId) {
      clearTimeout(existing.timeoutId);
    }
  }
  
  const clampedMinutes = Math.max(0, durationMinutes);
  let durationMs = clampedMinutes * 60 * 1000;
  
  if (durationMs > MAX_TIMEOUT_MS) {
    console.log(`Stream ${streamId} has very long duration (${clampedMinutes} min). Scheduling periodic check instead.`);

    const checkInterval = Math.min(LONG_DURATION_CHECK_INTERVAL, MAX_TIMEOUT_MS);

    const timeoutId = setTimeout(async () => {
      try {
        const stream = await Stream.findById(streamId);
        if (!stream || stream.status !== 'live') {
          scheduledTerminations.delete(streamId);
          return;
        }

        if (stream.end_time) {
          const endTime = new Date(stream.end_time);
          const now = new Date();
          const remainingMs = endTime.getTime() - now.getTime();

          if (remainingMs <= 0) {
            console.log(`Long-running stream ${streamId} reached end_time, stopping`);
            await streamingService.stopStream(streamId);
            scheduledTerminations.delete(streamId);
          } else {
            const remainingMinutes = remainingMs / 60000;
            console.log(`Re-scheduling termination for stream ${streamId}, ${remainingMinutes.toFixed(1)} minutes remaining`);
            scheduleStreamTermination(streamId, remainingMinutes, userId);
          }
        } else {
          scheduledTerminations.delete(streamId);
        }
      } catch (error) {
        console.error(`Error in long-duration check for stream ${streamId}:`, error);
      }
    }, checkInterval);

    scheduledTerminations.set(streamId, {
      timeoutId,
      targetEndTime: Date.now() + durationMs,
      userId,
      isLongDuration: true
    });

    console.log(`Scheduled long-duration check for stream ${streamId} in ${checkInterval / 60000} minutes`);
    return;
  }
  
  console.log(`Scheduling termination for stream ${streamId} after ${clampedMinutes.toFixed(1)} minutes`);
  
  const timeoutId = setTimeout(async () => {
    try {
      const stream = await Stream.findById(streamId);
      if (!stream || stream.status !== 'live') {
        console.log(`Stream ${streamId} is no longer live, skipping termination`);
        scheduledTerminations.delete(streamId);
        return;
      }
      
      console.log(`Terminating stream ${streamId} after scheduled duration`);
      await streamingService.stopStream(streamId);
      scheduledTerminations.delete(streamId);
    } catch (error) {
      console.error(`Error terminating stream ${streamId}:`, error);
      scheduledTerminations.delete(streamId);
    }
  }, durationMs);
  
  scheduledTerminations.set(streamId, {
    timeoutId,
    targetEndTime: Date.now() + durationMs,
    userId,
    isLongDuration: false
  });
}
function cancelStreamTermination(streamId) {
  if (scheduledTerminations.has(streamId)) {
    const scheduled = scheduledTerminations.get(streamId);
    if (scheduled.timeoutId) {
      clearTimeout(scheduled.timeoutId);
    } else if (typeof scheduled === 'number') {
      clearTimeout(scheduled);
    }
    scheduledTerminations.delete(streamId);
    console.log(`Cancelled scheduled termination for stream ${streamId}`);
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
    isLongDuration: scheduled.isLongDuration,
    remainingMs: scheduled.targetEndTime ? scheduled.targetEndTime - Date.now() : null
  };
}
function handleStreamStopped(streamId) {
  return cancelStreamTermination(streamId);
}
module.exports = {
  init,
  scheduleStreamTermination,
  cancelStreamTermination,
  getScheduledTermination,
  handleStreamStopped,
  checkScheduledStreams,
  checkStreamDurations
};
