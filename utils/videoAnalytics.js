const axios = require('axios');

class VideoAnalytics {
    constructor() {

    }

    extractVideoId(url) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
            /(?:https?:\/\/)?studio\.youtube\.com\/video\/([a-zA-Z0-9_-]{11})\/livestreaming/,
            /^([a-zA-Z0-9_-]{11})$/ 
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }    
    async getVideoLiveStats(videoId) {
        try {
            const response = await axios.get(`https://api.subscribercounter.nl/api/youtube/videos/stats/${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.success && response.data.results && response.data.results.length > 0) {
                const data = response.data.results[0];
                return {
                    status: true,
                    liveViews: parseInt(data.views) || 0,
                    liveLikes: parseInt(data.likes) || 0,
                    liveComments: parseInt(data.comments) || 0,
                    liveViewers: parseInt(data.liveViewers) || 0,
                    isLive: data.isLive || false
                };
            } else {
                return {
                    status: false,
                    error: 'Failed to fetch video live stats'
                };
            }
        } catch (error) {
            console.error('Error fetching video live stats:', error.message);
            return {
                status: false,
                error: error.message
            };
        }
    }
    async getVideoStats(videoId) {
        try {
            if (!videoId) {
                throw new Error("No video ID provided");
            }
            
            const response = await axios.get(`https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`);
            
            if (response.status !== 200) {
                throw new Error(`API returned status ${response.status}`);
            }
            
            return {
                status: true,
                likes: response.data.likes,
                dislikes: response.data.dislikes,
                viewCount: response.data.viewCount,
                dateCreated: response.data.dateCreated
            };
        } catch (error) {
            console.error('Error fetching video stats:', error.message);
            return {
                status: false,
                error: error.message
            };
        }
    }    
    async getVideoInfo(videoId) {
        try {
            const response = await axios.get(`https://api.subscribercounter.nl/api/youtube/videos/info/${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.success && response.data.results && response.data.results.length > 0) {
                const data = response.data.results[0];
                
                return {
                    status: true,
                    title: data.title,
                    thumbnail: data.thumbnails?.high?.url || '',
                    uploadDate: data.publishedAt,
                    viewCount: parseInt(data.viewCount) || 0,
                    likeCount: parseInt(data.likeCount) || 0,
                    channelName: data.channelName || '',
                    isLive: false
                };
            } else {
                return {
                    status: false,
                    error: 'Failed to fetch video information'
                };
            }
        } catch (error) {
            console.error('Error fetching video info:', error.message);
            return {
                status: false,
                error: error.message
            };
        }
    }    
    async getVideoAnalytics(videoId) {
        try {
            const [videoInfo, liveStats, videoStats] = await Promise.all([
                this.getVideoInfo(videoId),
                this.getVideoLiveStats(videoId),
                this.getVideoStats(videoId)
            ]);

            if (!videoInfo.status) {
                return {
                    status: false,
                    error: 'Failed to fetch video information'
                };
            }

            const isLive = liveStats.status ? liveStats.isLive : false;

            return {
                status: true,
                videoId: videoId,
                title: videoInfo.title,
                thumbnail: videoInfo.thumbnail,
                uploadDate: videoInfo.uploadDate, 
                channelName: videoInfo.channelName,
                isLive: isLive,
                
                subscribercounter: {
                    info: {
                        status: videoInfo.status,
                        title: videoInfo.title,
                        thumbnail: videoInfo.thumbnail,
                        uploadDate: videoInfo.uploadDate,
                        viewCount: videoInfo.viewCount,
                        likes: videoInfo.likeCount,
                        channelName: videoInfo.channelName
                    },
                    stats: {
                        status: liveStats.status,
                        isLive: liveStats.status ? liveStats.isLive : false,
                        currentViewers: liveStats.status ? liveStats.liveViewers : null,
                        totalViews: liveStats.status ? liveStats.liveViews : null,
                        likes: liveStats.status ? liveStats.liveLikes : null,
                        comments: liveStats.status ? liveStats.liveComments : null
                    }
                },
                
                returnyoutubedislike: {
                    status: videoStats.status,
                    likes: videoStats.status ? videoStats.likes : null,
                    dislikes: videoStats.status ? videoStats.dislikes : null,
                    viewCount: videoStats.status ? videoStats.viewCount : null,
                    dateCreated: videoStats.status ? videoStats.dateCreated : null
                },
                
                analytics: {
                    viewCount: (isLive && liveStats.status && liveStats.liveViews) 
                        ? liveStats.liveViews 
                        : videoInfo.viewCount,
                    
                    likes: videoStats.status ? videoStats.likes : 
                           (liveStats.status ? liveStats.liveLikes : videoInfo.likeCount),
                    
                    dislikes: videoStats.status ? videoStats.dislikes : 0,
                    
                    currentViewers: (isLive && liveStats.status) ? liveStats.liveViewers : null
                },
                
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting video analytics:', error);
            return {
                status: false,
                error: error.message
            };
        }
    }    
    formatNumber(num) {
        if (num === null || num === undefined) return 'N/A';
        if (typeof num === 'string') {
            return num;
        }
        return num.toLocaleString();
    }
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (error) {
            return 'N/A';
        }
    }

    calculateVideoAge(dateString) {
        if (!dateString) return 'N/A';
        try {
            const now = new Date();
            const uploadDate = new Date(dateString);
            const diffMs = now - uploadDate;
            
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            const diffMonths = Math.floor(diffDays / 30);
            const diffYears = Math.floor(diffMonths / 12);
            
            if (diffHours < 24) {
                const hours = diffHours;
                const minutes = diffMins % 60;
                if (hours === 0) {
                    return `${minutes}m ago`;
                }
                return `${hours}h ${minutes}m ago`;
            }
            
            const parts = [];
            
            if (diffYears > 0) {
                parts.push(`${diffYears}y`);
                const remainingMonths = diffMonths % 12;
                if (remainingMonths > 0) {
                    parts.push(`${remainingMonths}m`);
                }
                const remainingDays = diffDays % 30;
                if (remainingDays > 0 && parts.length < 3) {
                    parts.push(`${remainingDays}d`);
                }
            } else if (diffMonths > 0) {
                parts.push(`${diffMonths}m`);
                const remainingDays = diffDays % 30;
                if (remainingDays > 0) {
                    parts.push(`${remainingDays}d`);
                }
            } else {
                parts.push(`${diffDays}d`);
            }
            
            return parts.join(' ') + ' ago';
        } catch (error) {
            return 'N/A';
        }
    }

    calculateDifference(current, previous) {
        if (previous === null || previous === undefined || current === null || current === undefined) {
            return { diff: 0, formatted: '', color: '' };
        }
        
        const diff = current - previous;
        if (diff === 0) {
            return { diff: 0, formatted: '', color: '' };
        }
        
        const formatted = diff > 0 ? `+${this.formatNumber(diff)}` : this.formatNumber(diff);
        const color = diff > 0 ? 'text-green-400' : 'text-red-400';
        
        return { diff, formatted, color };
    }
}

module.exports = VideoAnalytics;
