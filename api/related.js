const { Innertube } = require('youtubei.js');

module.exports = async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).json({ error: 'Потрібно вказати ID відео' });
    }

    // Створюємо клієнт YouTube
    const youtube = await Innertube.create();
    const info = await youtube.getInfo(videoId);

    const watchNext = info.watch_next_feed || [];

    // Відбираємо перші 5 рекомендацій
    const related = watchNext
      .filter(item => item.type === 'Video' || item.id)
      .slice(0, 5)
      .map(item => ({
        id: item.id || item.video_id,
        title: item.title?.text || item.title?.toString() || 'Без назви',
        thumbnail: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
      }));

    // Кешуємо відповідь на Vercel CDN на 1 годину, щоб працювало миттєво
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json({
      current: {
        id: videoId,
        title: info.basic_info.title,
        thumbnail: info.basic_info.thumbnail?.[0]?.url
      },
      related: related
    });
  } catch (err) {
    console.error('Помилка сервера:', err);
    return res.status(500).json({ error: 'Не вдалося отримати дані з YouTube' });
  }
};
