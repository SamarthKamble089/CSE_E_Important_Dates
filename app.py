import http.server
import socketserver
import os
import subprocess
import json
import webbrowser

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class ScheduleHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            filepath = os.path.join(DIRECTORY, 'schedules.txt')
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(body)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {'success': True, 'message': 'schedules.txt updated directly on disk!'}
                self.wfile.write(json.dumps(response).encode('utf-8'))
                print("Successfully updated schedules.txt on disk.")
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {'success': False, 'error': str(e)}
                self.wfile.write(json.dumps(response).encode('utf-8'))
                print(f"Error saving schedules.txt: {e}")

        elif self.path == '/api/git-push':
            try:
                res1 = subprocess.run(['git', 'add', 'schedules.txt'], cwd=DIRECTORY, capture_output=True, text=True)
                res2 = subprocess.run(['git', 'commit', '-m', 'Update schedules.txt via editor'], cwd=DIRECTORY, capture_output=True, text=True)
                res3 = subprocess.run(['git', 'push', 'origin', 'main'], cwd=DIRECTORY, capture_output=True, text=True)
                output = f"{res1.stdout}\n{res2.stdout}\n{res3.stdout}".strip()
                if not output:
                    output = res2.stderr.strip() or "No changes detected or push completed."
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'output': output}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
        else:
            self.send_error(404, "Endpoint not found")

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    # Enable address reuse
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), ScheduleHandler) as httpd:
            print("==================================================")
            print(f" Schedule Server active at http://localhost:{PORT}/")
            print(" Changes made in editor.html save directly to schedules.txt")
            print("==================================================")
            webbrowser.open(f"http://localhost:{PORT}/editor.html")
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 10048 or "Address already in use" in str(e):
            # Try alternate port 8080
            PORT = 8080
            with socketserver.TCPServer(("", PORT), ScheduleHandler) as httpd:
                print(f"Schedule Server active at http://localhost:{PORT}/")
                webbrowser.open(f"http://localhost:{PORT}/editor.html")
                httpd.serve_forever()
        else:
            raise
