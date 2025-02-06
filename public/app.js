// Memeriksa status autentikasi user dan mengarahkan ke halaman login atau dashboard
fetch('/check-auth', { credentials: 'include' })
  .then(response => response.json())
  .then(data => {
    if (!data.authenticated && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    if (data.authenticated && window.location.pathname === '/login') {
      window.location.href = '/dashboard';
    }
  });

// Fungsi untuk membuat container streaming
function createContainer(containerData) {
  const containersDiv = document.getElementById('containers');
  const defaultMessage = document.getElementById('defaultMessage');
  let containerCount = containersDiv.children.length + 1;

  // Inisialisasi data container dengan nilai default bila tidak ada data
  let title = containerData?.title || 'Streaming Baru';
  let streamKey = containerData?.stream_key || '';
  let streamUrl = containerData?.stream_url || 'rtmp://a.rtmp.youtube.com/live2';
  let bitrate = containerData?.bitrate || 3000;
  let fps = containerData?.fps || 30;
  let resolution = containerData?.resolution || '1920:1080';
  let loop = containerData?.loop_enabled !== 0;
  let previewFile = containerData?.preview_file || null;
  let isStreaming = containerData?.is_streaming === 1;

  const container = document.createElement('div');
  container.className = 'bg-white shadow-lg rounded-xl p-6 relative';
  container.dataset.streamKey = streamKey;
  container.dataset.containerId = containerData?.id;
  container.dataset.filePath = previewFile;

  container.innerHTML = `
    <div class="container-header flex justify-between items-center">
      <div class="flex items-center gap-2">
        <span class="text-gray-600">${containerCount} -</span>
        <span class="container-title font-medium">${title}</span>
        <button class="edit-title ml-2 text-gray-500 hover:text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
        </button>
      </div>
      <button class="remove-container text-gray-600 hover:text-red-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="relative aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg">
      <div class="text-white">
        <button class="bg-transparent border-2 border-white text-white px-4 py-2 rounded-lg hover:bg-white/20 upload-video">Upload Video</button>
      </div>
      <video class="w-full h-full object-contain ${previewFile ? '' : 'hidden'}" preload="metadata"></video>
      <input type="file" class="hidden" accept="video/*" > 
      <div class="absolute inset-0 flex items-center justify-center text-white text-sm upload-status hidden">
        <span>Uploading <span class="upload-percentage">0%</span></span>
        <button class="text-red-500 hover:text-red-700 ml-2 cancel-upload">Cancel</button>
      </div>
    </div>
    <div class="mt-3 flex justify-end items-center">
      <label class="switch">
        <input type="checkbox" class="loop-video" ${loop ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
      <span class="text-sm text-gray-700 ml-2">Loop Video</span>
    </div>
    <div class="mt-4 relative">
      <input placeholder="Stream Key" class="w-full p-2 border rounded-lg stream-key pr-10" type="password" value="${streamKey}">
      <button class="absolute right-2 top-2 text-gray-500 hover:text-gray-700 toggle-password">
        <svg id="eyeIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye w-5 h-5">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    </div>
    <div class="mt-4">
      <input placeholder="Stream URL" class="w-full p-2 border rounded-lg stream-url" value="${streamUrl}">
    </div>
    <div class="mt-4 grid grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700">Bitrate (kbps)</label>
        <input type="number" class="w-full p-2 border rounded-lg bitrate" value="${bitrate}" min="1000" max="20000">
      </div>
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700">Resolusi</label>
        <select class="w-full p-2 border rounded-lg resolution">
          <option value="480:360">360p</option>
          <option value="854:480">480p</option>
          <option value="1280:720">720p</option>
          <option value="1920:1080" selected>1080p</option>
          <option value="2560:1440">2K</option>
          <option value="3840:2160">4K</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-2 text-gray-700">FPS</label>
        <select class="w-full p-2 border rounded-lg fps">
          <option value="24">24fps</option>
          <option value="30" selected>30fps</option>
          <option value="60">60fps</option>
          <option value="120">120fps</option>
        </select>
      </div>
    </div>
    <div class="pt-3"><hr></div>
    <div class="mt-4 flex justify-between items-center">
      <div class="flex gap-2">
        <button class="bg-green-500 text-white px-4 py-2 rounded-lg start-stream hover:bg-green-600 transition-all ${isStreaming ? 'hidden' : ''}">Start</button>
        <button class="bg-red-500 text-white px-4 py-2 rounded-lg stop-stream ${isStreaming ? '' : 'hidden'} hover:bg-red-600 transition-all">Stop</button>
        <button class="bg-gray-500 text-white px-4 py-2 rounded-lg remove-video ${previewFile ? '' : 'hidden'} hover:bg-gray-600 transition-all">Hapus Video</button>
      </div>
      <div class="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 live-notif hidden">
        <i class="fa-solid fa-circle mr-1 animate-pulse " style="font-size: 8px;"></i>LIVE
      </div>
    </div>
  `;

  containersDiv.appendChild(container);

  // Pasang event listener pada container yang baru dibuat
  addStreamKeyToggle(container);
  addVideoUpload(container);
  addStartStream(container);
  addStopStream(container);
  addRemoveVideo(container);
  addRemoveContainer(container);
  addEditTitle(container);
  addLoopVideo(container);
  updateContainerNumbers(containersDiv);
  checkContainers(containersDiv, defaultMessage);

  // Jika ada preview video, tampilkan video dan sesuaikan tampilan tombol
  const videoElement = container.querySelector('video');
  const uploadVideoBtn = container.querySelector('.upload-video');
  const removeVideoBtn = container.querySelector('.remove-video');
  const stopStreamBtn = container.querySelector('.stop-stream');
  const liveNotif = container.querySelector('.live-notif');
  videoElement.loop = loop;
  if (previewFile) {
    const videoURL = `/video/${previewFile}`;
    videoElement.src = videoURL;
    videoElement.classList.remove('hidden');
    videoElement.controls = true;
    videoElement.volume = 0;
    videoElement.onloadedmetadata = function() {
      this.play();
    }
    uploadVideoBtn.classList.add('hidden');
    if (stopStreamBtn.classList.contains('hidden') === false) {
      removeVideoBtn.disabled = true;
      removeVideoBtn.classList.add('cursor-not-allowed');
      liveNotif.classList.remove('hidden');
    } else {
      removeVideoBtn.disabled = false;
      removeVideoBtn.classList.remove('cursor-not-allowed');
      liveNotif.classList.add('hidden');
    }
  } else {
    removeVideoBtn.disabled = false;
    removeVideoBtn.classList.remove('cursor-not-allowed');
    liveNotif.classList.add('hidden');
  }

  // Update nomor urut container
  function updateContainerNumbers(containersDiv) {
    const containers = containersDiv.querySelectorAll('.container-header');
    containers.forEach((container, index) => {
      const numberElement = container.querySelector('span:first-child');
      numberElement.textContent = `${index + 1} -`;
    });
  }

  // Tampilkan pesan default bila tidak ada container
  function checkContainers(containersDiv, defaultMessage) {
    if (containersDiv.children.length === 0) {
      defaultMessage.classList.remove('hidden');
    } else {
      defaultMessage.classList.add('hidden');
    }
  }
  return container;
}

// Event toggle untuk menampilkan/menghilangkan stream key.
function addStreamKeyToggle(container) {
  const togglePasswordBtn = container.querySelector('.toggle-password');
  const eyeIcon = container.querySelector('#eyeIcon');
  const streamKeyInput = container.querySelector('.stream-key');

  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = streamKeyInput.type === 'password';
    streamKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.classList.toggle('fa-eye');
    eyeIcon.classList.toggle('fa-eye-slash');
  });
}

// Event upload video dan manajemen tampilan terkait upload.
function addVideoUpload(container) {
  let uploadController = null;
  let uploadedFilePath = null;

  const uploadVideoBtn = container.querySelector('.upload-video');
  const fileInput = container.querySelector('input[type="file"]');
  const videoElement = container.querySelector('video');
  const uploadStatus = container.querySelector('.upload-status');
  const uploadPercentage = container.querySelector('.upload-percentage');
  const startStreamBtn = container.querySelector('.start-stream');
  const removeVideoBtn = container.querySelector('.remove-video');

  uploadVideoBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadStatus.classList.remove('hidden');
      uploadVideoBtn.classList.add('hidden');
      startStreamBtn.disabled = true;
      startStreamBtn.classList.remove('bg-green-500');
      startStreamBtn.classList.add('bg-gray-500');
      removeVideoBtn.classList.add('hidden');

      const formData = new FormData();
      formData.append('video', file);

      uploadController = new AbortController();

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload-video', true);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          uploadPercentage.textContent = `${percent}%`;
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.response);
          uploadedFilePath = data.filePath;
          container.dataset.filePath = uploadedFilePath; 
          uploadStatus.classList.add('hidden');

          const videoURL = URL.createObjectURL(file);
          videoElement.src = videoURL;
          videoElement.classList.remove('hidden');
          videoElement.controls = true;
          videoElement.volume = 0;
          videoElement.play();

          removeVideoBtn.classList.remove('hidden');
          startStreamBtn.disabled = false;
          startStreamBtn.classList.remove('bg-gray-500');
          startStreamBtn.classList.add('bg-green-500');

        } else {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: `Upload Gagal! Status: ${xhr.status}`,
          });
        }
      };

      xhr.onerror = () => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Upload Gagal! Terjadi kesalahan.',
        });
        uploadStatus.classList.add('hidden');
        uploadVideoBtn.classList.remove('hidden');
        startStreamBtn.disabled = false;
        startStreamBtn.classList.remove('bg-gray-500');
        startStreamBtn.classList.add('bg-green-500');
        fileInput.value = '';
      };

      xhr.send(formData);
    }
  });

  // Event untuk membatalkan upload
  const cancelUploadBtn = container.querySelector('.cancel-upload');
  cancelUploadBtn.addEventListener('click', () => {
    if (uploadController) {
      uploadController.abort();
      uploadController = null;

      if (uploadedFilePath) {
        fetch('/delete-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: uploadedFilePath }),
        })
          .then(response => response.json())
          .then(data => {
          })
          .catch(error => {
            console.error('Error deleting file:', error);
          });
      }

      uploadStatus.classList.add('hidden');
      uploadVideoBtn.classList.remove('hidden');
      startStreamBtn.disabled = false;
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
      fileInput.value = '';
    }
  });

  // Event untuk menghapus video yang sudah diupload
  removeVideoBtn.addEventListener('click', () => {
    if (uploadedFilePath) {
      fetch('/delete-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath }),
      })
        .then(response => response.json())
        .then(data => {
        })
        .catch(error => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: error.message || 'Gagal menghapus video. Silakan coba lagi.',
          });
        });
    }

    videoElement.src = '';
    videoElement.classList.add('hidden');
    uploadVideoBtn.classList.remove('hidden');
    removeVideoBtn.classList.add('hidden');
    fileInput.value = '';
  });
}

// Event untuk memulai streaming & mengirim data streaming ke server.
function addStartStream(container) {
  const startStreamBtn = container.querySelector('.start-stream');
  const stopStreamBtn = container.querySelector('.stop-stream');
  const removeVideoBtn = container.querySelector('.remove-video');
  const streamKeyInput = container.querySelector('.stream-key');
  const streamUrlInput = container.querySelector('.stream-url');
  const bitrateInput = container.querySelector('.bitrate');
  const loopVideoCheckbox = container.querySelector('.loop-video');
  const resolutionSelect = container.querySelector('.resolution');
  const fpsSelect = container.querySelector('.fps');
  const fileInput = container.querySelector('input[type="file"]');
  const containerTitle = container.querySelector('.container-title');
  const removeContainerBtn = container.querySelector('.remove-container');
  const liveNotif = container.querySelector('.live-notif');

  startStreamBtn.addEventListener('click', async () => {
    const streamKey = streamKeyInput.value;
    const streamUrl = streamUrlInput.value;
    const bitrate = bitrateInput.value;
    const fps = fpsSelect.value;
    const resolution = resolutionSelect.value;
    const loop = loopVideoCheckbox.checked;
    const title = containerTitle.textContent;
    const filePath = container.dataset.filePath;
    let videoFile = fileInput.files[0];

    // Jika file video tidak tersedia pada input tapi ada file preview, ambil file dari server
    if (!videoFile && filePath) {
      const fileName = filePath.split('/').pop();
      try {
        const response = await fetch(`/video/${encodeURIComponent(fileName)}`);
        if (!response.ok) {
          throw new Error('Gagal mengambil video dari server');
        }
        const blob = await response.blob();
        videoFile = new File([blob], fileName, { type: blob.type });
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Gagal mengambil video preview. Harap upload ulang video!',
        });
        return;
      }
    }

    if (!videoFile) {
      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Harap upload video!',
      });
      return;
    }

    // Nonaktifkan tombol dan ubah tampilannya selama proses streaming
    startStreamBtn.disabled = true;
    startStreamBtn.textContent = 'Please wait...';
    startStreamBtn.classList.remove('bg-green-500');
    startStreamBtn.classList.add('bg-gray-500');
    
    removeVideoBtn.disabled = true;
    removeVideoBtn.classList.add('cursor-not-allowed');
    removeContainerBtn.disabled = true;
    removeContainerBtn.classList.add('cursor-not-allowed');

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('rtmp_url', streamUrl);
    formData.append('stream_key', streamKey);
    formData.append('bitrate', bitrate);
    formData.append('fps', fps);
    formData.append('resolution', resolution);
    formData.append('loop', loop);
    formData.append('title', title);

    try {
      const response = await fetch('/start-stream', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.details || 'Failed to start streaming');
      }

      setTimeout(() => {
        toggleStreamButton(container, true);
      }, 1000);

      const eventSource = new EventSource(`/stream-status/${streamKey}`);
      eventSource.onmessage = (event) => {
        const status = JSON.parse(event.data);
        if (!status.is_streaming) {
          toggleStreamButton(container, false);
          eventSource.close();
        }
      };
      eventSource.onerror = (error) => {
        toggleStreamButton(container, false);
      };

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memulai Streaming',
        text: 'Terjadi kesalahan pada koneksi RTMP. Pastikan Stream Key dan URL sudah benar.',
      });

      startStreamBtn.disabled = false;
      startStreamBtn.textContent = 'Start';
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
      removeContainerBtn.disabled = false;
      removeContainerBtn.classList.remove('cursor-not-allowed');
      removeVideoBtn.disabled = false;
      removeVideoBtn.classList.remove('cursor-not-allowed');
      liveNotif.classList.add('hidden');
    }
  });
}

// Event untuk menghentikan streaming.
function addStopStream(container) {
  const stopStreamBtn = container.querySelector('.stop-stream');
  const startStreamBtn = container.querySelector('.start-stream');
  const streamKeyInput = container.querySelector('.stream-key');
  const removeVideoBtn = container.querySelector('.remove-video');
  const removeContainerBtn = container.querySelector('.remove-container');
  const liveNotif = container.querySelector('.live-notif')

  stopStreamBtn.addEventListener('click', async () => {
    const streamKey = streamKeyInput.value;

    if (!streamKey) {
      alert('Stream Key is required!');
      return;
    }

    stopStreamBtn.disabled = true;
    stopStreamBtn.textContent = 'Please wait...';
    stopStreamBtn.classList.remove('bg-red-500');
    stopStreamBtn.classList.add('bg-gray-500');

    try {
      const response = await fetch('/stop-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_key: streamKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Gagal menghentikan streaming';
        throw new Error(errorMessage);
      }

      const data = await response.json();

      setTimeout(() => {
        stopStreamBtn.disabled = false;
        stopStreamBtn.textContent = 'Stop';
        stopStreamBtn.classList.remove('bg-gray-500');
        stopStreamBtn.classList.add('bg-red-500');
        stopStreamBtn.classList.add('hidden');
        startStreamBtn.classList.remove('hidden');
        startStreamBtn.textContent = 'Start';
        startStreamBtn.disabled = false;
        startStreamBtn.classList.remove('bg-gray-500');
        startStreamBtn.classList.add('bg-green-500');
        liveNotif.classList.remove('hidden');
        removeVideoBtn.disabled = false;
        removeVideoBtn.classList.remove('cursor-not-allowed');
        removeContainerBtn.disabled = false;
        removeContainerBtn.classList.remove('cursor-not-allowed');
        toggleStreamButton(container, false);
      }, 5000);

    } catch (error) {
      stopStreamBtn.disabled = false;
      stopStreamBtn.textContent = 'Stop';
      stopStreamBtn.classList.remove('bg-gray-500');
      stopStreamBtn.classList.add('bg-red-500');
      alert(`Error: ${error.message}`);
    }
  });
}

// Event untuk menghapus video yang telah diupload.
function addRemoveVideo(container) {
  const removeVideoBtn = container.querySelector('.remove-video');
  const videoElement = container.querySelector('video');
  const uploadVideoBtn = container.querySelector('.upload-video');
  const fileInput = container.querySelector('input[type="file"]');

  removeVideoBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/delete-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: container.dataset.filePath }),
      });
      const data = await response.json();
      videoElement.src = '';
      videoElement.classList.add('hidden');
      uploadVideoBtn.classList.remove('hidden');
      removeVideoBtn.classList.add('hidden');
      fileInput.value = '';
      container.dataset.filePath = null;
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: error.message || 'Gagal menghapus video. Silakan coba lagi.',
      });
    }
  });
}

// Event untuk menghapus container streaming.
function addRemoveContainer(container) {
  const containersDiv = document.getElementById('containers');
  const removeButton = container.querySelector('.remove-container');
  removeButton.addEventListener('click', () => {
    container.remove();
    updateContainerNumbers(containersDiv);
    checkContainers(containersDiv, document.getElementById('defaultMessage'));
  });
}

// Event untuk mengedit judul container.
function addEditTitle(container) {
  const editTitleButton = container.querySelector('.edit-title');
  const titleElement = container.querySelector('.container-title');
  const originalTitle = titleElement.textContent;

  editTitleButton.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'border rounded px-2 py-1 text-sm w-40';
    input.value = titleElement.textContent;

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        titleElement.textContent = input.value;
        input.replaceWith(titleElement);
        editTitleButton.style.display = 'inline-block';
      }
    });

    input.addEventListener('blur', () => {
      titleElement.textContent = input.value || originalTitle;
      input.replaceWith(titleElement);
      editTitleButton.style.display = 'inline-block';
    });

    titleElement.replaceWith(input);
    input.focus();
    editTitleButton.style.display = 'none';
  });
}

// Mengaktifkan loop video berdasarkan status checkbox.
function addLoopVideo(container) {
  const loopVideoCheckbox = container.querySelector('.loop-video');
  const videoElement = container.querySelector('video');

  loopVideoCheckbox.addEventListener('change', () => {
    videoElement.loop = loopVideoCheckbox.checked;
  });
}

// Mengubah tampilan tombol start/stop dan notifikasi live.
function toggleStreamButton(container, isStreaming) {
  const startStreamBtn = container.querySelector('.start-stream');
  const stopStreamBtn = container.querySelector('.stop-stream');
  const liveNotif = container.querySelector('.live-notif');

  if (isStreaming) {
    startStreamBtn.classList.add('hidden');
    stopStreamBtn.classList.remove('hidden');
    liveNotif.classList.remove('hidden');
  } else {
    startStreamBtn.classList.remove('hidden');
    stopStreamBtn.classList.add('hidden');
    liveNotif.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const addContainerBtn = document.getElementById('addContainer');
  const containersDiv = document.getElementById('containers');
  const defaultMessage = document.getElementById('defaultMessage');

  const profileMenu = document.getElementById('profileMenu');
  const submenu = document.getElementById('submenu');

  profileMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    submenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#submenu') && !e.target.closest('#profileMenu')) {
      submenu.classList.add('hidden');
    }
  });

  submenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Tambah container streaming baru dengan data kosong
  addContainerBtn.addEventListener('click', () => createContainer({}));

  try {
    const response = await fetch('/active-stream-containers', { credentials: 'include' });
    if (response.ok) {
      const containersData = await response.json();
      containersData.forEach(containerData => createContainer(containerData));
    }
    checkContainers(containersDiv, defaultMessage);
  } catch (error) {
    console.error('Error fetching active containers:', error);
  }
});
