document.addEventListener('DOMContentLoaded', function () {
    const destination = "https://quranliveradio.up.railway.app";
    const audioElement = new Audio("https://stream.radiojar.com/8s5u5tpdtwzuv");
    document.body.appendChild(audioElement);

    // تعريف جميع عناصر DOM
    const elements = {
        playBtn: document.getElementById('playBtn'),
        recordBtn: document.getElementById('recordBtn'),
        downloadBtn: document.getElementById('downloadBtn'),
        volumeSlider: document.getElementById('volumeSlider'),
        progressBar: document.getElementById('progressBar'),
        currentTime: document.getElementById('currentTime'),
        duration: document.getElementById('duration'),
        recordingTime: document.getElementById('recordingTime'),
        recordingInfo: document.getElementById('recordingInfo'),
        currentYear: document.getElementById('current-year'),
        recordingsLibrary: document.querySelector('.recordings-library'),
        recordingsList: document.getElementById('recordingsList'),
        toggleLibraryBtn: document.getElementById('toggleLibraryBtn')
    };

    // حالة التطبيق
    const state = {
        isPlaying: false,
        isRecording: false,
        recordingStartTime: null,
        recordingInterval: null,
        recordingSessionId: null,
        deviceId: null,
        userRecordings: [],
        currentChunk: 0
    };

    // الثوابت
    const STORAGE_KEY = 'quranRadioRecordings';
    const RECORDING_EXPIRY_DAYS = 1;

    // تهيئة السنة الحالية
    elements.currentYear.textContent = new Date().getFullYear();

    /* ----- الوظائف الأساسية ----- */

    // توليد أو استرجاع Device ID
    function initializeDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).substr(2, 16);
            localStorage.setItem('deviceId', deviceId);
        }
        state.deviceId = deviceId;
        return deviceId;
    }

    // تحميل التسجيلات المحفوظة
    function loadRecordings() {
        initializeDeviceId();

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const allRecordings = JSON.parse(saved) || {};
                state.userRecordings = allRecordings[state.deviceId] || [];

                // تحويل التواريخ وتصفية المنتهية
                const now = Date.now();
                state.userRecordings = state.userRecordings.map(rec => ({
                    ...rec,
                    startTime: new Date(rec.startTime),
                    expiry: new Date(rec.expiry).getTime(),
                    chunks: rec.chunks || 1
                })).filter(rec => rec.expiry > now);

                saveRecordings();
                updateRecordingsList();
            } catch (error) {
                console.error('فشل تحميل التسجيلات:', error);
                state.userRecordings = [];
            }
        }
    }

    // حفظ التسجيلات
    function saveRecordings() {
        const allRecordings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

        allRecordings[state.deviceId] = state.userRecordings.map(rec => ({
            ...rec,
            startTime: rec.startTime.toISOString(),
            expiry: new Date(rec.expiry).toISOString(),
            chunks: rec.chunks || 1
        }));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecordings));
    }

    /* ----- التحكم في الصوت ----- */

    function setupAudioControls() {
        audioElement.volume = elements.volumeSlider.value;

        elements.volumeSlider.addEventListener('input', () => {
            audioElement.volume = elements.volumeSlider.value;
        });

        elements.playBtn.addEventListener('click', togglePlayback);

        audioElement.addEventListener('timeupdate', updateProgressBar);
        elements.progressBar.addEventListener('input', seekAudio);
    }

    function togglePlayback() {
        if (state.isPlaying) {
            audioElement.pause();
        } else {
            audioElement.play().catch(error => {
                console.error('خطأ في التشغيل:', error);
            });
        }
        state.isPlaying = !state.isPlaying;
        updatePlayButton();
    }

    function updatePlayButton() {
        elements.playBtn.innerHTML = state.isPlaying
            ? '<i class="fas fa-pause"></i>'
            : '<i class="fas fa-play"></i>';
    }

    function updateProgressBar() {
        elements.currentTime.textContent = formatTime(audioElement.currentTime);
        elements.progressBar.value = audioElement.duration
            ? (audioElement.currentTime / audioElement.duration) * 100
            : 0;
        elements.duration.textContent = audioElement.duration
            ? formatTime(audioElement.duration)
            : '--:--';
    }

    function seekAudio() {
        if (audioElement.duration) {
            audioElement.currentTime = (elements.progressBar.value / 100) * audioElement.duration;
        }
    }

    /* ----- التحكم في التسجيلات ----- */

    function setupRecordingControls() {
        elements.recordBtn.addEventListener('click', toggleRecording);
        elements.downloadBtn.addEventListener('click', () => {
            if (state.recordingSessionId) {
                fetchRecordingUrls(state.recordingSessionId);
            }
        });
    }

    function toggleRecording() {
        if (state.isRecording) {
            stopRecording();
        } else {
            // إظهار المكتبة إذا كانت مخفية
            if (elements.recordingsLibrary.classList.contains('hidden')) {
                elements.recordingsLibrary.classList.remove('hidden');
            }
            startRecording();
        }
    }

    function startRecording() {
        fetch(`${destination}/start-record/${state.deviceId}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                state.recordingSessionId = data.session_id;
                state.isRecording = true;
                state.recordingStartTime = Date.now();
                state.currentChunk = 0;

                elements.recordBtn.classList.add('recording');
                elements.recordingInfo.classList.remove('hidden');
                elements.downloadBtn.classList.add('hidden');

                state.recordingInterval = setInterval(updateRecordingTimer, 1000);

                // إضافة تسجيل جديد
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + RECORDING_EXPIRY_DAYS);

                state.userRecordings.push({
                    id: state.recordingSessionId,
                    startTime: new Date(),
                    duration: 0,
                    expiry: expiryDate.getTime(),
                    chunks: 1,
                    uploaded: false
                });

                saveRecordings();
                updateRecordingsList();
            })
            .catch(error => {
                console.error('فشل بدء التسجيل:', error);
                alert('تعذر بدء التسجيل. يرجى المحاولة مرة أخرى');
            });
    }

    function stopRecording() {
        if (!state.recordingSessionId) return;

        fetch(`${destination}/stop-record/${state.deviceId}/${state.recordingSessionId}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');

                clearInterval(state.recordingInterval);
                state.isRecording = false;

                elements.recordBtn.classList.remove('recording');
                elements.downloadBtn.classList.remove('hidden');

                // تحديث مدة التسجيل
                const recording = state.userRecordings.find(
                    r => r.id === state.recordingSessionId
                );

                if (recording) {
                    recording.duration = Math.floor(
                        (Date.now() - state.recordingStartTime) / 1000
                    );
                    recording.chunks = state.currentChunk + 1;
                    saveRecordings();
                }

                // رفع الأجزاء إلى Cloudinary
                uploadRecordingChunks(state.recordingSessionId);
            })
            .catch(error => {
                console.error('فشل إيقاف التسجيل:', error);
                alert('تعذر إيقاف التسجيل. يرجى المحاولة مرة أخرى');
            });
    }

    function uploadRecordingChunks(sessionId) {
        fetch(`${destination}/upload-chunks/${state.deviceId}/${sessionId}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                const recording = state.userRecordings.find(r => r.id === sessionId);
                if (recording) {
                    recording.uploaded = true;
                    recording.urls = data.urls;
                    saveRecordings();
                    updateRecordingsList();
                }
            })
            .catch(error => {
                console.error('فشل رفع التسجيل:', error);
            });
    }

    function updateRecordingTimer() {
        const seconds = Math.floor((Date.now() - state.recordingStartTime) / 1000);
        elements.recordingTime.textContent = formatTime(seconds);

        const recording = state.userRecordings.find(
            r => r.id === state.recordingSessionId
        );

        if (recording) {
            recording.duration = seconds;
            // حساب عدد الأجزاء
            state.currentChunk = Math.floor(seconds / 240); // 4 دقائق
            recording.chunks = state.currentChunk + 1;
            saveRecordings();
        }
    }

    function fetchRecordingUrls(sessionId) {
    fetch(`${destination}/get-recording-urls/${state.deviceId}/${sessionId}`)
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(data => {
            if (data.urls && data.urls.length > 0) {
                // عرض خيارات التحميل لكل جزء
                showDownloadOptions(sessionId, data.urls);
            } else {
                alert("تعذر العثور على رابط التسجيل. يرجى الانتظار حتى يتم رفع الأجزاء.");
            }
        })
        .catch(error => {
            console.error('فشل جلب روابط التسجيل:', error);
            alert('تعذر تحميل التسجيل: ' + error.message);
        });
}

function showDownloadOptions(sessionId, urls) {
    const recording = state.userRecordings.find(r => r.id === sessionId);
    if (!recording) return;

    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';

    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '10px';
    content.style.maxWidth = '500px';
    content.style.width = '90%';

    let html = `
        <h3 style="text-align: center; margin-bottom: 15px;">تحميل التسجيل</h3>
        <p style="margin-bottom: 15px;">اختر الجزء الذي تريد تحميله:</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    urls.forEach((url, index) => {
        const startTime = index * 4 * 60; // 4 دقائق لكل جزء
        const endTime = Math.min((index + 1) * 4 * 60, recording.duration);
        html += `
            <button class="download-chunk-btn" 
                    style="padding: 10px; background: #3498db; color: white; border: none; border-radius: 5px;"
                    data-url="${url}">
                الجزء ${index + 1} (${formatTime(startTime)} - ${formatTime(endTime)})
            </button>
        `;
    });

    html += `
        <button id="download-all-btn" 
                style="padding: 10px; background: #2ecc71; color: white; border: none; border-radius: 5px; margin-top: 10px;">
            تحميل الكل
        </button>
        <button id="close-modal-btn" 
                style="padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 5px; margin-top: 10px;">
            إغلاق
        </button>
        </div>
    `;

    content.innerHTML = html;
    modal.appendChild(content);
    document.body.appendChild(modal);

    // إضافة معالجات الأحداث للأزرار
    content.querySelectorAll('.download-chunk-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.open(btn.dataset.url, '_blank');
        });
    });

    content.querySelector('#download-all-btn').addEventListener('click', () => {
        urls.forEach(url => {
            window.open(url, '_blank');
        });
    });

    content.querySelector('#close-modal-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}
    function deleteRecording(sessionId) {
        fetch(`${destination}/delete-record/${state.deviceId}/${sessionId}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');

                state.userRecordings = state.userRecordings.filter(
                    r => r.id !== sessionId
                );
                saveRecordings();
                updateRecordingsList();
            })
            .catch(error => {
                console.error('فشل حذف التسجيل:', error);
                alert('تعذر حذف التسجيل. يرجى التأكد من ايقاف التسجيل');
            });
    }

    /* ----- إدارة المكتبة ----- */

    function setupLibraryControls() {
        elements.toggleLibraryBtn.addEventListener('click', () => {
            elements.recordingsLibrary.classList.toggle('hidden');
            if (!elements.recordingsLibrary.classList.contains('hidden')) {
                updateRecordingsList();
            }
        });
    }

    function updateRecordingsList() {
    elements.recordingsList.innerHTML = '';

    // تصفية التسجيلات المنتهية
    const now = Date.now();
    state.userRecordings = state.userRecordings.filter(
        r => r.expiry > now
    );
    saveRecordings();

    if (state.userRecordings.length === 0) {
        elements.recordingsList.innerHTML = `
            <p style="text-align: center; color: #7f8c8d;">
                لا توجد تسجيلات متاحة
            </p>
        `;
        return;
    }

    // فرز من الأحدث إلى الأقدم
    const sortedRecordings = [...state.userRecordings].sort(
        (a, b) => b.startTime - a.startTime
    );

    sortedRecordings.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'recording-item';

        const timeString = rec.startTime.toLocaleTimeString();
        const dateString = rec.startTime.toLocaleDateString();
        const expiryString = new Date(rec.expiry).toLocaleString();

        // إنشاء قائمة بالأجزاء المتاحة
        let partsHtml = '';
        if (rec.urls && rec.urls.length > 0) {
            partsHtml = '<div class="recording-parts" style="margin-top: 10px; border-top: 1px dashed #ddd; padding-top: 10px;">';
            rec.urls.forEach((url, index) => {
                const startTime = index * 4 * 60; // 4 دقائق لكل جزء
                const endTime = Math.min((index + 1) * 4 * 60, rec.duration);
                partsHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span>الجزء ${index + 1} (${formatTime(startTime)} - ${formatTime(endTime)})</span>
                        <button class="recording-part-btn" 
                                data-url="${url}"
                                style="background: #3498db; color: white; border: none; border-radius: 3px; padding: 3px 8px; font-size: 0.8rem;">
                            <i class="fas fa-download"></i> تحميل
                        </button>
                    </div>
                `;
            });
            partsHtml += '</div>';
        }

        item.innerHTML = `
            <div class="recording-item-info">
                <span class="recording-item-name">تسجيل ${timeString}</span>
                <span class="recording-item-time">
                    ${dateString} - ${formatTime(rec.duration)} (${rec.chunks} أجزاء)
                </span>
                <span class="recording-item-expiry">
                    تنتهي في: ${expiryString}
                </span>
                ${rec.uploaded ? '<span style="color: green; font-size: 0.8rem;">تم الرفع</span>' : 
                                  '<span style="color: orange; font-size: 0.8rem;">جارٍ الرفع...</span>'}
                ${partsHtml}
            </div>
            <div class="recording-item-actions">
                <button class="recording-item-btn delete" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>`;

        item.querySelector('.delete').addEventListener('click', () => {
            if (confirm('هل أنت متأكد من حذف هذا التسجيل؟')) {
                deleteRecording(rec.id);
            }
        });

        // إضافة معالجات الأحداث لأزرار تحميل الأجزاء
        item.querySelectorAll('.recording-part-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.open(btn.dataset.url, '_blank');
            });
        });

        elements.recordingsList.appendChild(item);
    });
}
    /* ----- أدوات مساعدة ----- */

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /* ----- التهيئة ----- */

    function init() {
        setupAudioControls();
        setupRecordingControls();
        setupLibraryControls();
        loadRecordings();

        // تهيئة حالة زر التشغيل
        audioElement.addEventListener('loadedmetadata', () => {
            state.isPlaying = !audioElement.paused;
            updatePlayButton();
        });

        // بدء التشغيل تلقائياً
        audioElement.play().catch(error => {
            console.error('لا يمكن بدء التشغيل التلقائي:', error);
        });
        state.isPlaying = true;
        updatePlayButton();
    }

    init();
});
