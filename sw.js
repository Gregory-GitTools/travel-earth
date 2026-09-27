// Пустой service worker — ничего не кэширует, но некоторые версии Chrome/Edge требуют
// зарегистрированный service worker с обработчиком fetch как условие показа
// beforeinstallprompt (см. install-btn в app.js)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evt) => evt.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
