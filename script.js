const TMDB_KEY = '158b14d2caddf15a72691e1617061d51';
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w342';

const savedData = JSON.parse(localStorage.getItem('movieLibraryState')) || {};

const state = {
  library: savedData.library || []
};

const searchState = {
  query: '',
  type: 'movie',
  page: 1,
  totalPages: 1,
  personId: null,
  cachedMovies: []
};

function saveData() {
  localStorage.setItem('movieLibraryState', JSON.stringify({
    library: state.library,
    sortType: document.getElementById('sortType').value,
    sortDir: document.getElementById('sortDirBtn').dataset.dir
  }));
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Network error');
  return r.json();
}

const api = {
  searchMovie: (q, page = 1) => fetchJSON(`${TMDB}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=${page}`),

  searchPerson: (q) => fetchJSON(`${TMDB}/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`),

  credits: (id) => fetchJSON(`${TMDB}/person/${id}/movie_credits?api_key=${TMDB_KEY}`),

  movieDetails: (id) => fetchJSON(`${TMDB}/movie/${id}?api_key=${TMDB_KEY}`),

  movieCredits: (id) => fetchJSON(`${TMDB}/movie/${id}/credits?api_key=${TMDB_KEY}`),

  discoverMovies: (page = 1) => fetchJSON(`${TMDB}/discover/movie?api_key=${TMDB_KEY}&page=${page}&sort_by=popularity.desc`)
};

const libEl = document.getElementById('library');
const overlay = document.getElementById('overlay');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const queryInput = document.getElementById('query');
const typeSelect = document.getElementById('type');

const sortType = document.getElementById('sortType');
const sortDirBtn = document.getElementById('sortDirBtn');
const libSearch = document.getElementById('libSearch');

const detailsOverlay = document.getElementById('detailsOverlay');
const detailsTitle = document.getElementById('detailsTitle');
const detailsBody = document.getElementById('detailsBody');

if (savedData.sortType) sortType.value = savedData.sortType;
if (savedData.sortDir) {
  sortDirBtn.dataset.dir = savedData.sortDir;
  sortDirBtn.innerHTML = savedData.sortDir === 'asc' ? '&#8593' : '&#8595';
}

const filterToggle = document.getElementById('filterToggle');
const filterPanel = document.getElementById('filterPanel');
const yearStartInput = document.getElementById('yearStart');
const yearEndInput = document.getElementById('yearEnd');
const genreListEl = document.getElementById('genreList');

const reviewOverlay = document.getElementById('reviewOverlay');
const reviewTitle = document.getElementById('reviewTitle');
const reviewInput = document.getElementById('reviewInput');
const saveReviewBtn = document.getElementById('saveReviewBtn');
const reviewClose = document.getElementById('reviewClose');
let currentReviewMovieId = null;

const GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
};

filterToggle.onclick = () => {
  const isHidden = filterPanel.style.display === 'none';
  filterPanel.style.display = isHidden ? 'block' : 'none';
};

Object.entries(GENRES).forEach(([id, name]) => {
  const label = document.createElement('label');
  label.className = 'genre-check';
  label.innerHTML = `<input type="checkbox" value="${id}"> ${name}`;
  label.querySelector('input').addEventListener('change', renderLibrary);
  genreListEl.appendChild(label);
});

yearStartInput.addEventListener('input', renderLibrary);
yearEndInput.addEventListener('input', renderLibrary);

function openReviewModal(movie) {
  currentReviewMovieId = movie.id;
  reviewTitle.textContent = `Review: ${movie.title}`;
  reviewInput.value = movie.personalReview || '';
  reviewOverlay.classList.add('open');
}

saveReviewBtn.onclick = () => {
  if (currentReviewMovieId) {
    const movie = state.library.find(m => m.id === currentReviewMovieId);
    if (movie) {
      movie.personalReview = reviewInput.value;
      saveData();
    }
  }
  reviewOverlay.classList.remove('open');
  renderLibrary();
};

reviewClose.onclick = () => reviewOverlay.classList.remove('open');

async function showDetails(movie) {
  detailsTitle.textContent = movie.title;
  detailsBody.innerHTML = '<p class="muted">Loading details…</p>';
  detailsOverlay.classList.add('open');

  try {
    const [details, credits] = await Promise.all([
      api.movieDetails(movie.id),
      api.movieCredits(movie.id)
    ]);

    const year = details.release_date?.slice(0, 4) ?? '—';
    const runtime = details.runtime ? `${details.runtime} min` : '—';
    const genres = details.genres?.map(g => g.name).join(', ') || '—';

    const cast = credits.cast
      .slice(0, 5)
      .map(c => c.name)
      .join(', ') || '—';

    detailsBody.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <img src="${details.poster_path ? IMG + details.poster_path : ''}"
             style="width:220px;border-radius:12px" />
        <div style="max-width:500px">
          <p><strong>Release year:</strong> ${year}</p>
          <p><strong>Runtime:</strong> ${runtime}</p>
          <p><strong>Genres:</strong> ${genres}</p>
          <p><strong>TMDB rating:</strong> ${details.vote_average?.toFixed(1) ?? '—'}</p>
          <p style="margin-top:10px">
            <strong>Cast:</strong><br>
            <span class="muted">${cast}</span>
          </p>
          <p style="margin-top:10px">
            <strong>Overview:</strong><br>
            <span class="muted">${details.overview || 'No description available.'}</span>
          </p>
          ${movie.personalReview ? `<p style="margin-top:14px; padding-top:10px; border-top:1px solid #333;"><strong>Your Review:</strong><br><span style="color:#d1d5db; white-space: pre-wrap;">${movie.personalReview}</span></p>` : ''}
        </div>
      </div>
    `;
  } catch (err) {
    detailsBody.innerHTML = '<p class="muted">Failed to load movie details.</p>';
  }
}

function renderLibrary() {
  libEl.innerHTML = '';
  
  const query = libSearch.value.toLowerCase().trim();
  const selectedGenres = Array.from(genreListEl.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
  
  const startYear = parseInt(yearStartInput.value) || 0;
  const endYear = parseInt(yearEndInput.value) || 9999;

  let list = state.library.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(query);
    const releaseYear = m.releaseDate ? parseInt(m.releaseDate.split('-')[0]) : 0;
    const matchesYear = releaseYear >= startYear && releaseYear <= endYear;
    const matchesGenre = selectedGenres.length === 0 || (m.genreIds && m.genreIds.some(id => selectedGenres.includes(id)));
    return matchesSearch && matchesYear && matchesGenre;
  });

  const type = sortType.value;
  const dir = sortDirBtn.dataset.dir === 'desc' ? -1 : 1;

  if (list.length > 0 && type !== 'added') {
    list.sort((a, b) => {
      let valA, valB;
      switch (type) {
        case 'title': valA = a.title.toLowerCase(); valB = b.title.toLowerCase(); break;
        case 'releaseDate': valA = a.releaseDate || '0000'; valB = b.releaseDate || '0000'; break;
        case 'rating': valA = a.rating || 0; valB = b.rating || 0; break;
        case 'myScore': valA = a.myScore || 0; valB = b.myScore || 0; break;
      }
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return type === 'rating' ? a.title.localeCompare(b.title) : b.rating - a.rating;
    });
  }
  if (type === 'added' && dir === -1) list.reverse();

  if (!state.library.length) {
    libSearch.style.display = `none`;
    sortType.style.display = `none`;
    sortDirBtn.style.display = `none`;
    filterToggle.style.display = `none`;
    filterPanel.style.display = `none`;
    libEl.innerHTML = `<div class="empty">Your library is empty. Click on the "Add Movie" Button to add a movie!</div>`;
    return;
  }else {filterToggle.style.display = `block`;}

  if (state.library.length > 1) {
    libSearch.style.display = `block`;
    sortType.style.display = `block`;
    sortDirBtn.style.display = `block`;
  }else {
    libSearch.style.display = `none`;
    sortType.style.display = `none`;
    sortDirBtn.style.display = `none`;
  }
  
  if (list.length === 0) {
    libEl.innerHTML = `<div class="empty" style="font-size:1.2rem">No movies match your filters.</div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';

  list.forEach(m => {
    const c = document.createElement('div');
    c.className = 'card';
    const reviewGiven = (!m.personalReview ? 'Pending' : 'Given');
    
    const genreNames = (m.genreIds || []).slice(0, 2).map(id => GENRES[id]).filter(Boolean).join(', ');

    c.innerHTML = `
          <button class="menu-btn">⋮</button>
          <div class="menu">
            <button class="view">View details</button>
            <button class="remove">Remove</button>
          </div>
          <img alt="Image Unavailable" src="${m.poster ? IMG+m.poster : ''}">
          <div class="p">
            <h3>${m.title}</h3>
            <div style="font-size:0.75rem; color:#9aa0b4; margin-bottom:6px;">${genreNames}</div>
            <span class="muted">TMDB ${m.rating?.toFixed?.(1) ?? '—'}</span>
            <div class="rating-control">
              <button class="rate-btn minus">-</button>
              <input class="rating-value" type="number" min="0" max="10" step="0.1" value="${m.myScore.toFixed(1)}">
              <button class="rate-btn plus">+</button>
            </div>
            <div class="review-btn">Your Review (${reviewGiven})</div>
          </div>
    `;
    
    const menu = c.querySelector('.menu');
    c.querySelector('.menu-btn').onclick = e => {
      e.stopPropagation(); 
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      menu.style.display === `block` ? c.querySelector('.menu-btn').style.background = `#000` : c.querySelector('.menu-btn').style.background = `#00000050`;
    };
    c.querySelector('.view').onclick = () => showDetails(m);
    c.querySelector('.remove').onclick = () => {
      state.library = state.library.filter(x => x.id !== m.id);
      saveData();
      renderLibrary();
    };
    
    c.querySelector('.review-btn').onclick = (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        openReviewModal(m);
    };

    const valueEl = c.querySelector('.rating-value');
    const plusBtn = c.querySelector('.plus');
    const minusBtn = c.querySelector('.minus');

    const updateRating = (delta) => {
        m.myScore = Math.min(10, Math.max(0, +(m.myScore + delta).toFixed(1)));
        valueEl.value = m.myScore.toFixed(1);
    };
    
    valueEl.addEventListener('blur', () => {
        let v = parseFloat(valueEl.value);
        if (isNaN(v)) m.myScore = 0;
        m.myScore = Math.min(10, Math.max(0, v));
        valueEl.value = m.myScore.toFixed(1);
        saveData();
    });

    let holdTimeout, holdInterval;
    const startHold = (delta) => {
        updateRating(delta);
        holdTimeout = setTimeout(() => {
            holdInterval = setInterval(() => updateRating(delta), 80);
        }, 400);
    };
    const stopHold = () => { 
      if (holdTimeout || holdInterval) {
        clearTimeout(holdTimeout); 
        clearInterval(holdInterval);
        saveData();
      }
    };
    
    const handleStart = (e, delta) => { if (e.cancelable) e.preventDefault(); startHold(delta); };

    plusBtn.addEventListener('mousedown', (e) => handleStart(e, 0.1));
    minusBtn.addEventListener('mousedown', (e) => handleStart(e, -0.1));
    plusBtn.addEventListener('touchstart', (e) => handleStart(e, 0.1), { passive: false });
    minusBtn.addEventListener('touchstart', (e) => handleStart(e, -0.1), { passive: false });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
        plusBtn.addEventListener(evt, stopHold);
        minusBtn.addEventListener(evt, stopHold);
    });
    plusBtn.addEventListener('click', () => { updateRating(0.1); saveData(); });
    minusBtn.addEventListener('click', () => { updateRating(-0.1); saveData(); });

    grid.appendChild(c);
  });

  libEl.appendChild(grid);
}

libSearch.addEventListener('input', renderLibrary);
sortType.addEventListener('change', () => {
  saveData();
  renderLibrary();
});

sortDirBtn.onclick = () => {
  const current = sortDirBtn.dataset.dir;
  if (current === 'asc') {
    sortDirBtn.dataset.dir = 'desc';
    sortDirBtn.innerHTML = '&#8595';
  } else {
    sortDirBtn.dataset.dir = 'asc';
    sortDirBtn.innerHTML = '&#8593';
  }
  saveData();
  renderLibrary();
};

function renderResults(list) {
  list.forEach(m => {
    const r = document.createElement('div');
    r.className = 'result';

    r.innerHTML = `
      <button class="menu-btn">⋮</button>
      <div class="menu">
        <button class="view">View details</button>
      </div>
      <img alt="Image Unavailable" src="${m.poster ? IMG+m.poster : ''}">
      <div class="p">
        <div class="muted">${m.rating?.toFixed?.(1) ?? '—'}</div>
        <strong>${m.title}</strong>
        <div style="margin-top:6px"><button class="add-btn">Add</button></div>
      </div>
    `;

    const menu = r.querySelector('.menu');
    r.querySelector('.menu-btn').onclick = e => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    };

    r.querySelector('.view').onclick = () => showDetails(m);
    r.querySelector('.add-btn').onclick = () => {
      if (!state.library.some(x => x.id === m.id)) {
        state.library.push({ ...m,
          myScore: 0,
          personalReview: ''
        });
        saveData();
        renderLibrary();
      }
      closeModal();
    };

    resultsEl.appendChild(r);
  });
}

async function performSearch() {
  const q = queryInput.value.trim();
  const type = typeSelect.value;

  resultsEl.innerHTML = '';
  statusEl.textContent = 'Loading…';
  loadMoreBtn.style.display = 'none';

  searchState.query = q;
  searchState.type = type;
  searchState.page = 1;
  searchState.personId = null;
  searchState.cachedMovies = [];

  try {
    if (!q) {
      const randomPage = Math.floor(Math.random() * 50) + 1;

      const d = await api.discoverMovies(randomPage);

      const list = d.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids || []
      }));

      statusEl.textContent = 'Discovered random movies for you';
      renderResults(list);
      return;
    }
    if (type === 'movie') {
      const d = await api.searchMovie(q, 1);
      searchState.totalPages = d.total_pages;
      
      const list = d.results.map(m => ({
        id: m.id,
        title: m.title,
        poster: m.poster_path,
        rating: m.vote_average,
        releaseDate: m.release_date,
        genreIds: m.genre_ids || []
      }));

      searchState.cachedMovies = list;
      statusEl.textContent = list.length ? '' : 'No results found';
      renderResults(list);

      if (searchState.page < searchState.totalPages) {
        loadMoreBtn.style.display = 'block';
      }
    } else {
      const p = await api.searchPerson(q);
      if (!p.results.length) throw new Error('No person found');
      
      renderPeopleResults(p.results);
      statusEl.textContent = `Select a ${type} to see their movies:`;
    }
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

function renderPeopleResults(list) {
  resultsEl.innerHTML = '';
  
  list.forEach(p => {
    const imgUrl = p.profile_path ? IMG + p.profile_path : '';
    
    const r = document.createElement('div');
    r.className = 'result';
    
    r.innerHTML = `
      <img alt="Image Unavailable" src="${imgUrl}" style="height: 260px; object-fit: cover; background: #222;">
      <div class="p">
        <strong>${p.name}</strong>
        <div class="muted">${p.known_for_department || 'Unknown'}</div>
        <div style="margin-top:6px">
            <button class="view-credits-btn">View Movies</button>
        </div>
      </div>
    `;

    r.querySelector('.view-credits-btn').onclick = () => {
        fetchPersonCredits(p.id, p.name);
    };

    resultsEl.appendChild(r);
  });
}

async function fetchPersonCredits(personId, personName) {
  statusEl.textContent = `Loading movies for ${personName}…`;
  resultsEl.innerHTML = '';
  
  try {
    const credits = await api.credits(personId);
    let movies = [];
    const type = typeSelect.value;

    if (type === 'actor') {
        movies = credits.cast;
    } else if (type === 'director') {
        movies = credits.crew.filter(m => m.job === 'Director');
    } else if (type === 'producer') {
        movies = credits.crew.filter(m => m.job === 'Producer');
    }

    const map = new Map();
    movies.forEach(m => {
      if (!map.has(m.id)) {
        map.set(m.id, {
          id: m.id,
          title: m.title,
          poster: m.poster_path,
          rating: m.vote_average,
          releaseDate: m.release_date,
          genreIds: m.genre_ids || []
        });
      }
    });

    const list = [...map.values()];

    searchState.cachedMovies = list;
    searchState.personId = personId;
    
    if (list.length === 0) {
        statusEl.textContent = `No movies found for ${personName} as ${type}.`;
    } else {
        statusEl.textContent = `Showing ${list.length} movies for ${personName}`;
        renderResults(list);
    }
    
    loadMoreBtn.style.display = 'none';

  } catch (e) {
    statusEl.textContent = 'Error loading movies.';
    console.error(e);
  }
}

async function loadMore() {
  if (searchState.type !== 'movie') return;

  searchState.page++;
  const d = await api.searchMovie(searchState.query, searchState.page);

  const list = d.results.map(m => ({
    id: m.id,
    title: m.title,
    poster: m.poster_path,
    rating: m.vote_average,
    releaseDate: m.release_date,
    genreIds: m.genre_ids || []
  }));

  renderResults(list);

  if (searchState.page >= d.total_pages) {
    loadMoreBtn.style.display = 'none';
  }
}

function openModal() {
  overlay.classList.add('open');
  loadMoreBtn.style.display = 'none';
}

function closeModal() {
  overlay.classList.remove('open');
  resultsEl.innerHTML = '';
  statusEl.textContent = '';
  queryInput.value = '';
  typeSelect.value = 'movie';
}

const heading = document.getElementById('heading');
document.getElementById('addBtn').onclick = openModal;
document.getElementById('closeBtn').onclick = closeModal;
document.getElementById('searchBtn').onclick = performSearch;
document.getElementById('detailsClose').onclick = () => detailsOverlay.classList.remove('open');
loadMoreBtn.onclick = loadMore;

queryInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    performSearch();
  }
});

document.addEventListener('click', () => {
  document.querySelectorAll('.menu').forEach(m => m.style.display = 'none');
});

heading.style.cursor = 'pointer';

heading.onclick = () => window.scrollTo({
  top: 0,
  behavior: 'smooth'
});

renderLibrary();