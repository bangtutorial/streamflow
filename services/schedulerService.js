const Stream = require('../models/Stream');
const scheduledTerminations = new Map();
const scheduledStarts = new Map(); 
const SCHEDULE_LOOKAHEAD_SECONDS = 10; 
let streamingService = null;
function init(streamingServiceInstance) {
  streamingService = streamingServiceInstance;
  console.log('Stream scheduler initialized');
  setInterval(checkScheduledStreams, 10 * 1000);
  setInterval(checkStreamDurations, 60 * 1000);
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
    
    console.log(`Checking for scheduled streams (${now.toISOString()} to ${lookAheadTime.toISOString()})`);
    
    const streams = await Stream.findScheduledInRange(now, lookAheadTime);
    
    if (streams.length > 0) {
      console.log(`Found ${streams.length} streams to schedule start`);
      for (const stream of streams) {
        if (scheduledStarts.has(stream.id)) {
          continue;
        }
        
        const scheduleTime = new Date(stream.schedule_time);
        const timeDiff = scheduleTime - now;
        
        if (timeDiff <= 5000) {
          console.log(`Starting scheduled stream: ${stream.id} - ${stream.title} (${timeDiff}ms early)`);
          const result = await streamingService.startStream(stream.id);
          if (result.success) {
            console.log(`Successfully started scheduled stream: ${stream.id}`);
            if (stream.duration) {
              scheduleStreamTermination(stream.id, stream.duration);
            }
          } else {
            console.error(`Failed to start scheduled stream ${stream.id}: ${result.error}`);
          }
        } else {
          console.log(`Scheduling precise start for stream ${stream.id} in ${timeDiff}ms`);
          const timeoutId = setTimeout(async () => {
            try {
              scheduledStarts.delete(stream.id);
              
              const result = await streamingService.startStream(stream.id);
              if (result.success) {
                console.log(`Successfully started scheduled stream: ${stream.id} at exact time`);
                if (stream.duration) {
                  scheduleStreamTermination(stream.id, stream.duration);
                }
              } else {
                console.error(`Failed to start scheduled stream ${stream.id}: ${result.error}`);
              }
            } catch (error) {
              console.error(`Error starting scheduled stream ${stream.id}:`, error);
            }
          }, timeDiff);
          
          scheduledStarts.set(stream.id, timeoutId);
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
function scheduleStreamTermination(streamId, durationMinutes) {
  if (scheduledTerminations.has(streamId)) {
    clearTimeout(scheduledTerminations.get(streamId));
  }
  const durationMs = durationMinutes * 60 * 1000;
  console.log(`Scheduling termination for stream ${streamId} after ${durationMinutes} minutes`);
  const timeoutId = setTimeout(async () => {
    try {
      console.log(`Terminating stream ${streamId} after ${durationMinutes} minute duration`);
      await streamingService.stopStream(streamId);
      scheduledTerminations.delete(streamId);
    } catch (error) {
      console.error(`Error terminating stream ${streamId}:`, error);
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

function cancelStreamStart(streamId) {
  if (scheduledStarts.has(streamId)) {
    clearTimeout(scheduledStarts.get(streamId));
    scheduledStarts.delete(streamId);
    console.log(`Cancelled scheduled start for stream ${streamId}`);
    return true;
  }
  return false;
}

function handleStreamStopped(streamId) {
  const terminationCancelled = cancelStreamTermination(streamId);
  const startCancelled = cancelStreamStart(streamId);
  return terminationCancelled || startCancelled;
}
module.exports = {
  init,
  scheduleStreamTermination,
  cancelStreamTermination,
  cancelStreamStart,
  handleStreamStopped
};