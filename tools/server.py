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
Путь может быть и относительным — тогда это файл в папке приложения («Экскурсии/…md»,
промт): папки «Экскурсии» и «Альбомы» лежат в самом репозитории.

GET /list?dir=Экскурсии — список файлов этой папки приложения со всеми подпапками, JSON
[{"path", "size", "mtime"}]: так карта узнаёт, что лежит в папках репозитория (на GitHub
Pages то же самое отдаёт GitHub API).

Запуск: python tools/server.py 8643  (из папки приложения; так делает start.bat)
"""
import http.server
import json
import os
import subprocess
import sys
import urllib.parse

ALLOWED = (".md", ".txt")
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path != "/list":
            super().do_GET()
            return
        name = urllib.parse.parse_qs(url.query).get("dir", [""])[0]
        root = os.path.normpath(os.path.join(APP_DIR, name))
        if not name or os.path.dirname(root) != APP_DIR or not os.path.isdir(root):
            self.send_error(404)
            return
        items = []
        for folder, dirs, files in os.walk(root):
            for f in files:
                full = os.path.join(folder, f)
                st = os.stat(full)
                items.append({"path": os.path.relpath(full, APP_DIR).replace(os.sep, "/"),
                              "size": st.st_size, "mtime": int(st.st_mtime * 1000)})
        body = json.dumps(items, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
        path = os.path.normpath(os.path.join(APP_DIR, str(path)))
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
