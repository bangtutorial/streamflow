let selectedVideoData = null;
let currentOrientation = 'horizontal';
let isDropdownOpen = false;
const videoSelectorDropdown = document.getElementById('videoSelectorDropdown');
let streamKeyTimeout = null;
let isStreamKeyValid = true;
let currentPlatform = 'Custom';
let audioCodecWarningActive = false;

function openNewStreamModal() {
  const modal = document.getElementById('newStreamModal');
  document.body.style.overflow = 'hidden';
  modal.classList.remove('hidden');
  const advancedSettingsContent = document.getElementById('advancedSettingsContent');
  const advancedSettingsToggle = document.getElementById('advancedSettingsToggle');
  if (advancedSettingsContent && advancedSettingsToggle) {
    advancedSettingsContent.classList.add('hidden');
    const icon = advancedSettingsToggle.querySelector('i');
    if (icon) icon.style.transform = '';
  }
  requestAnimationFrame(() => { modal.classList.add('active'); });
  loadGalleryVideos();
}

function closeNewStreamModal() {
  const modal = document.getElementById('newStreamModal');
  modal.classList.remove('active');
  resetModalForm();
  const advancedSettingsContent = document.getElementById('advancedSettingsContent');
  const advancedSettingsToggle = document.getElementById('advancedSettingsToggle');
  if (advancedSettingsContent && advancedSettingsToggle) {
    advancedSettingsContent.classList.add('hidden');
    const icon = advancedSettingsToggle.querySelector('i');
    if (icon) icon.style.transform = '';
  }
  const durationBadge = document.getElementById('durationBadge');
  if (durationBadge) durationBadge.classList.add('hidden');
  if (typeof resetYtTags === 'function') resetYtTags();
  const ytThumbnailPreview = document.getElementById('ytThumbnailPreview');
  const ytThumbnailPlaceholder = document.getElementById('ytThumbnailPlaceholder');
  const ytThumbnailInput = document.getElementById('ytThumbnail');
  if (ytThumbnailPreview) ytThumbnailPreview.classList.add('hidden');
  if (ytThumbnailPlaceholder) ytThumbnailPlaceholder.classList.remove('hidden');
  if (ytThumbnailInput) ytThumbnailInput.value = '';
  const ytSelectedVideo = document.getElementById('ytSelectedVideo');
  const ytSelectedVideoId = document.getElementById('ytSelectedVideoId');
  if (ytSelectedVideo) ytSelectedVideo.textContent = 'Choose a video...';
  if (ytSelectedVideoId) ytSelectedVideoId.value = '';
  const ytEnableSchedule = document.getElementById('ytEnableSchedule');
  const ytScheduleSettings = document.getElementById('ytScheduleSettings');
  if (ytEnableSchedule) ytEnableSchedule.checked = false;
  if (ytScheduleSettings) ytScheduleSettings.classList.add('hidden');
  if (typeof setStreamMode === 'function') setStreamMode('manual');
  const desktopVideo = document.getElementById('native-preview-desktop');
  const mobileVideo = document.getElementById('native-preview-mobile');
  if (desktopVideo) { desktopVideo.pause(); desktopVideo.src = ''; }
  if (mobileVideo) { mobileVideo.pause(); mobileVideo.src = ''; }
  setTimeout(() => { modal.classList.add('hidden'); document.body.style.overflow = ''; document.body.classList.remove('overflow-hidden'); }, 200);
}

function toggleVideoSelector() {
  const dropdown = document.getElementById('videoSelectorDropdown');
  if (dropdown.classList.contains('hidden')) {
    dropdown.classList.remove('hidden');
    if (!dropdown.dataset.loaded) { loadGalleryVideos(); dropdown.dataset.loaded = 'true'; }
    const searchInput = document.getElementById('videoSearchInput');
    if (searchInput) setTimeout(() => searchInput.focus(), 10);
  } else {
    dropdown.classList.add('hidden');
    const searchInput = document.getElementById('videoSearchInput');
    if (searchInput) searchInput.value = '';
  }
}

function selectVideo(video) {
  selectedVideoData = video;
  const displayText = video.type === 'playlist' ? `[Playlist] ${video.name}` : video.name;
  document.getElementById('selectedVideo').textContent = displayText;
  const videoSelector = document.querySelector('[onclick="toggleVideoSelector()"]');
  videoSelector.classList.remove('border-red-500');
  videoSelector.classList.add('border-gray-600');
  const desktopPreview = document.getElementById('videoPreview');
  const desktopEmptyPreview = document.getElementById('emptyPreview');
  const mobilePreview = document.getElementById('videoPreviewMobile');
  const mobileEmptyPreview = document.getElementById('emptyPreviewMobile');
  const desktopVideo = document.getElementById('native-preview-desktop');
  const mobileVideo = document.getElementById('native-preview-mobile');
  if (desktopVideo) { desktopVideo.pause(); desktopVideo.src = ''; }
  if (mobileVideo) { mobileVideo.pause(); mobileVideo.src = ''; }
  if (video.type === 'playlist') {
    desktopPreview.classList.add('hidden'); mobilePreview.classList.add('hidden');
    desktopEmptyPreview.classList.remove('hidden'); mobileEmptyPreview.classList.remove('hidden');
    const desktopEmptyContent = desktopEmptyPreview.querySelector('div');
    const mobileEmptyContent = mobileEmptyPreview.querySelector('div');
    let playlistInfo = `${video.videoCount || 0} videos`;
    if (video.audioCount && video.audioCount > 0) {
      playlistInfo += ` • ${video.audioCount} background music`;
    }
    const playbackMode = video.is_shuffle ? 'Shuffle' : 'Sequential';
    if (desktopEmptyContent) desktopEmptyContent.innerHTML = `<i class="ti ti-playlist text-4xl text-blue-400 mb-2"></i><p class="text-sm text-gray-300 font-medium">${video.name}</p><p class="text-xs text-blue-300 mt-1">${playlistInfo}</p><p class="text-xs text-gray-400 mt-0.5">${playbackMode} playback</p>`;
    if (mobileEmptyContent) mobileEmptyContent.innerHTML = `<i class="ti ti-playlist text-4xl text-blue-400 mb-2"></i><p class="text-sm text-gray-300 font-medium">${video.name}</p><p class="text-xs text-blue-300 mt-1">${playlistInfo}</p><p class="text-xs text-gray-400 mt-0.5">${playbackMode} playback</p>`;
    hideAudioCodecWarning();
  } else {
    desktopPreview.classList.remove('hidden'); mobilePreview.classList.remove('hidden');
    desktopEmptyPreview.classList.add('hidden'); mobileEmptyPreview.classList.add('hidden');
    document.getElementById('videoPreview').innerHTML = `<video id="native-preview-desktop" class="native-video-player rounded-lg" controls preload="metadata"><source src="${video.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
    document.getElementById('videoPreviewMobile').innerHTML = `<video id="native-preview-mobile" class="native-video-player" controls preload="metadata"><source src="${video.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
  }
  document.getElementById('videoSelectorDropdown').classList.add('hidden');
  const hiddenVideoInput = document.getElementById('selectedVideoId');
  if (hiddenVideoInput) hiddenVideoInput.value = video.id;
  checkAudioCodecCompatibility();
}

async function loadGalleryVideos() {
  try {
    const container = document.getElementById('videoListContainer');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-3"><i class="ti ti-loader animate-spin mr-2"></i>Loading content...</div>';
    const response = await fetch('/api/stream/content');
    const content = await response.json();
    window.allStreamVideos = content;
    displayFilteredVideos(content);
    const searchInput = document.getElementById('videoSearchInput');
    if (searchInput) { searchInput.removeEventListener('input', handleVideoSearch); searchInput.addEventListener('input', handleVideoSearch); setTimeout(() => searchInput.focus(), 10); }
  } catch (error) {
    const container = document.getElementById('videoListContainer');
    if (container) container.innerHTML = `<div class="text-center py-5 text-red-400"><i class="ti ti-alert-circle text-2xl mb-2"></i><p>Failed to load content</p><p class="text-xs text-gray-500 mt-1">Please try again</p></div>`;
  }
}

function handleVideoSearch(e) {
  const searchTerm = e.target.value.toLowerCase().trim();
  if (!window.allStreamVideos) return;
  if (searchTerm === '') { displayFilteredVideos(window.allStreamVideos); return; }
  const filteredContent = window.allStreamVideos.filter(item => item.name.toLowerCase().includes(searchTerm) || (item.type === 'playlist' && item.description && item.description.toLowerCase().includes(searchTerm)));
  displayFilteredVideos(filteredContent);
}

function displayFilteredVideos(videos) {
  const container = document.getElementById('videoListContainer');
  container.innerHTML = '';
  if (!videos || videos.length === 0) {
    container.innerHTML = `<div class="text-center py-5 text-gray-400"><i class="ti ti-search-off text-2xl mb-2"></i><p>No matching content found</p><p class="text-xs text-gray-500 mt-1">Try different keywords</p></div>`;
    return;
  }
  const playlists = videos.filter(item => item.type === 'playlist');
  const regularVideos = videos.filter(item => item.type !== 'playlist');
  const hasPlaylists = playlists.length > 0;
  const hasVideos = regularVideos.length > 0;
  if (hasPlaylists) {
    const playlistHeader = document.createElement('div');
    playlistHeader.className = 'text-xs text-gray-400 px-2 py-1 font-medium';
    playlistHeader.textContent = 'Playlists';
    container.appendChild(playlistHeader);
    playlists.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-dark-600 cursor-pointer transition-colors text-left';
      button.onclick = () => selectVideo(item);
      let countText = `${item.videoCount || 0} videos`;
      if (item.audioCount && item.audioCount > 0) {
        countText += ` • ${item.audioCount} audio`;
      }
      button.innerHTML = `<div class="w-16 h-10 bg-primary/20 rounded overflow-hidden flex-shrink-0 flex items-center justify-center"><i class="ti ti-playlist text-primary text-lg"></i></div><div class="flex-1 min-w-0"><p class="text-sm text-white truncate">${item.name}</p><p class="text-xs text-gray-400">${countText}</p></div>`;
      container.appendChild(button);
    });
  }
  if (hasVideos) {
    if (hasPlaylists) {
      const divider = document.createElement('div');
      divider.className = 'border-t border-gray-600 my-2';
      container.appendChild(divider);
    }
    const videoHeader = document.createElement('div');
    videoHeader.className = 'text-xs text-gray-400 px-2 py-1 font-medium';
    videoHeader.textContent = 'Videos';
    container.appendChild(videoHeader);
    regularVideos.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-dark-600 cursor-pointer transition-colors text-left';
      button.onclick = () => selectVideo(item);
      button.innerHTML = `<div class="w-16 h-10 bg-dark-800 rounded overflow-hidden flex-shrink-0"><img src="${item.thumbnail || '/images/default-video-thumbnail.svg'}" class="w-full h-full object-cover" alt="${item.name}" onerror="this.src='/images/default-video-thumbnail.svg'"></div><div class="flex-1 min-w-0"><p class="text-sm text-white truncate">${item.name}</p><p class="text-xs text-gray-400">${item.duration || '0:00'}</p></div>`;
      container.appendChild(button);
    });
  }
}

function resetModalForm() {
  const form = document.getElementById('newStreamForm');
  form.reset();
  selectedVideoData = null;
  document.getElementById('selectedVideo').textContent = 'Choose a video...';
  const desktopPreview = document.getElementById('videoPreview');
  const desktopEmptyPreview = document.getElementById('emptyPreview');
  const mobilePreview = document.getElementById('videoPreviewMobile');
  const mobileEmptyPreview = document.getElementById('emptyPreviewMobile');
  desktopPreview.classList.add('hidden'); mobilePreview.classList.add('hidden');
  desktopEmptyPreview.classList.remove('hidden'); mobileEmptyPreview.classList.remove('hidden');
  hideAudioCodecWarning();
  const desktopEmptyContent = desktopEmptyPreview.querySelector('div');
  const mobileEmptyContent = mobileEmptyPreview.querySelector('div');
  if (desktopEmptyContent) desktopEmptyContent.innerHTML = `<i class="ti ti-video text-4xl text-gray-600 mb-2"></i><p class="text-sm text-gray-500">Select a video to preview</p>`;
  if (mobileEmptyContent) mobileEmptyContent.innerHTML = `<i class="ti ti-video text-4xl text-gray-600 mb-2"></i><p class="text-sm text-gray-500">Select a video to preview</p>`;
  if (isDropdownOpen) toggleVideoSelector();
  if (typeof setStreamMode === 'function') { const manualModeBtn = document.getElementById('manualModeBtn'); if (manualModeBtn) setStreamMode('manual'); }
  const ytSelectedVideo = document.getElementById('ytSelectedVideo');
  if (ytSelectedVideo) ytSelectedVideo.textContent = 'Choose a video...';
  const ytSelectedVideoId = document.getElementById('ytSelectedVideoId');
  if (ytSelectedVideoId) ytSelectedVideoId.value = '';
  const ytThumbnailPreview = document.getElementById('ytThumbnailPreview');
  const ytThumbnailPlaceholder = document.getElementById('ytThumbnailPlaceholder');
  if (ytThumbnailPreview) ytThumbnailPreview.classList.add('hidden');
  if (ytThumbnailPlaceholder) ytThumbnailPlaceholder.classList.remove('hidden');
  const ytScheduleSettings = document.getElementById('ytScheduleSettings');
  if (ytScheduleSettings) ytScheduleSettings.classList.add('hidden');
  if (typeof resetYtTags === 'function') resetYtTags();
  const ytEnableSchedule = document.getElementById('ytEnableSchedule');
  if (ytEnableSchedule) ytEnableSchedule.checked = false;
}

function initModal() {
  const modal = document.getElementById('newStreamModal');
  if (!modal) return;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeNewStreamModal(); });
  if (videoSelectorDropdown) {
    document.addEventListener('click', (e) => {
      const isClickInsideDropdown = videoSelectorDropdown.contains(e.target);
      const isClickOnButton = e.target.closest('[onclick="toggleVideoSelector()"]');
      if (!isClickInsideDropdown && !isClickOnButton && isDropdownOpen) toggleVideoSelector();
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (isDropdownOpen) toggleVideoSelector(); else if (!modal.classList.contains('hidden')) closeNewStreamModal(); } });
  modal.addEventListener('touchmove', (e) => { if (e.target === modal) e.preventDefault(); }, { passive: false });
}

function setVideoOrientation(orientation) {
  currentOrientation = orientation;
  const buttons = document.querySelectorAll('[onclick^="setVideoOrientation"]');
  buttons.forEach(button => {
    if (button.getAttribute('onclick').includes(orientation)) { button.classList.add('bg-primary', 'border-primary', 'text-white'); button.classList.remove('bg-dark-700', 'border-gray-600'); }
    else { button.classList.remove('bg-primary', 'border-primary', 'text-white'); button.classList.add('bg-dark-700', 'border-gray-600'); }
  });
  updateResolutionDisplay();
}

function updateResolutionDisplay() {
  const select = document.getElementById('resolutionSelect');
  const option = select.options[select.selectedIndex];
  const resolution = option.getAttribute(`data-${currentOrientation}`);
  const quality = option.textContent;
  document.getElementById('currentResolution').textContent = `${resolution} (${quality})`;
}

document.addEventListener('DOMContentLoaded', () => {
  const resolutionSelect = document.getElementById('resolutionSelect');
  if (resolutionSelect) { resolutionSelect.addEventListener('change', updateResolutionDisplay); setVideoOrientation('horizontal'); }
});

function toggleStreamKeyVisibility() {
  const streamKeyInput = document.getElementById('streamKey');
  const streamKeyToggle = document.getElementById('streamKeyToggle');
  if (streamKeyInput.type === 'password') { streamKeyInput.type = 'text'; streamKeyToggle.className = 'ti ti-eye-off'; }
  else { streamKeyInput.type = 'password'; streamKeyToggle.className = 'ti ti-eye'; }
}

document.addEventListener('DOMContentLoaded', function () {
  const platformSelector = document.getElementById('platformSelector');
  const platformDropdown = document.getElementById('platformDropdown');
  const rtmpInput = document.getElementById('rtmpUrl');
  if (!platformSelector || !platformDropdown || !rtmpInput) return;
  platformSelector.addEventListener('click', function (e) { e.stopPropagation(); platformDropdown.classList.toggle('hidden'); });
  const platformOptions = document.querySelectorAll('.platform-option');
  platformOptions.forEach(option => {
    option.addEventListener('click', function () {
      const platformUrl = this.getAttribute('data-url');
      rtmpInput.value = platformUrl;
      platformDropdown.classList.add('hidden');
      updatePlatformIcon(this.querySelector('i').className);
      checkAudioCodecCompatibility();
    });
  });
  document.addEventListener('click', function (e) { if (platformDropdown && !platformDropdown.contains(e.target) && !platformSelector.contains(e.target)) platformDropdown.classList.add('hidden'); });
  function updatePlatformIcon(iconClass) {
    const currentIcon = platformSelector.querySelector('i');
    const iconParts = iconClass.split(' ');
    const brandIconPart = iconParts.filter(part => part.startsWith('ti-'))[0];
    currentIcon.className = `ti ${brandIconPart} text-center`;
    if (brandIconPart.includes('youtube')) currentIcon.classList.add('text-red-500');
    else if (brandIconPart.includes('twitch')) currentIcon.classList.add('text-purple-500');
    else if (brandIconPart.includes('facebook')) currentIcon.classList.add('text-blue-500');
    else if (brandIconPart.includes('instagram')) currentIcon.classList.add('text-pink-500');
    else if (brandIconPart.includes('tiktok')) currentIcon.classList.add('text-white');
    else if (brandIconPart.includes('shopee')) currentIcon.classList.add('text-orange-500');
    else if (brandIconPart.includes('live-photo')) currentIcon.classList.add('text-teal-500');
  }
  if (typeof showToast !== 'function') window.showToast = function () {};
  const streamKeyInput = document.getElementById('streamKey');
  if (streamKeyInput && rtmpInput) {
    rtmpInput.addEventListener('input', function () {
      const url = this.value.toLowerCase();
      if (url.includes('youtube.com')) currentPlatform = 'YouTube';
      else if (url.includes('facebook.com')) currentPlatform = 'Facebook';
      else if (url.includes('twitch.tv')) currentPlatform = 'Twitch';
      else if (url.includes('tiktok.com')) currentPlatform = 'TikTok';
      else if (url.includes('instagram.com')) currentPlatform = 'Instagram';
      else if (url.includes('shopee.io')) currentPlatform = 'Shopee Live';
      else if (url.includes('restream.io')) currentPlatform = 'Restream.io';
      else currentPlatform = 'Custom';
      if (streamKeyInput.value) validateStreamKeyForPlatform(streamKeyInput.value, currentPlatform);
      checkAudioCodecCompatibility();
    });
    streamKeyInput.addEventListener('input', function () {
      clearTimeout(streamKeyTimeout);
      const streamKey = this.value.trim();
      if (!streamKey) return;
      streamKeyTimeout = setTimeout(() => validateStreamKeyForPlatform(streamKey, currentPlatform), 500);
    });
  }
  const advancedSettingsCheckbox = document.getElementById('advancedSettingsCheckbox');
  if (advancedSettingsCheckbox) {
    advancedSettingsCheckbox.addEventListener('change', function() { updateCreateButtonState(); });
  }
  const advancedSettingsToggle = document.getElementById('advancedSettingsToggle');
  if (advancedSettingsToggle) {
    advancedSettingsToggle.addEventListener('click', function() { setTimeout(updateCreateButtonState, 10); });
  }
});

function validateStreamKeyForPlatform(streamKey) {
  if (!streamKey.trim()) return;
  fetch(`/api/streams/check-key?key=${encodeURIComponent(streamKey)}`)
    .then(response => response.json())
    .then(data => {
      const streamKeyInput = document.getElementById('streamKey');
      if (data.isInUse) {
        streamKeyInput.classList.add('border-red-500');
        streamKeyInput.classList.remove('border-gray-600', 'focus:border-primary');
        let errorMsg = document.getElementById('streamKeyError');
        if (!errorMsg) { errorMsg = document.createElement('div'); errorMsg.id = 'streamKeyError'; errorMsg.className = 'text-xs text-red-500 mt-1'; streamKeyInput.parentNode.appendChild(errorMsg); }
        errorMsg.textContent = 'This stream key is already in use. Please use a different key.';
        isStreamKeyValid = false;
      } else {
        streamKeyInput.classList.remove('border-red-500');
        streamKeyInput.classList.add('border-gray-600', 'focus:border-primary');
        const errorMsg = document.getElementById('streamKeyError');
        if (errorMsg) errorMsg.remove();
        isStreamKeyValid = true;
      }
    });
}

document.addEventListener('DOMContentLoaded', initModal);

function isYoutubeRtmpUrl(url) {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('youtube.com') || lowerUrl.includes('rtmp.youtube.com') || lowerUrl.includes('a.rtmp.youtube.com');
}

function isAudioCodecCompatible(audioCodec) {
  if (!audioCodec) return true;
  return audioCodec.toLowerCase().includes('aac');
}

function showAudioCodecWarning(audioCodec) {
  const warningDesktop = document.getElementById('audioCodecWarningDesktop');
  const warningMobile = document.getElementById('audioCodecWarningMobile');
  const codecDesktop = document.getElementById('currentCodecDesktop');
  const codecMobile = document.getElementById('currentCodecMobile');
  if (warningDesktop) { warningDesktop.classList.remove('hidden'); if (codecDesktop) codecDesktop.textContent = audioCodec || 'Unknown'; }
  if (warningMobile) { warningMobile.classList.remove('hidden'); if (codecMobile) codecMobile.textContent = audioCodec || 'Unknown'; }
  audioCodecWarningActive = true;
  updateCreateButtonState();
}

function hideAudioCodecWarning() {
  const warningDesktop = document.getElementById('audioCodecWarningDesktop');
  const warningMobile = document.getElementById('audioCodecWarningMobile');
  if (warningDesktop) warningDesktop.classList.add('hidden');
  if (warningMobile) warningMobile.classList.add('hidden');
  audioCodecWarningActive = false;
  updateCreateButtonState();
}

function updateCreateButtonState() {
  const createBtn = document.querySelector('#newStreamModal button[type="submit"]');
  if (!createBtn) return;
  const advancedSettingsCheckbox = document.getElementById('advancedSettingsCheckbox');
  const isAdvancedEnabled = advancedSettingsCheckbox && advancedSettingsCheckbox.checked;
  if (audioCodecWarningActive && !isAdvancedEnabled) {
    createBtn.disabled = true;
    createBtn.classList.add('opacity-50', 'cursor-not-allowed');
    createBtn.classList.remove('hover:bg-blue-600');
  } else {
    createBtn.disabled = false;
    createBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    createBtn.classList.add('hover:bg-blue-600');
  }
}

function checkAudioCodecCompatibility() {
  const rtmpInput = document.getElementById('rtmpUrl');
  const rtmpUrl = rtmpInput?.value || '';
  const isYoutube = isYoutubeRtmpUrl(rtmpUrl);
  const manualForm = document.getElementById('manualStreamForm');
  const isManualMode = manualForm && !manualForm.classList.contains('hidden');
  if (!isManualMode || !isYoutube || !selectedVideoData || selectedVideoData.type === 'playlist') {
    hideAudioCodecWarning();
    return;
  }
  const audioCodec = selectedVideoData.audio_codec;
  if (!isAudioCodecCompatible(audioCodec)) {
    showAudioCodecWarning(audioCodec);
  } else {
    hideAudioCodecWarning();
  }
}
