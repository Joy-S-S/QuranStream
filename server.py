from flask_socketio import SocketIO, emit
from flask import Flask, Response, send_file, send_from_directory, jsonify
import requests
import os
from datetime import datetime, timedelta
import threading
import uuid
import cloudinary
import cloudinary.uploader
from threading import Lock

app = Flask(__name__)

# إعدادات Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUD_NAME'),
    api_key=os.getenv('API_KEY'),
    api_secret=os.getenv('API_SECRET')
)

STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv"
RECORDINGS_DIR = "temp_recordings"
active_recordings = {}
recordings_lock = Lock()

def record_stream(device_id, session_id):
    try:
        part_number = 0
        max_duration = 240  # 4 دقائق لكل جزء
        
        while active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
            part_number += 1
            recording_file = os.path.join(RECORDINGS_DIR, f"recording_{session_id}_part{part_number}.mp3")
            
            start_time = datetime.now()
            with requests.get(STREAM_URL, stream=True, timeout=30) as r:
                with open(recording_file, 'wb') as f:
                    while (datetime.now() - start_time).seconds < max_duration and \
                          active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
                        chunk = next(r.iter_content(chunk_size=1024), None)
                        if chunk:
                            f.write(chunk)
            
            if os.path.exists(recording_file):
                public_id = f"quran_radio/{device_id}/recording_{session_id}_part{part_number}"
                response = cloudinary.uploader.upload(
                    recording_file,
                    resource_type="video"
                )
                if 'parts' not in active_recordings[device_id][session_id]:
                    active_recordings[device_id][session_id]['parts'] = []
                active_recordings[device_id][session_id]['parts'].append({
                    'url': response['secure_url'],
                    'public_id': response['public_id']
                })
                os.remove(recording_file)
                
    except Exception as e:
        print(f"خطأ في التسجيل: {e}")
    finally:
        with recordings_lock:
            if device_id in active_recordings and session_id in active_recordings[device_id]:
                active_recordings[device_id][session_id]['active'] = False

@app.route('/')
def serve_index():
    return send_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/start-record/<device_id>')
def start_recording(device_id):
    with recordings_lock:
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        session_id = str(uuid.uuid4())
        
        if device_id not in active_recordings:
            active_recordings[device_id] = {}
        
        active_recordings[device_id][session_id] = {
            'active': True,
            'start_time': datetime.now(),
            'parts': []
        }
        
        recording_thread = threading.Thread(target=record_stream, args=(device_id, session_id))
        recording_thread.start()
        
        return jsonify({
            'session_id': session_id,
            'message': 'بدء التسجيل بنجاح'
        })

@app.route('/stop-record/<device_id>/<session_id>')
def stop_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            active_recordings[device_id][session_id]['active'] = False
            
            # انتظار اكتمال رفع الأجزاء
            import time
            time.sleep(2)
            
            duration = (datetime.now() - active_recordings[device_id][session_id]['start_time']).seconds
            parts = active_recordings[device_id][session_id].get('parts', [])
            
            return jsonify({
                'success': True,
                'message': 'تم إيقاف التسجيل بنجاح',
                'duration': duration,
                'parts': parts
            })
        return jsonify({
            'success': False,
            'error': 'لا يوجد تسجيل نشط'
        }), 404

@app.route('/download/<device_id>/<session_id>')
def download_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            parts = active_recordings[device_id][session_id].get('parts', [])
            if parts:
                return jsonify({
                    'urls': [part['url'] for part in parts]
                })
    return jsonify({'error': 'لا يوجد تسجيل'}), 404

@app.route('/delete-record/<device_id>/<session_id>')
def delete_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            try:
                if 'parts' in active_recordings[device_id][session_id]:
                    for part in active_recordings[device_id][session_id]['parts']:
                        cloudinary.uploader.destroy(part['public_id'], resource_type="video")
                del active_recordings[device_id][session_id]
                return jsonify({'message': 'تم حذف التسجيل بنجاح'})
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        return jsonify({'error': 'لا يوجد تسجيل'}), 404

if __name__ == '__main__':
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
