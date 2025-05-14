from flask import Flask, Response, send_file, send_from_directory, jsonify
import requests
import os
from datetime import datetime, timedelta
import threading
import uuid
import cloudinary
import cloudinary.uploader
from apscheduler.schedulers.background import BackgroundScheduler
from threading import Lock
import time

app = Flask(__name__)

# إعدادات Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUD_NAME'),
    api_key=os.getenv('API_KEY'),
    api_secret=os.getenv('API_SECRET')
)

# إعدادات البث المباشر
STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv"
RECORDINGS_DIR = "temp_recordings"
RECORDING_SEGMENT_DURATION = 4 * 60  # 4 دقائق بالثواني

# تخزين جلسات التسجيل
active_recordings = {}  # {device_id: {session_id: {'active': bool, 'files': list, 'thread': threading.Thread, 'expiry': datetime, 'current_file': str}}}
recordings_lock = Lock()

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
                        # حذف الملفات المؤقتة
                        for file_path in active_recordings[device_id][session_id].get('files', []):
                            if os.path.exists(file_path):
                                os.remove(file_path)
                        # حذف من الذاكرة
                        del active_recordings[device_id][session_id]
                        print(f"تم حذف التسجيل المنتهي: {session_id} لـ Device: {device_id}")
                    except Exception as e:
                        print(f"خطأ في حذف التسجيل المنتهي {session_id}: {e}")

# جدولة التنظيف كل ساعة
scheduler.add_job(cleanup_expired_recordings, 'interval', hours=1)

@app.route('/')
def serve_index():
    return send_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

def record_stream_segment(device_id, session_id):
    """تسجيل جزء من البث الصوتي"""
    try:
        # التأكد من وجود مجلد التسجيلات
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        
        segment_file = os.path.join(RECORDINGS_DIR, f"recording_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3")
        
        with recordings_lock:
            if device_id not in active_recordings or session_id not in active_recordings[device_id]:
                return
            active_recordings[device_id][session_id]['current_file'] = segment_file
            active_recordings[device_id][session_id]['files'].append(segment_file)
        
        # تسجيل البث في ملف مؤقت
        try:
            with requests.get(STREAM_URL, stream=True, timeout=10) as r:
                r.raise_for_status()
                start_time = time.time()
                with open(segment_file, 'wb') as f:
                    while (time.time() - start_time) < RECORDING_SEGMENT_DURATION:
                        with recordings_lock:
                            if not active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
                                break
                        
                        chunk = next(r.iter_content(chunk_size=1024), None)
                        if chunk:
                            f.write(chunk)
                            f.flush()
        except (requests.RequestException, IOError) as e:
            print(f"خطأ في اتصال البث لـ Device {device_id}: {e}")
            return

        # رفع الملف إلى Cloudinary إذا كان التسجيل لا يزال نشطاً
        with recordings_lock:
            if not (device_id in active_recordings and 
                   session_id in active_recordings[device_id] and 
                   active_recordings[device_id][session_id]['active']):
                if os.path.exists(segment_file):
                    os.remove(segment_file)
                return

        if os.path.exists(segment_file) and os.path.getsize(segment_file) > 0:
            try:
                public_id = f"quran_radio/{device_id}/recording_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                response = cloudinary.uploader.upload(
                    segment_file,
                    resource_type="video",
                    public_id=public_id
                )
                
                with recordings_lock:
                    if device_id in active_recordings and session_id in active_recordings[device_id]:
                        if 'cloudinary_urls' not in active_recordings[device_id][session_id]:
                            active_recordings[device_id][session_id]['cloudinary_urls'] = []
                        active_recordings[device_id][session_id]['cloudinary_urls'].append(response['secure_url'])
            except Exception as e:
                print(f"خطأ في رفع التسجيل إلى Cloudinary: {e}")
            finally:
                if os.path.exists(segment_file):
                    os.remove(segment_file)

    except Exception as e:
        print(f"خطأ غير متوقع في تسجيل الجزء لـ Device {device_id}: {e}")
        if 'segment_file' in locals() and os.path.exists(segment_file):
            os.remove(segment_file)

def record_stream(device_id, session_id):
    """إدارة عملية التسجيل على أجزاء"""
    try:
        while active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
            record_stream_segment(device_id, session_id)
    except Exception as e:
        print(f"خطأ في التسجيل لـ Device {device_id}: {e}")
    finally:
        with recordings_lock:
            if device_id in active_recordings and session_id in active_recordings[device_id]:
                active_recordings[device_id][session_id]['active'] = False

@app.route('/start-record/<device_id>')
def start_recording(device_id):
    with recordings_lock:
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        
        session_id = str(uuid.uuid4())
        expiry_time = datetime.now() + timedelta(days=1)
        
        if device_id not in active_recordings:
            active_recordings[device_id] = {}
        
        active_recordings[device_id][session_id] = {
            'active': True,
            'files': [],
            'cloudinary_urls': [],
            'thread': None,
            'expiry': expiry_time,
            'current_file': None
        }
        
        recording_thread = threading.Thread(target=record_stream, args=(device_id, session_id))
        active_recordings[device_id][session_id]['thread'] = recording_thread
        recording_thread.start()
        
        return session_id

@app.route('/stop-record/<device_id>/<session_id>')
def stop_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            active_recordings[device_id][session_id]['active'] = False
            return "تم إيقاف التسجيل بنجاح", 200
        return "لا يوجد تسجيل نشط لإيقافه", 400

@app.route('/download/<device_id>/<session_id>')
def download_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            if 'cloudinary_urls' in active_recordings[device_id][session_id]:
                return jsonify({
                    "urls": active_recordings[device_id][session_id]['cloudinary_urls'],
                    "session_id": session_id
                })
    return jsonify({"error": "لا يوجد تسجيل"}), 404

@app.route('/delete-record/<device_id>/<session_id>')
def delete_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            try:
                # حذف من Cloudinary
                for url in active_recordings[device_id][session_id].get('cloudinary_urls', []):
                    public_id = url.split('/')[-1].split('.')[0]
                    cloudinary.uploader.destroy(public_id, resource_type="video")
                
                # حذف من الذاكرة
                del active_recordings[device_id][session_id]
                return "تم حذف التسجيل بنجاح", 200
            except Exception as e:
                return f"خطأ في حذف التسجيل: {str(e)}", 500
    return "لا يوجد تسجيل", 404

if __name__ == '__main__':
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
