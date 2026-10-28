"""Python 표준 라이브러리만 사용하는 선택형 로컬 서버."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import functools
import webbrowser

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.webmanifest': 'application/manifest+json',
        '.svg': 'image/svg+xml'
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

def main():
    parser = argparse.ArgumentParser(description='IntervalForge 로컬 서버')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    folder = str(Path(__file__).resolve().parent)
    server = ThreadingHTTPServer(
        (args.host, args.port),
        functools.partial(Handler, directory=folder)
    )
    address = f'http://localhost:{args.port}/'
    print(f'IntervalForge: {address}')
    print('종료: Ctrl+C')
    print('iPhone 설치/오프라인 확인에는 배포된 HTTPS 주소를 사용하세요.')
    if not args.no_browser:
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
