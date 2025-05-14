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

app = Flask(__name__)

# إعدادات Cloudinary
cloudinary.config(
    cloud_name=os.getenv('CLOUD_NAME'),
    api_key=os.getenv('API_KEY'),
    api_secret=os.getenv('API_SECRET')
)

print("Cloudinary config:", os.getenv('CLOUD_NAME'), os.getenv('API_KEY'), os.getenv('API_SECRET'))

# إعدادات البث المباشر
STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv"
RECORDINGS_DIR = "temp_recordings"  # مجلد مؤقت لحفظ التسجيلات قبل الرفع

# تخزين جلسات التسجيل
active_recordings = {}  # {device_id: {session_id: {'active': bool, 'file': str, 'thread': threading.Thread, 'expiry': datetime}}}
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
    return send_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# عدد المستمعين
listener_count = 0
listener_lock = Lock()

@app.route('/stream')
def proxy_stream():
    def generate():
        global listener_count
        
        with listener_lock:
            listener_count += 1
            print(f"مستمع جديد متصل. الإجمالي: {listener_count}")
        
        try:
            with requests.get(STREAM_URL, stream=True) as r:
                for chunk in r.iter_content(chunk_size=1024):
                    if chunk:
                        yield chunk
        finally:
            with listener_lock:
                listener_count -= 1
                print(f"انقطع اتصال المستمع. الإجمالي: {listener_count}")
    
    return Response(generate(), content_type='audio/mpeg')

@app.route('/listener-count')
def get_listener_count():
    with listener_lock:
        return str(listener_count)

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
                resource_type="video",  # Cloudinary يعامل الصوت كـ "فيديو"
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


@app.route('/start-record/<device_id>')
def start_recording(device_id):
    with recordings_lock:
        # إنشاء مجلد مؤقت إذا لم يكن موجودًا
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
            if 'cloudinary_url' in active_recordings[device_id][session_id]:
                return jsonify({"url": active_recordings[device_id][session_id]['cloudinary_url']})
    return jsonify({"error": "لا يوجد تسجيل"}), 404

@app.route('/delete-record/<device_id>/<session_id>')
def delete_recording(device_id, session_id):
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
                return "تم حذف التسجيل بنجاح", 200
            except Exception as e:
                return f"خطأ في حذف التسجيل: {str(e)}", 500
    return "لا يوجد تسجيل", 404


if __name__ == '__main__':
    os.makedirs(RECORDINGS_DIR, exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
