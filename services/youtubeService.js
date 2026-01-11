const { google } = require('googleapis');
const { encrypt, decrypt } = require('../utils/encryption');
const User = require('../models/User');
const Stream = require('../models/Stream');
const YoutubeChannel = require('../models/YoutubeChannel');
const fs = require('fs');
const path = require('path');

const loggedAlreadyHasBroadcast = new Set();

function getYouTubeOAuth2Client(clientId, clientSecret, redirectUri) {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function createYouTubeBroadcast(streamId, baseUrl) {
  const stream = await Stream.findById(streamId);
  if (!stream) {
    throw new Error('Stream not found');
  }

  if (!stream.is_youtube_api) {
    return { success: true, message: 'Not a YouTube API stream' };
  }

  if (stream.youtube_broadcast_id && stream.rtmp_url && stream.stream_key) {
    if (!loggedAlreadyHasBroadcast.has(streamId)) {
      console.log(`[YouTubeService] Stream ${streamId} already has YouTube broadcast, skipping creation`);
      loggedAlreadyHasBroadcast.add(streamId);
    }
    return { 
      success: true, 
      rtmpUrl: stream.rtmp_url, 
      streamKey: stream.stream_key,
      broadcastId: stream.youtube_broadcast_id,
      streamId: stream.youtube_stream_id
    };
  }

  const user = await User.findById(stream.user_id);
  if (!user || !user.youtube_client_id || !user.youtube_client_secret) {
    throw new Error('YouTube API credentials not configured');
  }

  const selectedChannel = await YoutubeChannel.findById(stream.youtube_channel_id);
  if (!selectedChannel || !selectedChannel.access_token || !selectedChannel.refresh_token) {
    throw new Error('YouTube channel not found or not connected');
  }

  const clientSecret = decrypt(user.youtube_client_secret);
  const accessToken = decrypt(selectedChannel.access_token);
  const refreshToken = decrypt(selectedChannel.refresh_token);

  if (!clientSecret || !accessToken) {
    throw new Error('Failed to decrypt YouTube credentials');
  }

  const redirectUri = `${baseUrl}/auth/youtube/callback`;
  const oauth2Client = getYouTubeOAuth2Client(user.youtube_client_id, clientSecret, redirectUri);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await YoutubeChannel.update(selectedChannel.id, {
        access_token: encrypt(tokens.access_token)
      });
    }
    if (tokens.refresh_token) {
      await YoutubeChannel.update(selectedChannel.id, {
        refresh_token: encrypt(tokens.refresh_token)
      });
    }
  });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const tagsArray = stream.youtube_tags ? stream.youtube_tags.split(',').map(t => t.trim()).filter(t => t) : [];

  const broadcastSnippet = {
    title: stream.title,
    description: stream.youtube_description || '',
    scheduledStartTime: new Date().toISOString()
  };

  console.log(`[YouTubeService] Creating YouTube broadcast for stream ${streamId}`);

  const broadcastResponse = await youtube.liveBroadcasts.insert({
    part: 'snippet,contentDetails,status',
    requestBody: {
      snippet: broadcastSnippet,
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
        monitorStream: {
          enableMonitorStream: false
        }
      },
      status: {
        privacyStatus: stream.youtube_privacy || 'unlisted',
        selfDeclaredMadeForKids: false
      }
    }
  });

  const broadcast = broadcastResponse.data;
  console.log(`[YouTubeService] Created broadcast: ${broadcast.id}`);

  if (tagsArray.length > 0 || stream.youtube_category) {
    try {
      const videoResponse = await youtube.videos.list({
        part: 'snippet',
        id: broadcast.id
      });

      if (videoResponse.data.items && videoResponse.data.items.length > 0) {
        const currentSnippet = videoResponse.data.items[0].snippet;
        await youtube.videos.update({
          part: 'snippet',
          requestBody: {
            id: broadcast.id,
            snippet: {
              title: stream.title,
              description: stream.youtube_description || '',
              categoryId: stream.youtube_category || '22',
              tags: tagsArray.length > 0 ? tagsArray : currentSnippet.tags,
              defaultLanguage: currentSnippet.defaultLanguage,
              defaultAudioLanguage: currentSnippet.defaultAudioLanguage
            }
          }
        });
      }
    } catch (updateError) {
      console.log('[YouTubeService] Note: Could not update video metadata:', updateError.message);
    }
  }

  if (stream.youtube_thumbnail) {
    try {
      const projectRoot = path.resolve(__dirname, '..');
      const thumbnailPath = path.join(projectRoot, 'public', stream.youtube_thumbnail);
      if (fs.existsSync(thumbnailPath)) {
        const thumbnailStream = fs.createReadStream(thumbnailPath);
        await youtube.thumbnails.set({
          videoId: broadcast.id,
          media: {
            mimeType: 'image/jpeg',
            body: thumbnailStream
          }
        });
        console.log(`[YouTubeService] Uploaded thumbnail for broadcast ${broadcast.id}`);
      }
    } catch (thumbError) {
      console.log('[YouTubeService] Note: Could not upload thumbnail:', thumbError.message);
    }
  }

  const streamResponse = await youtube.liveStreams.insert({
    part: 'snippet,cdn,contentDetails,status',
    requestBody: {
      snippet: {
        title: `${stream.title} - Stream`
      },
      cdn: {
        frameRate: '30fps',
        ingestionType: 'rtmp',
        resolution: '1080p'
      },
      contentDetails: {
        isReusable: false
      }
    }
  });

  const liveStream = streamResponse.data;
  console.log(`[YouTubeService] Created live stream: ${liveStream.id}`);

  await youtube.liveBroadcasts.bind({
    part: 'id,contentDetails',
    id: broadcast.id,
    streamId: liveStream.id
  });

  const rtmpUrl = liveStream.cdn.ingestionInfo.ingestionAddress;
  const streamKey = liveStream.cdn.ingestionInfo.streamName;

  await Stream.update(streamId, {
    youtube_broadcast_id: broadcast.id,
    youtube_stream_id: liveStream.id,
    rtmp_url: rtmpUrl,
    stream_key: streamKey
  });

  console.log(`[YouTubeService] YouTube broadcast created successfully for stream ${streamId}`);

  return {
    success: true,
    broadcastId: broadcast.id,
    streamId: liveStream.id,
    rtmpUrl: rtmpUrl,
    streamKey: streamKey
  };
}

async function deleteYouTubeBroadcast(streamId) {
  try {
    loggedAlreadyHasBroadcast.delete(streamId);
    
    const stream = await Stream.findById(streamId);
    if (!stream || !stream.is_youtube_api || !stream.youtube_broadcast_id) {
      return { success: true, message: 'No YouTube broadcast to clean up' };
    }

    await Stream.update(streamId, {
      rtmp_url: '',
      stream_key: ''
    });

    console.log(`[YouTubeService] Cleared RTMP credentials for stream ${streamId} (broadcast ID kept for YouTube Studio access)`);

    return { success: true };
  } catch (error) {
    console.error('[YouTubeService] Error clearing YouTube broadcast data:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createYouTubeBroadcast,
  deleteYouTubeBroadcast,
  getYouTubeOAuth2Client
};
