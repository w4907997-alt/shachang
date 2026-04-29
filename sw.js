var CACHE_NAME = 'shachang-v1';
var ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/db.js',
  '/product.js',
  '/customer.js',
  '/order.js',
  '/chat.js',
  '/report.js',
  '/delivery.js',
  '/excel.js',
  '/auth.js',
  '/backup.js',
  '/xlsx.min.js',
  '/html2canvas.min.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 安装：缓存所有文件
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活：清除旧缓存
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// 请求：网络优先，失败用缓存
self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request).then(function(res) {
      var resClone = res.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(e.request, resClone);
      });
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
