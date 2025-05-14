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

# إعدادات البث المباشر
STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv"
RECORDINGS_DIR = "temp_recordings"  # مجلد مؤقت لحفظ التسجيلات قبل الرفع
RECORDING_CHUNK_DURATION = 4 * 60  # 4 دقائق بالثواني

# تخزين جلسات التسجيل
active_recordings = {}  # {device_id: {session_id: {'active': bool, 'files': list, 'thread': threading.Thread, 'expiry': datetime}}}
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

@app.route('/stream')
def proxy_stream():
    # إعادة توجيه مباشر للبث مع التعامل مع الأخطاء
    try:
        req = requests.get(STREAM_URL, stream=True)
        return Response(
            req.iter_content(chunk_size=1024),
            content_type=req.headers['content-type']
        )
    except Exception as e:
        print(f"Error in streaming: {e}")
        return Response(status=500)

def record_stream_chunk(device_id, session_id, chunk_index):
    """تسجيل جزء من البث الصوتي"""
    try:
        chunk_file = os.path.join(RECORDINGS_DIR, f"recording_{session_id}_{chunk_index}.mp3")
        
        # إضافة الملف إلى القائمة
        with recordings_lock:
            if device_id in active_recordings and session_id in active_recordings[device_id]:
                active_recordings[device_id][session_id]['files'].append(chunk_file)
        
        # تسجيل البث في ملف مؤقت
        start_time = datetime.now()
        with requests.get(STREAM_URL, stream=True) as r, open(chunk_file, 'wb') as f:
            while (datetime.now() - start_time).seconds < RECORDING_CHUNK_DURATION and \
                  active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
                chunk = next(r.iter_content(chunk_size=1024), None)
                if chunk:
                    f.write(chunk)
        
        # إذا كان التسجيل لا يزال نشطًا، نبدأ جزءًا جديدًا
        if active_recordings.get(device_id, {}).get(session_id, {}).get('active', False):
            threading.Thread(target=record_stream_chunk, args=(device_id, session_id, chunk_index + 1)).start()

    except Exception as e:
        print(f"خطأ في تسجيل الجزء {chunk_index} لـ Device {device_id}: {e}")

@app.route('/start-record/<device_id>')
def start_recording(device_id):
    with recordings_lock:
        # إنشاء مجلد مؤقت إذا لم يكن موجودًا
        os.makedirs(RECORDINGS_DIR, exist_ok=True)
        
        session_id = str(uuid.uuid4())
        expiry_time = datetime.now() + timedelta(days=1)
        
        if device_id not in active_recordings:
            active_recordings[device_id] = {}
        
        active_recordings[device_id][session_id] = {
            'active': True,
            'files': [],
            'expiry': expiry_time,
            'cloudinary_urls': []
        }
        
        # بدء تسجيل الجزء الأول
        threading.Thread(target=record_stream_chunk, args=(device_id, session_id, 0)).start()
        
        return jsonify({
            'session_id': session_id,
            'chunk_duration': RECORDING_CHUNK_DURATION
        })

@app.route('/stop-record/<device_id>/<session_id>')
def stop_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            active_recordings[device_id][session_id]['active'] = False
            return "تم إيقاف التسجيل بنجاح", 200
        return "لا يوجد تسجيل نشط لإيقافه", 400

@app.route('/upload-chunks/<device_id>/<session_id>')
def upload_chunks(device_id, session_id):
    """رفع الأجزاء إلى Cloudinary مع تحسينات في التعامل مع الأخطاء"""
    with recordings_lock:
        try:
            # التحقق من وجود التسجيل
            if device_id not in active_recordings or session_id not in active_recordings[device_id]:
                return jsonify({
                    "status": "error",
                    "message": "لا يوجد تسجيل نشط"
                }), 404

            # التحقق من وجود ملفات للرفع
            if not active_recordings[device_id][session_id].get('files'):
                return jsonify({
                    "status": "error",
                    "message": "لا توجد أجزاء متاحة للرفع"
                }), 400

            uploaded_urls = []
            failed_uploads = []
            
            for file_path in active_recordings[device_id][session_id]['files']:
                if not os.path.exists(file_path):
                    print(f"الملف غير موجود: {file_path}")
                    failed_uploads.append(file_path)
                    continue

                try:
                    # إنشاء معرف فريد لكل جزء مع الحفاظ على ترتيب الأجزاء
                    chunk_index = len(uploaded_urls) + len(failed_uploads)
                    public_id = f"quran_radio/{device_id}/{session_id}/part_{chunk_index + 1}"
                    
                    # رفع الملف مع إعدادات تحسين
                    response = cloudinary.uploader.upload(
                        file_path,
                        resource_type="video",
                        public_id=public_id,
                        chunk_size=5 * 1024 * 1024,  # 5MB لكل جزء
                        timeout=30,  # 30 ثانية كحد أقصى للرفع
                        quality="auto",
                        format="mp3"
                    )
                    
                    uploaded_urls.append({
                        "url": response['secure_url'],
                        "duration": response.get('duration', 0),
                        "part_number": chunk_index + 1,
                        "size": os.path.getsize(file_path)
                    })
                    
                    # حذف الملف المؤقت بعد الرفع الناجح
                    os.remove(file_path)
                    
                except Exception as e:
                    print(f"خطأ في رفع الجزء {file_path}: {str(e)}")
                    failed_uploads.append(file_path)
                    continue

            # تحديث حالة التسجيل
            active_recordings[device_id][session_id]['cloudinary_urls'] = uploaded_urls
            
            # حذف الملفات الفاشلة بعد المحاولة
            for file_path in failed_uploads:
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"خطأ في حذف الملف الفاشل {file_path}: {str(e)}")

            # إرجاع النتيجة مع تفاصيل الرفع
            return jsonify({
                "status": "success",
                "uploaded_count": len(uploaded_urls),
                "failed_count": len(failed_uploads),
                "uploaded_urls": uploaded_urls,
                "failed_uploads": failed_uploads
            })

        except Exception as e:
            print(f"خطأ غير متوقع في رفع الأجزاء: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "حدث خطأ أثناء رفع الأجزاء",
                "error": str(e)
            }), 500

@app.route('/get-recording-urls/<device_id>/<session_id>')
def get_recording_urls(device_id, session_id):
    """الحصول على روابط التسجيلات من Cloudinary"""
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            return jsonify({
                "urls": active_recordings[device_id][session_id].get('cloudinary_urls', [])
            })
    return jsonify({"error": "لا يوجد تسجيل"}), 404

@app.route('/delete-record/<device_id>/<session_id>')
def delete_recording(device_id, session_id):
    with recordings_lock:
        if device_id in active_recordings and session_id in active_recordings[device_id]:
            try:
                # حذف الملفات المؤقتة
                for file_path in active_recordings[device_id][session_id].get('files', []):
                    if os.path.exists(file_path):
                        os.remove(file_path)
                
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
