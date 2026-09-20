#!/usr/bin/env python3
"""
TV & Uydu Alıcısı Kanal Editörü ve Format Dönüştürücü
Desteklenen formatlar: CHANNELLIST.bin (ALi), .sdx (Vestel/SatcoDX), .m3u, .csv, .json
"""

import os
import sys
import json
import shutil
import struct
import io
import csv
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHANNEL_FILE = os.path.join(BASE_DIR, 'CHANNELLIST.bin')
BACKUP_FILE = os.path.join(BASE_DIR, 'CHANNELLIST_ORIJINAL.bin')
OUTPUT_FILE = os.path.join(BASE_DIR, 'CHANNELLIST_DUZENLENMIS.bin')

HEADER_SIZE = 530
RECORD_SIZE = 120
MAX_TV_SLOTS = 492

CURRENT_CHANNELS_CACHE = None


def parse_channels(filepath=None):
    filepath = filepath or CHANNEL_FILE
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dosya bulunamadı: {filepath}")

    with open(filepath, 'rb') as f:
        data = f.read()

    if len(data) < HEADER_SIZE + RECORD_SIZE:
        raise ValueError("Dosya boyutu çok küçük veya geçersiz.")

    total_slots = (len(data) - HEADER_SIZE) // RECORD_SIZE
    channels = []

    for i in range(min(total_slots, MAX_TV_SLOTS)):
        offset = HEADER_SIZE + i * RECORD_SIZE
        rec = data[offset:offset + RECORD_SIZE]

        raw_name = rec[88:120].split(b'\x00')[0]
        has_prefix = len(raw_name) > 0 and raw_name[0] < 0x20
        name_bytes = raw_name[1:] if has_prefix else raw_name

        try:
            name = name_bytes.decode('iso-8859-9')
        except Exception:
            name = name_bytes.decode('latin-1', errors='replace')

        name = name.strip()
        order_idx = struct.unpack_from('<H', rec, 8)[0]
        ch_number = struct.unpack_from('<H', rec, 10)[0]

        channels.append({
            'slot': i,
            'orig_slot': i,
            'orig_ch': ch_number,
            'orig_ord': order_idx,
            'name': name,
            'is_hd': 'HD' in name.upper(),
            'has_prefix': has_prefix
        })

    return channels


def build_ali_bin_data(channels_data):
    if not os.path.exists(BACKUP_FILE) and os.path.exists(CHANNEL_FILE):
        shutil.copy2(CHANNEL_FILE, BACKUP_FILE)

    source = BACKUP_FILE if os.path.exists(BACKUP_FILE) else CHANNEL_FILE
    with open(source, 'rb') as f:
        original = bytearray(f.read())

    output = bytearray(original)

    for idx, ch in enumerate(channels_data):
        src_offset = HEADER_SIZE + ch.get('orig_slot', idx) * RECORD_SIZE
        rec = bytearray(original[src_offset:src_offset + RECORD_SIZE])

        struct.pack_into('<H', rec, 8, idx)
        struct.pack_into('<H', rec, 10, idx + 1)
        struct.pack_into('<H', rec, 30, idx + 1)

        new_name = ch.get('name', '').strip()
        if new_name:
            orig_field = original[src_offset + 88:src_offset + 120]
            prefix = b''
            if orig_field and orig_field[0] < 0x20:
                prefix = orig_field[:1]

            try:
                encoded = new_name.encode('iso-8859-9')
            except Exception:
                encoded = new_name.encode('latin-1', errors='replace')

            max_len = 31 - len(prefix)
            encoded = encoded[:max_len]
            field = prefix + encoded + b'\x00' * (32 - len(prefix) - len(encoded))
            rec[88:120] = field

        dst_offset = HEADER_SIZE + idx * RECORD_SIZE
        output[dst_offset:dst_offset + RECORD_SIZE] = rec

    for empty_idx in range(len(channels_data), MAX_TV_SLOTS):
        dst_offset = HEADER_SIZE + empty_idx * RECORD_SIZE
        empty_rec = bytearray(RECORD_SIZE)
        struct.pack_into('<H', empty_rec, 8, 0xFFFF)
        struct.pack_into('<H', empty_rec, 10, 0)
        struct.pack_into('<H', empty_rec, 30, 0)
        output[dst_offset:dst_offset + RECORD_SIZE] = empty_rec

    return output


def write_channels(channels_data, target_path=None):
    target_path = target_path or CHANNEL_FILE
    output = build_ali_bin_data(channels_data)

    with open(target_path, 'wb') as f:
        f.write(output)

    if target_path != OUTPUT_FILE:
        with open(OUTPUT_FILE, 'wb') as f:
            f.write(output)

    global CURRENT_CHANNELS_CACHE
    CURRENT_CHANNELS_CACHE = channels_data
    return len(channels_data)


def export_vestel_sdx(channels_data):
    lines = [
        "SATCODX103",
        "; Vestel / Regal / SEG / Toshiba Uyumlu Kanal Listesi",
        "; Olusturma: TV & Uydu Kanal Editoru",
        ""
    ]
    for idx, ch in enumerate(channels_data, start=1):
        name = ch.get('name', f'Kanal {idx}')
        clean_name = name.replace(';', '').strip()
        lines.append(f"CX{idx:04d} {clean_name:<24s} 11054 V 30000 3/4 42.0E")

    content_str = "\r\n".join(lines) + "\r\n"
    try:
        return content_str.encode('iso-8859-9')
    except Exception:
        return content_str.encode('utf-8', errors='replace')


def export_m3u(channels_data):
    lines = [
        "#EXTM3U",
        "# TV & Uydu Kanal Listesi - M3U Oynatma Listesi"
    ]
    for idx, ch in enumerate(channels_data, start=1):
        name = ch.get('name', f'Kanal {idx}')
        group = "Haber" if any(k in name.upper() for k in ['HABER', 'NEWS', 'NTV', 'CNN']) else (
            "Spor" if any(k in name.upper() for k in ['SPOR', 'SPORT', 'FB TV']) else (
                "Cocuk" if any(k in name.upper() for k in ['COCUK', 'MINIKA', 'CARTOON']) else "Genel"
            )
        )
        lines.append(f'#EXTINF:-1 tvg-id="{idx}" tvg-chno="{idx}" tvg-name="{name}" group-title="{group}",{name}')
        lines.append(f"http://127.0.0.1:8080/stream/{idx}")

    return ("\n".join(lines) + "\n").encode('utf-8')


def export_csv_data(channels_data):
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(['Sira_No', 'Kanal_Adi', 'HD_Durumu', 'Orijinal_Sira'])
    for idx, ch in enumerate(channels_data, start=1):
        is_hd = 'EVET' if ch.get('is_hd') or 'HD' in ch.get('name', '').upper() else 'HAYIR'
        orig = ch.get('orig_ch', ch.get('orig_slot', idx))
        writer.writerow([idx, ch.get('name', ''), is_hd, orig])

    return ('\ufeff' + output.getvalue()).encode('utf-8')


def export_json_data(channels_data):
    cleaned = []
    for idx, ch in enumerate(channels_data, start=1):
        cleaned.append({
            'order': idx,
            'name': ch.get('name', ''),
            'is_hd': ch.get('is_hd', False) or ('HD' in ch.get('name', '').upper()),
            'orig_slot': ch.get('orig_slot', idx - 1),
            'orig_ch': ch.get('orig_ch', idx)
        })
    return json.dumps(cleaned, ensure_ascii=False, indent=2).encode('utf-8')


def parse_uploaded_content(filename, content):
    lower_fn = filename.lower()
    stripped = content.strip()

    # 1. M3U Playlist Check
    if b'#EXTM3U' in content[:100] or lower_fn.endswith(('.m3u', '.m3u8')):
        text = content.decode('utf-8', errors='replace')
        channels = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith('#EXTINF'):
                parts = line.split(',', 1)
                name = parts[1].strip() if len(parts) > 1 else "Bilinmeyen Kanal"
                slot = len(channels)
                channels.append({
                    'slot': slot,
                    'orig_slot': slot,
                    'orig_ch': slot + 1,
                    'orig_ord': slot,
                    'name': name,
                    'is_hd': 'HD' in name.upper(),
                    'has_prefix': False
                })
        if channels:
            return channels

    # 2. SatcoDX / Vestel .sdx Check
    if b'SATCODX' in content[:100] or lower_fn.endswith('.sdx') or (b'CX0' in content[:100]):
        try:
            text = content.decode('iso-8859-9')
        except Exception:
            text = content.decode('utf-8', errors='replace')

        channels = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith('CX'):
                parts = line[2:].strip().split()
                if parts:
                    name_parts = []
                    for p in parts[1:]:
                        if p.isdigit() and len(p) >= 4:
                            break
                        name_parts.append(p)
                    name = " ".join(name_parts) if name_parts else parts[0]
                    slot = len(channels)
                    channels.append({
                        'slot': slot,
                        'orig_slot': slot,
                        'orig_ch': slot + 1,
                        'orig_ord': slot,
                        'name': name,
                        'is_hd': 'HD' in name.upper(),
                        'has_prefix': False
                    })
        if channels:
            return channels

    # 3. JSON Check
    if stripped.startswith(b'{') or stripped.startswith(b'[') or lower_fn.endswith('.json'):
        try:
            data = json.loads(content.decode('utf-8', errors='replace'))
            if isinstance(data, dict) and 'channels' in data:
                data = data['channels']
            if isinstance(data, list):
                channels = []
                for i, item in enumerate(data):
                    name = item.get('name', f'Kanal {i+1}')
                    channels.append({
                        'slot': i,
                        'orig_slot': item.get('orig_slot', i),
                        'orig_ch': item.get('orig_ch', i + 1),
                        'orig_ord': item.get('orig_ord', i),
                        'name': name,
                        'is_hd': item.get('is_hd', 'HD' in name.upper()),
                        'has_prefix': False
                    })
                if channels:
                    return channels
        except Exception:
            pass

    # 4. CSV Check
    if content.startswith(b'\xef\xbb\xbf') or lower_fn.endswith('.csv') or (b';' in content[:200] and b'Kanal' in content[:200]):
        text = content.decode('utf-8-sig', errors='replace')
        reader = csv.reader(text.splitlines(), delimiter=';')
        channels = []
        for row in reader:
            if not row or row[0].startswith('Sira') or row[0].startswith('#'):
                continue
            name = row[1] if len(row) > 1 else row[0]
            slot = len(channels)
            channels.append({
                'slot': slot,
                'orig_slot': slot,
                'orig_ch': slot + 1,
                'orig_ord': slot,
                'name': name.strip(),
                'is_hd': 'HD' in name.upper(),
                'has_prefix': False
            })
        if channels:
            return channels

    # 5. ALi Binary Check
    if len(content) >= HEADER_SIZE + RECORD_SIZE:
        temp_path = os.path.join(BASE_DIR, 'CHANNELLIST_TEMP.bin')
        with open(temp_path, 'wb') as f:
            f.write(content)
        channels = parse_channels(temp_path)
        with open(CHANNEL_FILE, 'wb') as f:
            f.write(content)
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return channels

    raise ValueError(f"Desteklenmeyen veya gecersiz dosya formati: {filename}")


class RequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == '/api/channels':
            try:
                global CURRENT_CHANNELS_CACHE
                if CURRENT_CHANNELS_CACHE is not None:
                    channels = CURRENT_CHANNELS_CACHE
                else:
                    channels = parse_channels()
                self._json_response(200, {'status': 'ok', 'channels': channels})
            except Exception as e:
                self._json_response(500, {'status': 'error', 'message': str(e)})
            return

        if path in ('/api/download', '/api/export'):
            fmt = query.get('format', ['bin'])[0].lower()
            try:
                channels = CURRENT_CHANNELS_CACHE if CURRENT_CHANNELS_CACHE is not None else parse_channels()

                if fmt in ('bin', 'channellist'):
                    if os.path.exists(OUTPUT_FILE):
                        with open(OUTPUT_FILE, 'rb') as f:
                            content = f.read()
                    elif os.path.exists(CHANNEL_FILE):
                        with open(CHANNEL_FILE, 'rb') as f:
                            content = f.read()
                    else:
                        content = build_ali_bin_data(channels)
                    filename = "CHANNELLIST.bin"
                    mime = "application/octet-stream"

                elif fmt in ('sdx', 'vestel'):
                    content = export_vestel_sdx(channels)
                    filename = "sat_default.sdx"
                    mime = "application/octet-stream"

                elif fmt == 'm3u':
                    content = export_m3u(channels)
                    filename = "kanallar.m3u"
                    mime = "audio/x-mpegurl; charset=utf-8"

                elif fmt == 'csv':
                    content = export_csv_data(channels)
                    filename = "kanallar.csv"
                    mime = "text/csv; charset=utf-8"

                elif fmt == 'json':
                    content = export_json_data(channels)
                    filename = "kanallar.json"
                    mime = "application/json; charset=utf-8"

                else:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Gecersiz format")
                    return

                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self._json_response(500, {'status': 'error', 'message': str(e)})
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/save':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                channels = payload.get('channels', [])
                count = write_channels(channels, CHANNEL_FILE)
                self._json_response(200, {
                    'status': 'ok',
                    'count': count,
                    'message': f'{count} kanal basariyla kaydedildi!'
                })
            except Exception as e:
                self._json_response(500, {'status': 'error', 'message': str(e)})
            return

        if path == '/api/upload':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            content_type = self.headers.get('Content-Type', '')

            try:
                filename = "uploaded.bin"
                file_bytes = body

                if 'boundary=' in content_type:
                    boundary = content_type.split('boundary=')[1].encode('ascii')
                    parts = body.split(b'--' + boundary)
                    for part in parts:
                        if b'filename="' in part:
                            header_part, data_part = part.split(b'\r\n\r\n', 1)
                            headers_str = header_part.decode('latin-1', errors='replace')
                            for h_line in headers_str.splitlines():
                                if 'filename="' in h_line:
                                    filename = h_line.split('filename="')[1].split('"')[0]
                            file_bytes = data_part.rsplit(b'\r\n', 1)[0]
                            break

                channels = parse_uploaded_content(filename, file_bytes)
                global CURRENT_CHANNELS_CACHE
                CURRENT_CHANNELS_CACHE = channels
                self._json_response(200, {
                    'status': 'ok',
                    'filename': filename,
                    'count': len(channels),
                    'channels': channels,
                    'message': f'{filename} basariyla yuklendi ({len(channels)} kanal)'
                })
            except Exception as e:
                self._json_response(400, {'status': 'error', 'message': str(e)})
            return

        self.send_response(404)
        self.end_headers()

    def _json_response(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))


def main(port=8080):
    for p in range(port, port + 20):
        try:
            server = HTTPServer(('', p), RequestHandler)
            port = p
            break
        except OSError:
            continue

    url = f"http://localhost:{port}"
    print("=" * 60)
    print("  Evrensel TV & Uydu Kanal Editoru")
    print(f"  Calisiyor: {url}")
    print("=" * 60)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatildi.")


if __name__ == '__main__':
    port = 8080
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    main(port)
