document.addEventListener('DOMContentLoaded', function () {
    const STREAM_URL = "https://stream.radiojar.com/8s5u5tpdtwzuv";
    const destination = "https://quranliveradio.up.railway.app";
    let audioElement;
    let retryCount = 0;
    const MAX_RETRIES = 15;
    const RETRY_DELAY = 3000;

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

    const state = {
        isPlaying: false,
        isRecording: false,
        recordingStartTime: null,
        recordingInterval: null,
        recordingSessionId: null,
        deviceId: null,
        userRecordings: []
    };

    const STORAGE_KEY = 'quranRadioRecordings';
    const RECORDING_EXPIRY_DAYS = 1;

    function initializeAudioStream() {
        cleanupPreviousStream();
        
        audioElement = new Audio(`${STREAM_URL}?_=${Date.now()}`);
        document.body.appendChild(audioElement);
        
        audioElement.addEventListener('error', handleStreamError);
        audioElement.addEventListener('playing', handleStreamPlaying);
        audioElement.addEventListener('ended', handleStreamEnded);
        
        startPlayback();
    }

    function cleanupPreviousStream() {
        if (audioElement) {
            audioElement.pause();
            audioElement.src = '';
            audioElement.removeEventListener('error', handleStreamError);
            audioElement.removeEventListener('playing', handleStreamPlaying);
            audioElement.removeEventListener('ended', handleStreamEnded);
            document.body.removeChild(audioElement);
        }
    }

    function startPlayback() {
        audioElement.play()
            .then(() => {
                state.isPlaying = true;
                retryCount = 0;
                updatePlayButton();
                updateStatus('البث المباشر');
            })
            .catch(error => {
                console.error('فشل التشغيل:', error);
                handleStreamError();
            });
    }

    function handleStreamError() {
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            updateStatus(`جاري إعادة الاتصال... (${retryCount}/${MAX_RETRIES})`);
            
            setTimeout(() => {
                initializeAudioStream();
            }, RETRY_DELAY);
        } else {
            updateStatus('انقطع الاتصال. يرجى المحاولة لاحقًا');
        }
    }

    function handleStreamPlaying() {
        updateStatus('البث المباشر');
    }

    function handleStreamEnded() {
        handleStreamError();
    }

    function togglePlayback() {
        if (state.isPlaying) {
            audioElement.pause();
            state.isPlaying = false;
        } else {
            startPlayback();
        }
        updatePlayButton();
    }

    function initializeDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'dev_' + Math.random().toString(36).substr(2, 16);
            localStorage.setItem('deviceId', deviceId);
        }
        state.deviceId = deviceId;
    }

    function loadRecordings() {
        initializeDeviceId();
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const allRecordings = JSON.parse(saved) || {};
                state.userRecordings = allRecordings[state.deviceId] || [];
                updateRecordingsList();
            } catch (error) {
                console.error('فشل تحميل التسجيلات:', error);
            }
        }
    }

    function saveRecordings() {
        const allRecordings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        allRecordings[state.deviceId] = state.userRecordings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allRecordings));
    }

    function startRecording() {
        fetch(`${destination}/start-record/${state.deviceId}`)
            .then(response => response.json())
            .then(data => {
                state.recordingSessionId = data.session_id;
                state.isRecording = true;
                state.recordingStartTime = Date.now();

                elements.recordBtn.classList.add('recording');
                elements.recordingInfo.classList.remove('hidden');
                elements.downloadBtn.classList.add('hidden');

                state.recordingInterval = setInterval(() => {
                    const seconds = Math.floor((Date.now() - state.recordingStartTime) / 1000);
                    elements.recordingTime.textContent = formatTime(seconds);
                }, 1000);
            })
            .catch(error => {
                console.error('فشل بدء التسجيل:', error);
                alert('تعذر بدء التسجيل');
            });
    }

    function stopRecording() {
        if (!state.recordingSessionId) return;

        fetch(`${destination}/stop-record/${state.deviceId}/${state.recordingSessionId}`)
            .then(response => response.json())
            .then(data => {
                clearInterval(state.recordingInterval);
                state.isRecording = false;
                elements.recordBtn.classList.remove('recording');
                elements.downloadBtn.classList.remove('hidden');

                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + RECORDING_EXPIRY_DAYS);
                
                state.userRecordings.push({
                    id: state.recordingSessionId,
                    startTime: new Date(state.recordingStartTime),
                    duration: data.duration,
                    expiry: expiryDate.getTime(),
                    parts: data.parts
                });
                
                saveRecordings();
                updateRecordingsList();
            })
            .catch(error => {
                console.error('فشل إيقاف التسجيل:', error);
                alert('تعذر إيقاف التسجيل');
            });
    }

    function downloadRecording(sessionId) {
        fetch(`${destination}/download/${state.deviceId}/${sessionId}`)
            .then(response => response.json())
            .then(data => {
                if (data.urls && data.urls.length > 0) {
                    data.urls.forEach(url => {
                        window.open(url, '_blank');
                    });
                } else {
                    alert('لا يوجد أجزاء مسجلة للتحميل');
                }
            })
            .catch(error => {
                console.error('فشل تحميل التسجيل:', error);
                alert('تعذر تحميل التسجيل');
            });
    }

    function deleteRecording(sessionId) {
        if (!confirm('هل أنت متأكد من حذف هذا التسجيل؟')) return;

        fetch(`${destination}/delete-record/${state.deviceId}/${sessionId}`)
            .then(response => response.json())
            .then(data => {
                state.userRecordings = state.userRecordings.filter(r => r.id !== sessionId);
                saveRecordings();
                updateRecordingsList();
            })
            .catch(error => {
                console.error('فشل حذف التسجيل:', error);
                alert('تعذر حذف التسجيل');
            });
    }

    function updateRecordingsList() {
        elements.recordingsList.innerHTML = '';

        const now = Date.now();
        state.userRecordings = state.userRecordings.filter(r => r.expiry > now);
        saveRecordings();

        if (state.userRecordings.length === 0) {
            elements.recordingsList.innerHTML = 
                `<p style="text-align: center; color: #7f8c8d;">لا توجد تسجيلات متاحة</p>`;
            return;
        }

        state.userRecordings.sort((a, b) => b.startTime - a.startTime).forEach(rec => {
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
                    <button class="recording-item-btn download-all" data-id="${rec.id}">
                        <i class="fas fa-download"></i> تحميل الكل
                    </button>
                    ${rec.parts.map((part, i) => 
                        `<button class="recording-item-btn download-part" data-url="${part}">
                            <i class="fas fa-download"></i> الجزء ${i+1}
                        </button>`
                    ).join('')}
                    <button class="recording-item-btn delete" data-id="${rec.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;

            item.querySelector('.download-all').addEventListener('click', (e) => {
                downloadRecording(e.target.closest('button').dataset.id);
            });

            item.querySelectorAll('.download-part').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    window.open(e.target.closest('button').dataset.url, '_blank');
                });
            });

            item.querySelector('.delete').addEventListener('click', (e) => {
                deleteRecording(e.target.closest('button').dataset.id);
            });

            elements.recordingsList.appendChild(item);
        });
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        elements.recordBtn.addEventListener('click', () => {
            if (state.isRecording) stopRecording();
            else startRecording();
        });
        elements.downloadBtn.addEventListener('click', () => {
            if (state.recordingSessionId) {
                downloadRecording(state.recordingSessionId);
            }
        });
        elements.volumeSlider.addEventListener('input', () => {
            if (audioElement) audioElement.volume = elements.volumeSlider.value;
        });
        elements.toggleLibraryBtn.addEventListener('click', () => {
            elements.recordingsLibrary.classList.toggle('hidden');
            if (!elements.recordingsLibrary.classList.contains('hidden')) {
                updateRecordingsList();
            }
        });
    }

    function init() {
        elements.currentYear.textContent = new Date().getFullYear();
        initializeAudioStream();
        setupControls();
        loadRecordings();
    }

    init();
});
