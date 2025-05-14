from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import requests
import os
from datetime import datetime, timedelta
import threading
import uuid
import cloudinary
import cloudinary.uploader
from apscheduler.schedulers.background import BackgroundScheduler
from threading import Lock

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'secret!')
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# إعدادات Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUD_NAME'),
    api_key=os.getenv('API_KEY'),
    api_secret=os.getenv('API_SECRET')
)

# إعدادات البث المباشر
STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv"
RECORDINGS_DIR = "temp_recordings"

# تخزين جلسات التسجيل
active_recordings = {}
recordings_lock = Lock()
listener_count = 0
listener_lock = Lock()

# إنشاء مجدول المهام
scheduler = BackgroundScheduler()
scheduler.start()

def cleanup_expired_recordings():
    """حذف التسجيلات القديمة من الذاكرة"""
    with recordings_lock:
        now = datetime.now()
        for device_id in list(active_recordings.keys()):
            for session_id in list(active_recordings[device_id].keys()):
                if 'expiry' in active_recordings[device_id][session_id] and active_recordings[device_id][session_id]['expiry'] <= now:
                    try:
                        if os.path.exists(active_recordings[device_id][session_id]['file']):
                            os.remove(active_recordings[device_id][session_id]['file'])
                        del active_recordings[device_id][session_id]
                        print(f"تم حذف التسجيل المنتهي: {session_id} لـ Device: {device_id}")
                    except Exception as e:
                        print(f"خطأ في حذف التسجيل المنتهي {session_id}: {e}")

# جدولة التنظيف كل ساعة
scheduler.add_job(cleanup_expired_recordings, 'interval', hours=1)

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# WebSocket للبث الصوتي وعدد المستمعين
@socketio.on('connect')
def handle_connect():
    global listener_count
    with listener_lock:
        listener_count += 1
        emit('listener_count', {'count': listener_count}, broadcast=True)
    print(f"مستمع جديد متصل. الإجمالي: {listener_count}")

@socketio.on('disconnect')
def handle_disconnect():
    global listener_count
    with listener_lock:
        listener_count -= 1
        emit('listener_count', {'count': listener_count}, broadcast=True)
    print(f"انقطع اتصال المستمع. الإجمالي: {listener_count}")

@socketio.on('request_stream')
def handle_stream_request():
    """إرسال البث الصوتي عند الطلب"""
    def generate_stream():
        try:
            with requests.get(STREAM_URL, stream=True, timeout=10) as r:
                for chunk in r.iter_content(chunk_size=1024):
                    if chunk:
                        emit('audio_chunk', {'data': chunk.hex()})
        except Exception as e:
            print(f"خطأ في البث: {e}")
            emit('stream_error', {'message': 'حدث خطأ في البث'})

    threading.Thread(target=generate_stream).start()

def record_stream(device_id, session_id):
    """تسجيل البث الصوتي وحفظه مؤقتًا ثم رفعه إلى Cloudinary"""
    try:
        recording_file = active_recordings[device_id][session_id]['file']

        # تسجيل البث في ملف مؤقت
        with requests.get(STREAM_URL, stream=True) as r:
            with open(recording_file, 'wb') as f:
                while active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
                    chunk = next(r.iter_content(chunk_size=1024), None)
                    if chunk:
                        f.write(chunk)

        # رفع الملف إلى Cloudinary عند إيقاف التسجيل
        if os.path.exists(recording_file):
            public_id = f"quran_radio/{device_id}/recording_{session_id}"
            response = cloudinary.uploader.upload(
                recording_file,
                resource_type="video",
                public_id=public_id
            )
            print("تم رفع التسجيل إلى Cloudinary:", response['secure_url'])

            # حفظ بيانات Cloudinary في active_recordings
            active_recordings[device_id][session_id]['cloudinary_url'] = response['secure_url']
            active_recordings[device_id][session_id]['cloudinary_public_id'] = response['public_id']

            # حذف الملف المؤقت بعد الرفع
            os.remove(recording_file)

    except Exception as e:
        print(f"خطأ في التسجيل لـ Device {device_id}: {e}")
    finally:
        with recordings_lock:
            if device_id in active_recordings and session_id in active_recordings[device_id]:
                active_recordings[device_id][session_id]['active'] = False

@socketio.on('start_recording')
def handle_start_recording(data):
    """بدء تسجيل جديد"""
    device_id = data.get('device_id')
    if not device_id:
        return {'status': 'error', 'message': 'Device ID مطلوب'}
    
    with recordings_lock:
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        
        session_id = str(uuid.uuid4())
        expiry_time = datetime.now() + timedelta(days=1)
        recording_file = os.path.join(RECORDINGS_DIR, f"recording_{session_id}.mp3")
        
        if device_id not in active_recordings:
            active_recordings[device_id] = {}
        
        active_recordings[device_id][session_id] = {
            'active': True,
            'file': recording_file,
            'thread': None,
            'expiry': expiry_time,
            'cloudinary_url': None
        }
        
        recording_thread = threading.Thread(target=record_stream, args=(device_id, session_id))
        active_recordings[device_id][session_id]['thread'] = recording_thread
        recording_thread.start()
        
        emit('recording_started', {'session_id': session_id})

@socketio.on('stop_recording')
def handle_stop_recording(data):
    """إيقاف التسجيل"""
    device_id = data.get('device_id')
    session_id = data.get('session_id')
    
    if not device_id or not session_id:
        return {'status': 'error', 'message': 'Device ID و Session ID مطلوبان'}
    
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            active_recordings[device_id][session_id]['active'] = False
            emit('recording_stopped', {'session_id': session_id})

@socketio.on('download_recording')
def handle_download_recording(data):
    """تنزيل التسجيل"""
    device_id = data.get('device_id')
    session_id = data.get('session_id')
    
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            if 'cloudinary_url' in active_recordings[device_id][session_id]:
                emit('recording_url', {
                    'url': active_recordings[device_id][session_id]['cloudinary_url'],
                    'session_id': session_id
                })
            else:
                emit('recording_error', {'message': 'التسجيل غير جاهز بعد'})

@socketio.on('delete_recording')
def handle_delete_recording(data):
    """حذف التسجيل"""
    device_id = data.get('device_id')
    session_id = data.get('session_id')
    
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            try:
                # حذف من Cloudinary لو موجود
                if 'cloudinary_public_id' in active_recordings[device_id][session_id]:
                    cloudinary.uploader.destroy(
                        active_recordings[device_id][session_id]['cloudinary_public_id'],
                        resource_type="video"
                    )
                # حذف من الذاكرة المؤقتة
                del active_recordings[device_id][session_id]
                emit('recording_deleted', {'session_id': session_id})
            except Exception as e:
                emit('recording_error', {'message': f'خطأ في حذف التسجيل: {str(e)}'})

if __name__ == '__main__':
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))
