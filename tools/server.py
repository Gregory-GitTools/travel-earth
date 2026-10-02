"""Локальный сервер Travel Earth для start.bat: раздаёт папку приложения, как
`python -m http.server`, и умеет одно сверх того — открыть файл экскурсии в программе
Windows по умолчанию (Блокнот, VS Code — что назначено для .md/.txt) и создать ярлыки на
рабочем столе (POST /install-shortcuts — запускает install_desktop_shortcut.vbs этой папки:
кнопка «Установить на рабочий стол» в ⚙ локальной версии).

Страница сама запустить программу не может, поэтому просит сервер: POST /open-file
с телом {"path": "E:\\...\\Рим — три дня.md"} и заголовком X-Travel-Earth. Защита:
- слушает только 127.0.0.1;
- заголовок X-Travel-Earth делает запрос «непростым»: чужой сайт сначала прислал бы
  preflight OPTIONS, а сервер на него не отвечает разрешением — браузер запрос не пустит;
- открывает только существующие файлы .md и .txt (не программы, не папки).

Запуск: python tools/server.py 8643  (из папки приложения; так делает start.bat)
"""
import http.server
import json
import os
import subprocess
import sys

ALLOWED = (".md", ".txt")
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.headers.get("X-Travel-Earth") != "1" or self.path not in ("/open-file", "/install-shortcuts"):
            self.send_error(404)
            return
        if self.path == "/install-shortcuts":
            # установщик сам покажет окно «Готово» с тем, что создал
            subprocess.Popen(["wscript", os.path.join(APP_DIR, "install_desktop_shortcut.vbs")], cwd=APP_DIR)
            self.send_response(204)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            path = json.loads(self.rfile.read(length) or b"{}").get("path", "")
        except (ValueError, json.JSONDecodeError):
            self.send_error(400)
            return
        path = os.path.normpath(str(path))
        if not os.path.isabs(path) or not path.lower().endswith(ALLOWED) or not os.path.isfile(path):
            self.send_error(404, "file not found")
            return
        os.startfile(path)  # программа по умолчанию для .md/.txt
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # приложение обновляется часто — не держать старые app.js/style.css в кэше
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8643
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
