const { Innertube, UniversalCache } = require('youtubei.js');

module.exports = async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).json({ error: 'Потрібно вказати ID відео' });
    }

    // Оптимізація ініціалізації спеціально для Vercel / Serverless
    const youtube = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true
    });

    const info = await youtube.getInfo(videoId);
    const watchNext = info.watch_next_feed || [];

    const related = watchNext
      .filter(item => item.type === 'Video' || item.id)
      .slice(0, 5)
      .map(item => ({
        id: item.id || item.video_id,
        title: item.title?.text || item.title?.toString() || 'Без назви',
        thumbnail: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      current: {
        id: videoId,
        title: info.basic_info?.title || 'Початкове відео',
        thumbnail: info.basic_info?.thumbnail?.[0]?.url
      },
      related: related
    });
  } catch (err) {
    console.error('Помилка виконання на Vercel:', err);
    return res.status(500).json({ 
      error: 'Не вдалося отримати дані з YouTube', 
      details: err.message 
    });
  }
};
