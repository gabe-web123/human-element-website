export default async function handler(req, res) {
  const CHANNEL_ID = 'UCm18ZT7uNKxjY8f_9XlgiCA';
  const MIN_SECONDS = 180; // 3 minutes
  const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  try {
    const response = await fetch(FEED_URL);
    const xml = await response.text();

    // Parse entries from XML
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1];
      const title = (entry.match(/<title>(.*?)<\/title>/) || [])[1];
      const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1];
      const description = (entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '';

      if (videoId && title) {
        entries.push({
          videoId,
          title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          published,
          description: description.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(),
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
      }
    }

    // Check duration for each video by fetching the YouTube page
    const withDuration = await Promise.all(
      entries.map(async (v) => {
        try {
          const page = await fetch(`https://www.youtube.com/watch?v=${v.videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          const html = await page.text();
          const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
          const seconds = lengthMatch ? parseInt(lengthMatch[1], 10) : 0;
          return { ...v, duration: seconds };
        } catch {
          return { ...v, duration: 0 };
        }
      })
    );

    // Only keep videos 3+ minutes
    const longForm = withDuration.filter(v => v.duration >= MIN_SECONDS);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ videos: longForm });
  } catch (err) {
    console.error('Failed to fetch YouTube feed:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
}
