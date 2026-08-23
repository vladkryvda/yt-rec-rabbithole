module.exports = async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).json({ error: 'Потрібно вказати ID відео' });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Не налаштовано YOUTUBE_API_KEY у Vercel Environment Variables' 
      });
    }

    // 1. Отримуємо деталі активного відео
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();

    if (videoData.error) {
      return res.status(400).json({ error: videoData.error.message });
    }

    let currentTitle = videoId;
    let tags = [];
    let categoryId = '';
    let channelTitle = '';

    if (videoData.items && videoData.items.length > 0) {
      const snippet = videoData.items[0].snippet;
      currentTitle = snippet.title;
      tags = snippet.tags || [];
      categoryId = snippet.categoryId || '';
      channelTitle = snippet.channelTitle || '';
    }

    // Очищення назви відео для пошуку релевантних
    let queryKeywords = currentTitle
      .replace(/[\(\[\{].*?[\)\]\}]/g, '')
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ');
    const words = queryKeywords.split(/\s+/).filter(w => w.length > 2);
    queryKeywords = words.slice(0, 5).join(' ');

    if (tags.length > 0) {
      queryKeywords = tags.slice(0, 3).join(' ');
    }

    // 2. Пошук схожих відео
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(queryKeywords)}&key=${apiKey}`;
    if (categoryId) {
      searchUrl += `&videoCategoryId=${categoryId}`;
    }

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.error) {
      return res.status(400).json({ error: searchData.error.message });
    }

    const related = (searchData.items || [])
      .filter(item => item.id && item.id.videoId && item.id.videoId !== videoId)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title || 'Без назви',
        channelTitle: item.snippet.channelTitle || '',
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json({
      current: {
        id: videoId,
        title: currentTitle,
        channelTitle: channelTitle,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      },
      related: related
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Не вдалося отримати дані з YouTube', details: err.message });
  }
};
