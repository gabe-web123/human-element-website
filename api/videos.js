export default async function handler(req, res) {
  const CHANNEL_ID = 'UCm18ZT7uNKxjY8f_9XlgiCA';
  const UPLOADS_PLAYLIST = 'UUm18ZT7uNKxjY8f_9XlgiCA'; // UC → UU
  const API_KEY = process.env.YOUTUBE_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing YouTube API key' });
  }

  try {
    // Fetch all uploads from the channel's uploads playlist
    let allItems = [];
    let pageToken = '';

    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${UPLOADS_PLAYLIST}&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        console.error('YouTube API error:', data.error);
        break;
      }

      allItems = allItems.concat(data.items || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    if (allItems.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json({ videos: [] });
    }

    // Get video IDs to check duration and Shorts status
    const videoIds = allItems.map(item => item.snippet.resourceId.videoId);

    // Fetch video details in batches of 50
    let videoDetails = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50).join(',');
      const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${batch}&key=${API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      videoDetails = videoDetails.concat(data.items || []);
    }

    // Filter to long-form only (3+ minutes) and build response
    const videos = videoDetails
      .filter(v => {
        const duration = v.contentDetails.duration; // ISO 8601: PT#M#S
        const seconds = parseDuration(duration);
        return seconds >= 180;
      })
      .map(v => ({
        videoId: v.id,
        title: v.snippet.title,
        published: v.snippet.publishedAt,
        description: (v.snippet.description || '').trim(),
        thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${v.id}`
      }));

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ videos });
  } catch (err) {
    console.error('Failed to fetch YouTube videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
}

// Parse ISO 8601 duration (PT1H2M3S) to seconds
function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}
