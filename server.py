from flask import Flask, Response, jsonify
import requests
import os
from datetime import datetime, timedelta
import uuid
import cloudinary
import cloudinary.uploader
from threading import Lock

app = Flask(__name__)

# Cloudinary Config
cloudinary.config(
    cloud_name=os.getenv('CLOUD_NAME'),
    api_key=os.getenv('API_KEY'),
    api_secret=os.getenv('API_SECRET')
)

STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv"
active_streams = {}
stream_lock = Lock()

# إنشاء مجدول المهام
scheduler = BackgroundScheduler()
scheduler.start()

@app.route('/stream')
def stream_proxy():
    def generate():
        try:
            with requests.get(STREAM_URL, stream=True, timeout=30) as r:
                for chunk in r.iter_content(chunk_size=1024):
                    yield chunk
        except Exception as e:
            print(f"Stream error: {e}")

    return Response(generate(), mimetype="audio/mpeg")

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

        # رفع الملف إلى Cloudinary
        if os.path.exists(recording_file):
            public_id = f"quran_radio/{device_id}/recording_{session_id}"
            response = cloudinary.uploader.upload(
                recording_file,
                resource_type="video",
                public_id=public_id
            )
            
            active_recordings[device_id][session_id]['cloudinary_url'] = response['secure_url']
            active_recordings[device_id][session_id]['cloudinary_public_id'] = response['public_id']
            
            os.remove(recording_file)

    except Exception as e:
        print(f"خطأ في التسجيل: {e}")
    finally:
        with recordings_lock:
            if device_id in active_recordings and session_id in active_recordings[device_id]:
                active_recordings[device_id][session_id]['active'] = False

@app.route('/start-record/<device_id>')
def start_recording(device_id):
    with recordings_lock:
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        
        session_id = str(uuid.uuid4())
        recording_file = os.path.join(RECORDINGS_DIR, f"recording_{session_id}.mp3")
        
        if device_id not in active_recordings:
            active_recordings[device_id] = {}
        
        active_recordings[device_id][session_id] = {
            'active': True,
            'file': recording_file,
            'expiry': datetime.now() + timedelta(days=1),
            'cloudinary_url': None
        }
        
        threading.Thread(target=record_stream, args=(device_id, session_id)).start()
        
        return session_id

@app.route('/stop-record/<device_id>/<session_id>')
def stop_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            active_recordings[device_id][session_id]['active'] = False
            return "تم إيقاف التسجيل", 200
        return "التسجيل غير موجود", 404

@app.route('/download/<device_id>/<session_id>')
def download_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            if 'cloudinary_url' in active_recordings[device_id][session_id]:
                return jsonify({"url": active_recordings[device_id][session_id]['cloudinary_url']})
    return jsonify({"error": "التسجيل غير متاح"}), 404

@app.route('/delete-record/<device_id>/<session_id>')
def delete_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            try:
                if 'cloudinary_public_id' in active_recordings[device_id][session_id]:
                    cloudinary.uploader.destroy(
                        active_recordings[device_id][session_id]['cloudinary_public_id'],
                        resource_type="video"
                    )
                del active_recordings[device_id][session_id]
                return "تم الحذف بنجاح", 200
            except Exception as e:
                return f"خطأ في الحذف: {str(e)}", 500
    return "التسجيل غير موجود", 404

if __name__ == '__main__':
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
