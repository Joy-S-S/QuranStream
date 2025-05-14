document.addEventListener('DOMContentLoaded', function () {
    const destination = "https://quranliveradio.up.railway.app";
    let audioElement;
    let retryCount = 0;
    const MAX_RETRIES = 15; // زيادة عدد المحاولات
    const INITIAL_RETRY_DELAY = 2000; // 2 ثانية بداية
    const MAX_RETRY_DELAY = 30000; // 30 ثانية كحد أقصى
    let currentRetryDelay = INITIAL_RETRY_DELAY;
    let lastDataTime = Date.now();
    let isUserAction = false;
    let healthCheckInterval;
    let reconnectTimeout;

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
        toggleLibraryBtn: document.getElementById('toggleLibraryBtn'),
        listenerCount: document.getElementById('listenerCount'),
        currentTrack: document.getElementById('current-track')
    };

    // حالة التطبيق
    const state = {
        isPlaying: false,
        isRecording: false,
        recordingStartTime: null,
        recordingInterval: null,
        recordingSessionId: null,
        deviceId: null,
        userRecordings: []
    };

    // الثوابت
    const STORAGE_KEY = 'quranRadioRecordings';
    const RECORDING_EXPIRY_DAYS = 1;

    /* ----- وظائف إدارة البث الصوتي المحسنة ----- */

    function initializeAudioStream() {
        // تنظيف أي موارد سابقة
        cleanupPreviousStream();

        // إنشاء عنصر صوت جديد مع منع التخزين المؤقت
        audioElement = new Audio(`${destination}/stream?_=${Date.now()}`);
        document.body.appendChild(audioElement);

        // إعداد معالجات الأحداث
        setupAudioEventHandlers();

        // بدء التشغيل التلقائي
        startPlayback();
    }

    function cleanupPreviousStream() {
        if (audioElement) {
            audioElement.pause();
            audioElement.src = '';
            audioElement.removeEventListener('error', handleStreamError);
            audioElement.removeEventListener('playing', handleStreamPlaying);
            audioElement.removeEventListener('ended', handleStreamEnded);
            audioElement.removeEventListener('timeupdate', handleTimeUpdate);
            document.body.removeChild(audioElement);
        }
        clearTimeout(reconnectTimeout);
    }

    function setupAudioEventHandlers() {
        audioElement.addEventListener('error', handleStreamError);
        audioElement.addEventListener('playing', handleStreamPlaying);
        audioElement.addEventListener('ended', handleStreamEnded);
        audioElement.addEventListener('timeupdate', handleTimeUpdate);
    }

    function startPlayback() {
        audioElement.play()
            .then(() => {
                state.isPlaying = true;
                lastDataTime = Date.now();
                updatePlayButton();
                updateStatus('البث المباشر');
                startHealthCheck();
            })
            .catch(error => {
                console.error('فشل التشغيل التلقائي:', error);
                handleStreamError();
            });
    }

    function handleStreamError() {
        if (isUserAction) return;

        console.error('حدث خطأ في البث');
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`محاولة إعادة اتصال ${retryCount} (التأخير: ${currentRetryDelay}ms)`);
            
            updateStatus(`جاري إعادة الاتصال... (${retryCount}/${MAX_RETRIES})`);
            
            reconnectTimeout = setTimeout(() => {
                currentRetryDelay = Math.min(currentRetryDelay * 2, MAX_RETRY_DELAY);
                initializeAudioStream();
            }, currentRetryDelay);
        } else {
            console.error('تجاوز الحد الأقصى لمحاولات إعادة الاتصال');
            updateStatus('انقطع الاتصال. يرجى المحاولة لاحقًا');
        }
    }

    function handleStreamPlaying() {
        console.log('البث يعمل بنجاح');
        retryCount = 0;
        currentRetryDelay = INITIAL_RETRY_DELAY;
        lastDataTime = Date.now();
        updateStatus('البث المباشر');
    }

    function handleStreamEnded() {
        console.log('انتهى البث');
        if (!isUserAction) {
            handleStreamError();
        }
    }

    function handleTimeUpdate() {
        lastDataTime = Date.now();
    }

    function startHealthCheck() {
        clearInterval(healthCheckInterval);
        
        healthCheckInterval = setInterval(() => {
            if (state.isPlaying) {
                // إذا لم يتم استلام بيانات خلال 15 ثانية
                if (Date.now() - lastDataTime > 15000) {
                    console.log('لم يتم استلام بيانات خلال 15 ثانية');
                    handleStreamError();
                }
                
                // إذا كان البث متوقفاً بدون سبب
                if (audioElement.paused && !isUserAction) {
                    console.log('اكتشاف توقف غير متوقع');
                    handleStreamError();
                }
            }
        }, 5000); // فحص كل 5 ثواني
    }

    function togglePlayback() {
        isUserAction = true;
        
        if (state.isPlaying) {
            audioElement.pause();
            state.isPlaying = false;
            clearTimeout(reconnectTimeout);
        } else {
            startPlayback();
        }
        
        updatePlayButton();
        setTimeout(() => { isUserAction = false; }, 1000);
    }

    /* ----- وظائف التسجيل والمكتبة ----- */

    function initializeDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).substr(2, 16);
            localStorage.setItem('deviceId', deviceId);
        }
        state.deviceId = deviceId;
        return deviceId;
    }

    function loadRecordings() {
        initializeDeviceId();

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const allRecordings = JSON.parse(saved) || {};
                state.userRecordings = allRecordings[state.deviceId] || [];

                const now = Date.now();
                state.userRecordings = state.userRecordings.map(rec => ({
                    ...rec,
                    startTime: new Date(rec.startTime),
                    expiry: new Date(rec.expiry).getTime()
                })).filter(rec => rec.expiry > now);

                saveRecordings();
                updateRecordingsList();
            } catch (error) {
                console.error('فشل تحميل التسجيلات:', error);
                state.userRecordings = [];
            }
        }
    }

    function saveRecordings() {
        const allRecordings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        allRecordings[state.deviceId] = state.userRecordings.map(rec => ({
            ...rec,
            startTime: rec.startTime.toISOString(),
            expiry: new Date(rec.expiry).toISOString()
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecordings));
    }

    function toggleRecording() {
        if (state.isRecording) {
            stopRecording();
        } else {
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
                return response.text();
            })
            .then(sessionId => {
                state.recordingSessionId = sessionId;
                state.isRecording = true;
                state.recordingStartTime = Date.now();

                elements.recordBtn.classList.add('recording');
                elements.recordingInfo.classList.remove('hidden');
                elements.downloadBtn.classList.add('hidden');

                state.recordingInterval = setInterval(updateRecordingTimer, 1000);

                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + RECORDING_EXPIRY_DAYS);

                state.userRecordings.push({
                    id: sessionId,
                    startTime: new Date(),
                    duration: 0,
                    expiry: expiryDate.getTime()
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

                const recording = state.userRecordings.find(
                    r => r.id === state.recordingSessionId
                );

                if (recording) {
                    recording.duration = Math.floor(
                        (Date.now() - state.recordingStartTime) / 1000
                    );
                    saveRecordings();
                }
            })
            .catch(error => {
                console.error('فشل إيقاف التسجيل:', error);
                alert('تعذر إيقاف التسجيل. يرجى المحاولة مرة أخرى');
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
            saveRecordings();
        }
    }

    function downloadRecording(sessionId) {
        fetch(`${destination}/download/${state.deviceId}/${sessionId}`)
            .then(response => {
                if (!response.ok) throw new Error("Network response was not ok");
                return response.json();
            })
            .then(data => {
                if (data.url) {
                    window.open(data.url, '_blank');
                } else {
                    alert("تعذر العثور على رابط التسجيل حاول بعد قليل");
                }
            })
            .catch(error => {
                console.error('فشل تحميل التسجيل:', error);
                alert('تعذر تحميل التسجيل: ' + error.message);
            });
    }

    function deleteRecording(sessionId) {
        if (!confirm('هل أنت متأكد من حذف هذا التسجيل؟')) return;

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

    function updateRecordingsList() {
        elements.recordingsList.innerHTML = '';

        const now = Date.now();
        state.userRecordings = state.userRecordings.filter(
            r => r.expiry > now
        );
        saveRecordings();

        if (state.userRecordings.length === 0) {
            elements.recordingsList.innerHTML = 
                `<p style="text-align: center; color: #7f8c8d;">
                    لا توجد تسجيلات متاحة
                </p>`;
            return;
        }

        const sortedRecordings = [...state.userRecordings].sort(
            (a, b) => b.startTime - a.startTime
        );

        sortedRecordings.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recording-item';

            const timeString = rec.startTime.toLocaleTimeString();
            const dateString = rec.startTime.toLocaleDateString();
            const expiryString = new Date(rec.expiry).toLocaleString();

            item.innerHTML = `
                <div class="recording-item-info">
                    <span class="recording-item-name">تسجيل ${timeString}</span>
                    <span class="recording-item-time">
                        ${dateString} - ${formatTime(rec.duration)}
                    </span>
                    <span class="recording-item-expiry">
                        تنتهي في: ${expiryString}
                    </span>
                </div>
                <div class="recording-item-actions">
                    <button class="recording-item-btn download-item" title="تحميل">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="recording-item-btn delete" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;

            item.querySelector('.delete').addEventListener('click', () => {
                deleteRecording(rec.id);
            });

            item.querySelector('.download-item').addEventListener('click', () => {
                downloadRecording(rec.id);
            });

            elements.recordingsList.appendChild(item);
        });
    }

    /* ----- وظائف المساعدة ----- */

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateListenerCount() {
        fetch(`${destination}/listener-count`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(count => {
                elements.listenerCount.textContent = count;
            })
            .catch(error => {
                console.error('فشل تحديث عدد المستمعين:', error);
            });
    }

    function updateStatus(message) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = message;
        }
    }

    function updatePlayButton() {
        elements.playBtn.innerHTML = state.isPlaying
            ? '<i class="fas fa-pause"></i>'
            : '<i class="fas fa-play"></i>';
    }

    function setupControls() {
        elements.playBtn.addEventListener('click', togglePlayback);
        elements.recordBtn.addEventListener('click', toggleRecording);
        elements.downloadBtn.addEventListener('click', () => {
            if (state.recordingSessionId) {
                downloadRecording(state.recordingSessionId);
            }
        });
        elements.volumeSlider.addEventListener('input', () => {
            if (audioElement) {
                audioElement.volume = elements.volumeSlider.value;
            }
        });
        elements.progressBar.addEventListener('input', seekAudio);
        elements.toggleLibraryBtn.addEventListener('click', () => {
            elements.recordingsLibrary.classList.toggle('hidden');
            if (!elements.recordingsLibrary.classList.contains('hidden')) {
                updateRecordingsList();
            }
        });
    }

    function seekAudio() {
        if (audioElement && audioElement.duration) {
            audioElement.currentTime = (elements.progressBar.value / 100) * audioElement.duration;
        }
    }

    /* ----- التهيئة الرئيسية ----- */

    function init() {
        elements.currentYear.textContent = new Date().getFullYear();
        initializeAudioStream();
        setupControls();
        loadRecordings();
        setInterval(updateListenerCount, 10000);
        updateListenerCount();
    }

    init();
});
