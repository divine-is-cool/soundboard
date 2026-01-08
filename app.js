// ===== Divine Soundboard - Main Application =====

// ===== API Key Management =====
function getApiKey() {
    if (window.ENV && window.ENV.API_KEY && window.ENV.API_KEY.length > 0) {
        return window.ENV.API_KEY;
    }
    return localStorage.getItem('freesound_api_key') || '';
}

function hasBuiltInApiKey() {
    return window.ENV && window. ENV.API_KEY && window.ENV. API_KEY.length > 0;
}

// ===== State Management =====
const state = {
    get apiKey() {
        return getApiKey();
    },
    currentPage: 1,
    totalPages: 1,
    totalResults: 0,
    currentQuery: '',
    currentFilters: {
        duration: '',
        sort: 'score'
    },
    favorites: JSON.parse(localStorage. getItem('divine_favorites')) || [],
    currentSound: null,
    audioElement: null,
    volume: parseInt(localStorage.getItem('divine_volume')) || 80,
    autoStop: localStorage.getItem('divine_autostop') !== 'false',
    theme: localStorage.getItem('divine_theme') || 'dark'
};

// ===== DOM Elements =====
const elements = {
    // Tabs
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Search
    searchInput:  document.getElementById('search-input'),
    searchBtn: document. getElementById('search-btn'),
    filterDuration: document.getElementById('filter-duration'),
    filterSort:  document.getElementById('filter-sort'),
    resultsCount: document.getElementById('results-count'),
    soundsGrid: document.getElementById('sounds-grid'),
    loading: document.getElementById('loading'),
    pagination: document.getElementById('pagination'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageInfo: document.getElementById('page-info'),
    
    // Favorites
    favoritesGrid: document.getElementById('favorites-grid'),
    favoritesEmpty: document.getElementById('favorites-empty'),
    
    // Settings
    apiStatus: document.getElementById('api-status'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeValue: document. getElementById('volume-value'),
    autoStopCheckbox: document.getElementById('auto-stop'),
    themeBtns: document. querySelectorAll('. theme-btn'),
    clearFavorites: document.getElementById('clear-favorites'),
    exportFavorites: document. getElementById('export-favorites'),
    importFavorites: document. getElementById('import-favorites'),
    importFile: document.getElementById('import-file'),
    
    // Now Playing
    nowPlaying: document.getElementById('now-playing'),
    nowPlayingTitle: document.getElementById('now-playing-title'),
    nowPlayingStop: document.getElementById('now-playing-stop'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document. getElementById('progress-fill'),
    timeDisplay: document.getElementById('time-display'),
    volumeMini: document.getElementById('volume-mini'),
    
    // Modal
    modal: document.getElementById('sound-modal'),
    modalClose: document.getElementById('modal-close'),
    modalBody: document.getElementById('modal-body'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ===== FreeSound API =====
const API_BASE = 'https://freesound.org/apiv2';

async function searchSounds(query, page = 1) {
    if (!state.apiKey) {
        showToast('error', 'API Key Required', 'No API key configured. Please contact the site administrator.');
        return null;
    }
    
    const params = new URLSearchParams({
        query: query,
        page: page,
        page_size: 12,
        fields: 'id,name,description,tags,duration,avg_rating,num_downloads,previews,images,created,license',
        sort: state.currentFilters. sort,
        token: state.apiKey
    });
    
    if (state.currentFilters.duration) {
        const [min, max] = state.currentFilters. duration.split(',');
        params.append('filter', `duration:[${min} TO ${max}]`);
    }
    
    try {
        const response = await fetch(`${API_BASE}/search/text/? ${params}`);
        
        if (!response. ok) {
            if (response.status === 401) {
                throw new Error('API authentication failed.  Please contact the site administrator.');
            }
            throw new Error('Failed to fetch sounds');
        }
        
        return await response.json();
    } catch (error) {
        showToast('error', 'Search Error', error.message);
        return null;
    }
}

async function getSoundDetails(soundId) {
    if (!state.apiKey) return null;
    
    try {
        const response = await fetch(
            `${API_BASE}/sounds/${soundId}/? token=${state.apiKey}&fields=id,name,description,tags,duration,avg_rating,num_downloads,num_ratings,previews,images,created,license,type,channels,samplerate,bitdepth,filesize`
        );
        
        if (!response.ok) throw new Error('Failed to fetch sound details');
        
        return await response.json();
    } catch (error) {
        showToast('error', 'Error', error.message);
        return null;
    }
}

// ===== UI Functions =====
function switchTab(tabName) {
    elements. navTabs.forEach(tab => {
        tab.classList.toggle('active', tab. dataset.tab === tabName);
    });
    
    elements. tabContents.forEach(content => {
        content.classList. toggle('active', content.id === `${tabName}-tab`);
    });
    
    if (tabName === 'favorites') {
        renderFavorites();
    }
}

function showLoading(show) {
    elements. loading.classList.toggle('active', show);
    elements.soundsGrid.style.display = show ?  'none' : 'grid';
    elements.pagination.style.display = show ?  'none' : 'flex';
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs. toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createSoundCard(sound) {
    const favorited = state.favorites.some(f => f.id === sound.id);
    const imageUrl = sound.images?.waveform_m || '';
    
    const card = document.createElement('div');
    card.className = 'sound-card';
    card.innerHTML = `
        <div class="sound-card-image">
            ${imageUrl 
                ? `<img src="${imageUrl}" alt="Waveform" loading="lazy">`
                : `<div class="waveform-placeholder"><i class="fas fa-music"></i></div>`
            }
            <button class="sound-card-play" data-preview="${sound.previews?. ['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'] || ''}" data-name="${escapeHtml(sound.name)}">
                <i class="fas fa-play"></i>
            </button>
        </div>
        <div class="sound-card-body">
            <h3 class="sound-card-title" data-id="${sound.id}">${escapeHtml(sound.name)}</h3>
            <div class="sound-card-meta">
                <span><i class="fas fa-clock"></i> ${formatDuration(sound. duration)}</span>
                <span><i class="fas fa-star"></i> ${sound.avg_rating?. toFixed(1) || 'N/A'}</span>
                <span><i class="fas fa-download"></i> ${sound.num_downloads?. toLocaleString() || 0}</span>
            </div>
            <div class="sound-card-tags">
                ${(sound.tags || []).slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="sound-card-actions">
                <button class="btn-favorite ${favorited ? 'favorited' : ''}" data-id="${sound.id}" title="${favorited ? 'Remove from favorites' : 'Add to favorites'}">
                    <i class="fas fa-heart"></i>
                </button>
                <button class="btn-info" data-id="${sound.id}" title="View details">
                    <i class="fas fa-info-circle"></i>
                </button>
                <a href="https://freesound.org/sounds/${sound.id}/" target="_blank" rel="noopener" class="btn-external" title="View on FreeSound">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    `;
    
    // Add event listeners
    const playBtn = card. querySelector('.sound-card-play');
    playBtn.addEventListener('click', () => playSound(playBtn.dataset.preview, playBtn. dataset.name));
    
    const title = card.querySelector('. sound-card-title');
    title.addEventListener('click', () => showSoundModal(sound.id));
    
    const favBtn = card.querySelector('. btn-favorite');
    favBtn.addEventListener('click', () => toggleFavorite(sound, favBtn));
    
    const infoBtn = card.querySelector('.btn-info');
    infoBtn.addEventListener('click', () => showSoundModal(sound. id));
    
    return card;
}

function renderSounds(data) {
    elements.soundsGrid. innerHTML = '';
    
    if (!data || ! data.results || data.results. length === 0) {
        elements. resultsCount.textContent = 'No sounds found';
        elements.pagination.style.display = 'none';
        return;
    }
    
    state.totalResults = data.count;
    state. totalPages = Math.ceil(data.count / 12);
    
    elements.resultsCount. textContent = `Found ${data.count. toLocaleString()} sounds`;
    
    data.results.forEach(sound => {
        elements.soundsGrid. appendChild(createSoundCard(sound));
    });
    
    updatePagination();
}

function renderFavorites() {
    elements.favoritesGrid.innerHTML = '';
    
    if (state.favorites.length === 0) {
        elements.favoritesEmpty.classList.add('active');
        return;
    }
    
    elements.favoritesEmpty.classList.remove('active');
    
    state.favorites. forEach(sound => {
        elements.favoritesGrid.appendChild(createSoundCard(sound));
    });
}

function updatePagination() {
    elements.prevPage.disabled = state.currentPage === 1;
    elements.nextPage.disabled = state.currentPage >= state.totalPages;
    elements.pageInfo. textContent = `Page ${state.currentPage} of ${state. totalPages}`;
}

function updateApiStatusDisplay() {
    if (hasBuiltInApiKey()) {
        elements.apiStatus.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <span>API key is configured and ready to use! </span>
        `;
    } else if (state.apiKey) {
        elements.apiStatus.innerHTML = `
            <i class="fas fa-check-circle" style="color: var(--success);"></i>
            <span>Using your personal API key</span>
        `;
    } else {
        elements.apiStatus.innerHTML = `
            <i class="fas fa-exclamation-circle" style="color:  var(--danger);"></i>
            <span>No API key configured. Please contact the site administrator. </span>
        `;
    }
}

// ===== Audio Functions =====
function playSound(previewUrl, name) {
    if (!previewUrl) {
        showToast('warning', 'No Preview', 'This sound has no preview available.');
        return;
    }
    
    if (state.autoStop && state.audioElement) {
        state. audioElement.pause();
    }
    
    state.audioElement = new Audio(previewUrl);
    state.audioElement.volume = state.volume / 100;
    state.currentSound = name;
    
    state. audioElement.addEventListener('loadedmetadata', () => {
        elements.nowPlaying.classList. add('active');
        elements.nowPlayingTitle.textContent = name;
    });
    
    state.audioElement. addEventListener('timeupdate', () => {
        const progress = (state.audioElement.currentTime / state.audioElement. duration) * 100;
        elements. progressFill.style.width = `${progress}%`;
        elements.timeDisplay.textContent = `${formatDuration(state.audioElement. currentTime)} / ${formatDuration(state.audioElement.duration)}`;
    });
    
    state.audioElement.addEventListener('ended', () => {
        elements. nowPlaying.classList.remove('active');
        elements.progressFill.style. width = '0%';
    });
    
    state. audioElement.addEventListener('error', () => {
        showToast('error', 'Playback Error', 'Failed to play this sound.');
        elements.nowPlaying. classList.remove('active');
    });
    
    state. audioElement.play();
}

function stopSound() {
    if (state.audioElement) {
        state.audioElement. pause();
        state.audioElement.currentTime = 0;
        elements.nowPlaying.classList. remove('active');
        elements.progressFill.style.width = '0%';
    }
}

// ===== Favorites Functions =====
function toggleFavorite(sound, button) {
    const index = state.favorites. findIndex(f => f.id === sound.id);
    
    if (index === -1) {
        state.favorites. push(sound);
        button.classList. add('favorited');
        showToast('success', 'Added to Favorites', `"${sound.name}" has been saved. `);
    } else {
        state.favorites.splice(index, 1);
        button.classList.remove('favorited');
        showToast('info', 'Removed from Favorites', `"${sound.name}" has been removed.`);
    }
    
    localStorage.setItem('divine_favorites', JSON. stringify(state.favorites));
    
    if (document.getElementById('favorites-tab').classList.contains('active')) {
        renderFavorites();
    }
}

// ===== Modal Functions =====
async function showSoundModal(soundId) {
    elements.modal.classList.add('active');
    elements.modalBody.innerHTML = '<div class="loading active"><div class="spinner"></div><p>Loading details... </p></div>';
    
    const sound = await getSoundDetails(soundId);
    
    if (! sound) {
        elements.modalBody. innerHTML = '<p style="text-align:  center; padding: 2rem;">Failed to load sound details. </p>';
        return;
    }
    
    const favorited = state.favorites.some(f => f.id === sound.id);
    
    elements.modalBody.innerHTML = `
        <div class="modal-header">
            <h2>${escapeHtml(sound.name)}</h2>
            <div class="meta">
                <span><i class="fas fa-calendar"></i> ${new Date(sound.created).toLocaleDateString()}</span>
                <span><i class="fas fa-file-audio"></i> ${sound.type?. toUpperCase() || 'Audio'}</span>
                <span><i class="fas fa-balance-scale"></i> ${sound.license}</span>
            </div>
        </div>
        
        ${sound.images?. waveform_l ?  `
            <div class="modal-waveform">
                <img src="${sound.images.waveform_l}" alt="Waveform">
            </div>
        ` : ''}
        
        <div class="modal-controls">
            <button class="btn-primary" id="modal-play">
                <i class="fas fa-play"></i> Play Preview
            </button>
            <button class="btn-secondary ${favorited ? 'favorited' : ''}" id="modal-favorite">
                <i class="fas fa-heart"></i> ${favorited ? 'Favorited' : 'Add to Favorites'}
            </button>
            <a href="https://freesound.org/sounds/${sound.id}/" target="_blank" rel="noopener" class="btn-secondary">
                <i class="fas fa-external-link-alt"></i> View on FreeSound
            </a>
        </div>
        
        <div class="modal-section">
            <h3>Description</h3>
            <p>${sound.description ?  escapeHtml(sound.description) : 'No description available.'}</p>
        </div>
        
        <div class="modal-section">
            <h3>Tags</h3>
            <div class="modal-tags">
                ${(sound.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        </div>
        
        <div class="modal-section">
            <h3>Statistics</h3>
            <div class="modal-stats">
                <div class="stat-item">
                    <div class="value">${formatDuration(sound.duration)}</div>
                    <div class="label">Duration</div>
                </div>
                <div class="stat-item">
                    <div class="value">${sound.avg_rating?.toFixed(1) || 'N/A'}</div>
                    <div class="label">Rating (${sound.num_ratings || 0})</div>
                </div>
                <div class="stat-item">
                    <div class="value">${sound.num_downloads?. toLocaleString() || 0}</div>
                    <div class="label">Downloads</div>
                </div>
                <div class="stat-item">
                    <div class="value">${formatFileSize(sound.filesize || 0)}</div>
                    <div class="label">File Size</div>
                </div>
                <div class="stat-item">
                    <div class="value">${sound.samplerate ?  (sound.samplerate / 1000).toFixed(1) + ' kHz' : 'N/A'}</div>
                    <div class="label">Sample Rate</div>
                </div>
                <div class="stat-item">
                    <div class="value">${sound. channels || 'N/A'}</div>
                    <div class="label">Channels</div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal event listeners
    document.getElementById('modal-play').addEventListener('click', () => {
        const previewUrl = sound. previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'];
        playSound(previewUrl, sound.name);
    });
    
    document.getElementById('modal-favorite').addEventListener('click', (e) => {
        toggleFavorite(sound, e.currentTarget);
        const isFav = state.favorites. some(f => f.id === sound. id);
        e.currentTarget.innerHTML = isFav 
            ? '<i class="fas fa-heart"></i> Favorited' 
            : '<i class="fas fa-heart"></i> Add to Favorites';
        e.currentTarget.classList.toggle('favorited', isFav);
    });
}

function closeModal() {
    elements.modal.classList.remove('active');
}

// ===== Toast Notifications =====
function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info:  'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <div class="toast-content">
            <div class="title">${escapeHtml(title)}</div>
            <div class="message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    elements.toastContainer. appendChild(toast);
    
    const closeBtn = toast. querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    setTimeout(() => {
        toast. style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ===== Search Function =====
async function performSearch(query, page = 1) {
    if (! query.trim()) {
        showToast('warning', 'Empty Search', 'Please enter a search term.');
        return;
    }
    
    state.currentQuery = query;
    state. currentPage = page;
    
    showLoading(true);
    
    const data = await searchSounds(query, page);
    
    showLoading(false);
    
    if (data) {
        renderSounds(data);
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    // Tab navigation
    elements. navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Search
    elements.searchBtn.addEventListener('click', () => {
        performSearch(elements.searchInput.value);
    });
    
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(elements.searchInput. value);
        }
    });
    
    // Filters
    elements.filterDuration.addEventListener('change', (e) => {
        state.currentFilters. duration = e.target.value;
        if (state.currentQuery) {
            performSearch(state.currentQuery);
        }
    });
    
    elements.filterSort. addEventListener('change', (e) => {
        state.currentFilters.sort = e.target.value;
        if (state.currentQuery) {
            performSearch(state.currentQuery);
        }
    });
    
    // Pagination
    elements.prevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            performSearch(state.currentQuery, state.currentPage - 1);
        }
    });
    
    elements.nextPage. addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            performSearch(state.currentQuery, state.currentPage + 1);
        }
    });
    
    // Now Playing controls
    elements.nowPlayingStop.addEventListener('click', stopSound);
    
    elements.progressBar.addEventListener('click', (e) => {
        if (state.audioElement) {
            const rect = elements.progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            state. audioElement.currentTime = percent * state.audioElement.duration;
        }
    });
    
    document.getElementById('volume-mini').addEventListener('input', (e) => {
        state.volume = parseInt(e.target.value);
        if (state.audioElement) {
            state.audioElement.volume = state.volume / 100;
        }
        elements.volumeSlider.value = state.volume;
        elements.volumeValue.textContent = `${state.volume}%`;
        localStorage.setItem('divine_volume', state. volume);
    });
    
    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
    
    // Settings - Volume
    elements.volumeSlider.addEventListener('input', (e) => {
        state.volume = parseInt(e. target.value);
        elements.volumeValue. textContent = `${state.volume}%`;
        document.getElementById('volume-mini').value = state.volume;
        if (state.audioElement) {
            state.audioElement.volume = state.volume / 100;
        }
        localStorage.setItem('divine_volume', state.volume);
    });
    
    // Settings - Auto Stop
    elements.autoStopCheckbox. addEventListener('change', (e) => {
        state.autoStop = e.target. checked;
        localStorage.setItem('divine_autostop', state.autoStop);
    });
    
    // Settings - Theme
    elements.themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.themeBtns.forEach(b => b.classList. remove('active'));
            btn.classList. add('active');
            const theme = btn.dataset.theme;
            document. documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('divine_theme', theme);
        });
    });
    
    // Settings - Clear Favorites
    elements.clearFavorites.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all favorites?  This cannot be undone.')) {
            state. favorites = [];
            localStorage.setItem('divine_favorites', JSON.stringify([]));
            renderFavorites();
            showToast('success', 'Favorites Cleared', 'All favorites have been removed.');
        }
    });
    
    // Settings - Export Favorites
    elements.exportFavorites.addEventListener('click', () => {
        if (state.favorites.length === 0) {
            showToast('warning', 'No Favorites', 'You have no favorites to export.');
            return;
        }
        const dataStr = JSON.stringify(state.favorites, null, 2);
        const blob = new Blob([dataStr], { type:  'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'divine-soundboard-favorites.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Export Complete', `Exported ${state.favorites. length} favorites. `);
    });
  
// Settings - Import Favorites
    elements.importFavorites.addEventListener('click', () => {
        elements.importFile.click();
    });
    
    elements.importFile.addEventListener('change', (e) => {
        const file = e. target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (Array.isArray(imported)) {
                        const beforeCount = state.favorites.length;
                        state.favorites = [... state.favorites, ...imported];
                        // Remove duplicates
                        state.favorites = state.favorites.filter((v, i, a) => 
                            a. findIndex(t => t.id === v.id) === i
                        );
                        const addedCount = state. favorites.length - beforeCount;
                        localStorage.setItem('divine_favorites', JSON. stringify(state.favorites));
                        renderFavorites();
                        showToast('success', 'Import Complete', `Added ${addedCount} new sounds to favorites.`);
                    } else {
                        throw new Error('Invalid format');
                    }
                } catch (err) {
                    showToast('error', 'Import Failed', 'Invalid file format.  Please use a valid JSON export file.');
                }
            };
            reader.readAsText(file);
            // Reset input so same file can be imported again
            e.target.value = '';
        }
    });
    
    // Keyboard shortcuts
    document. addEventListener('keydown', (e) => {
        // Escape to close modal
        if (e.key === 'Escape') {
            closeModal();
        }
        
        // Space to pause/play (when not in input)
        if (e.key === ' ' && state.audioElement && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            if (state. audioElement.paused) {
                state.audioElement.play();
            } else {
                state. audioElement.pause();
            }
        }
        
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.searchInput.focus();
        }
    });
}

// ===== Initialize App =====
function initApp() {
    // Apply saved theme
    document.documentElement.setAttribute('data-theme', state.theme);
    elements.themeBtns.forEach(btn => {
        btn. classList.toggle('active', btn. dataset.theme === state.theme);
    });
    
    // Apply saved volume
    elements.volumeSlider.value = state. volume;
    elements.volumeValue. textContent = `${state.volume}%`;
    document.getElementById('volume-mini').value = state.volume;
    
    // Apply saved auto-stop setting
    elements.autoStopCheckbox.checked = state.autoStop;
    
    // Update API status display
    updateApiStatusDisplay();
    
    // Initialize event listeners
    initEventListeners();
    
    // Render favorites if any
    renderFavorites();
    
    // Show welcome message
    if (state.apiKey) {
        showToast('info', 'Welcome to Divine Soundboard', 'Search for sounds to get started!');
      } else {
        showToast('warning', 'API Key Missing', 'No API key configured. Please contact the site administrator.');
    }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
