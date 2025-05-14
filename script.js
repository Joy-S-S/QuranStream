document.addEventListener('DOMContentLoaded', function () {
    // الاتصال بخادم WebSocket
    const socket = io();
    const audioElement = new Audio();
    let mediaSource;
    let sourceBuffer;

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
        listenerCount: document.getElementById('listenerCount')
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
        audioChunks: []
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

    // حفظ التسجيلات
    function saveRecordings() {
        const allRecordings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

        allRecordings[state.deviceId] = state.userRecordings.map(rec => ({
            ...rec,
            startTime: rec.startTime.toISOString(),
            expiry: new Date(rec.expiry).toISOString()
        }));

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecordings));
    }

    /* ----- التحكم في الصوت ----- */

    function setupAudioControls() {
        // تهيئة عنصر الصوت
        audioElement.volume = elements.volumeSlider.value;

        // معالجة أحداث الصوت
        elements.volumeSlider.addEventListener('input', () => {
            audioElement.volume = elements.volumeSlider.value;
        });

        elements.playBtn.addEventListener('click', togglePlayback);

        audioElement.addEventListener('timeupdate', updateProgressBar);
        elements.progressBar.addEventListener('input', seekAudio);

        // طلب البث عند النقر على التشغيل
        elements.playBtn.addEventListener('click', () => {
            if (state.isPlaying) {
                socket.emit('request_stream');
            }
        });
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
                socket.emit('download_recording', {
                    device_id: state.deviceId,
                    session_id: state.recordingSessionId
                });
            }
        });
    }

    function toggleRecording() {
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        initializeDeviceId();
        socket.emit('start_recording', { device_id: state.deviceId });
    }

    function stopRecording() {
        if (!state.recordingSessionId) return;
        
        socket.emit('stop_recording', {
            device_id: state.deviceId,
            session_id: state.recordingSessionId
        });
        
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
            saveRecordings();
        }
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

    function deleteRecording(sessionId) {
        socket.emit('delete_recording', {
            device_id: state.deviceId,
            session_id: sessionId
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
            elements.recordingsList.innerHTML = 
                `<p style="text-align: center; color: #7f8c8d;">
                    لا توجد تسجيلات متاحة
                </p>`;
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

            item.innerHTML = 
                `<div class="recording-item-info">
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
                socket.emit('download_recording', {
                    device_id: state.deviceId,
                    session_id: rec.id
                });
            });

            elements.recordingsList.appendChild(item);
        });
    }

    /* ----- معالجات WebSocket ----- */

    socket.on('audio_chunk', (data) => {
        if (!state.isPlaying) return;

        const bytes = new Uint8Array(data.data.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        audioElement.src = url;
        audioElement.play().catch(e => console.error('Error playing:', e));
    });

    socket.on('listener_count', (data) => {
        elements.listenerCount.textContent = data.count;
    });

    socket.on('recording_started', (data) => {
        state.recordingSessionId = data.session_id;
        state.isRecording = true;
        state.recordingStartTime = Date.now();

        elements.recordBtn.classList.add('recording');
        elements.recordingInfo.classList.remove('hidden');
        elements.downloadBtn.classList.add('hidden');

        state.recordingInterval = setInterval(updateRecordingTimer, 1000);

        // إضافة تسجيل جديد
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + RECORDING_EXPIRY_DAYS);

        state.userRecordings.push({
            id: data.session_id,
            startTime: new Date(),
            duration: 0,
            expiry: expiryDate.getTime()
        });

        saveRecordings();
        updateRecordingsList();
    });

    socket.on('recording_stopped', (data) => {
        console.log('Recording stopped:', data.session_id);
    });

    socket.on('recording_url', (data) => {
        if (data.session_id === state.recordingSessionId) {
            window.open(data.url, '_blank');
        }
    });

    socket.on('recording_deleted', (data) => {
        state.userRecordings = state.userRecordings.filter(
            r => r.id !== data.session_id
        );
        saveRecordings();
        updateRecordingsList();
    });

    socket.on('stream_error', (data) => {
        console.error('Stream error:', data.message);
        alert('حدث خطأ في البث: ' + data.message);
    });

    socket.on('recording_error', (data) => {
        console.error('Recording error:', data.message);
        alert('حدث خطأ في التسجيل: ' + data.message);
    });

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

        // الاتصال بالخادم عند التحميل
        socket.connect();
    }

    init();
});
