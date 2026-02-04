const TMDB_KEY = '158b14d2caddf15a72691e1617061d51';
    const TMDB = 'https://api.themoviedb.org/3';
    const IMG = 'https://image.tmdb.org/t/p/w342';

    const state = {
      library: []
    };
    const searchState = {
      query: '',
      type: 'movie',
      page: 1,
      totalPages: 1,
      personId: null,
      cachedMovies: []
    };

    async function fetchJSON(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Network error');
      return r.json();
    }

    const api = {
      searchMovie: (q, page = 1) =>
        fetchJSON(`${TMDB}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=${page}`),

      searchPerson: (q) =>
        fetchJSON(`${TMDB}/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}`),

      credits: (id) =>
        fetchJSON(`${TMDB}/person/${id}/movie_credits?api_key=${TMDB_KEY}`),

      movieDetails: (id) =>
        fetchJSON(`${TMDB}/movie/${id}?api_key=${TMDB_KEY}`),

      movieCredits: (id) =>
        fetchJSON(`${TMDB}/movie/${id}/credits?api_key=${TMDB_KEY}`)
    };

    const libEl = document.getElementById('library');
    const overlay = document.getElementById('overlay');
    const resultsEl = document.getElementById('results');
    const statusEl = document.getElementById('status');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const queryInput = document.getElementById('query');
    const typeSelect = document.getElementById('type');

    const detailsOverlay = document.getElementById('detailsOverlay');
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsBody = document.getElementById('detailsBody');

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
            </div>
          </div>
        `;
      } catch (err) {
        detailsBody.innerHTML = '<p class="muted">Failed to load movie details.</p>';
      }
    }

    function renderLibrary() {
      libEl.innerHTML = '';
      if (!state.library.length) {
        libEl.innerHTML = `<div class="empty">Your library is empty. Click on the "Add Movie" Button to add a movie!<br><br>आपकी लाइब्रेरी ख़ाली है। इसमें फ़िल्म शामिल करने हेतु "Add Movie" का बटन दबाएँ!</div>`;
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'grid';

      state.library.forEach(m => {
        const c = document.createElement('div');
        c.className = 'card';

        c.innerHTML = `
          <button class="menu-btn">⋮</button>
          <div class="menu">
            <button class="view">View details</button>
            <button class="remove">Remove</button>
          </div>
          <img src="${m.poster ? IMG+m.poster : ''}">
          <div class="p">
            <h3>${m.title}</h3>
            <div class="ratings">
              <span class="muted">TMDB ${m.rating?.toFixed?.(1) ?? '—'}</span>
              <div class="rating-control">
                <button class="rate-btn minus">-</button>
                <span class="rating-value">${m.myScore.toFixed(1)}</span>
                <button class="rate-btn plus">+</button>
              </div>
            </div>
          </div>
        `;

        const menu = c.querySelector('.menu');
        c.querySelector('.menu-btn').onclick = e => {
          e.stopPropagation();
          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        };

        c.querySelector('.view').onclick = () => showDetails(m);
        c.querySelector('.remove').onclick = () => {
          state.library = state.library.filter(x => x.id !== m.id);
          renderLibrary();
        };

        const valueEl = c.querySelector('.rating-value');
        const plusBtn = c.querySelector('.plus');
        const minusBtn = c.querySelector('.minus');

        const updateRating = (delta) => {
          m.myScore = Math.min(10, Math.max(0, +(m.myScore + delta).toFixed(1)));
          valueEl.textContent = m.myScore.toFixed(1);
        };

        let holdTimeout = null;
        let holdInterval = null;

        const HOLD_DELAY = 400;
        const HOLD_SPEED = 80;

        const startHold = (delta) => {
          updateRating(delta);
          holdTimeout = setTimeout(() => {
            holdInterval = setInterval(() => updateRating(delta), HOLD_SPEED);
          }, HOLD_DELAY);
        };

        const stopHold = () => {
          clearTimeout(holdTimeout);
          clearInterval(holdInterval);
          holdTimeout = holdInterval = null;
        };

        const handleStart = (e, delta) => {
          if (e.cancelable) e.preventDefault();
          startHold(delta);
        };

        plusBtn.addEventListener('mousedown', (e) => handleStart(e, 0.1));
        minusBtn.addEventListener('mousedown', (e) => handleStart(e, -0.1));

        plusBtn.addEventListener('touchstart', (e) => handleStart(e, 0.1), { passive: false });
        minusBtn.addEventListener('touchstart', (e) => handleStart(e, -0.1), { passive: false });

        ['mouseup', 'mouseleave', 'touchend', 'touchcancel']
        .forEach(evt => {
          plusBtn.addEventListener(evt, stopHold);
          minusBtn.addEventListener(evt, stopHold);
        });

        grid.appendChild(c);
      });

      libEl.appendChild(grid);
    }

    function renderResults(list) {
      list.forEach(m => {
        const r = document.createElement('div');
        r.className = 'result';

        r.innerHTML = `
          <button class="menu-btn">⋮</button>
          <div class="menu">
            <button class="view">View details</button>
          </div>
          <img src="${m.poster ? IMG+m.poster : ''}">
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
              myScore: 0
            });
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
      if (!q) return;

      resultsEl.innerHTML = '';
      statusEl.textContent = 'Loading…';
      loadMoreBtn.style.display = 'none';

      searchState.query = q;
      searchState.type = type;
      searchState.page = 1;
      searchState.personId = null;
      searchState.cachedMovies = [];

      try {
        let movies = [];

        if (type === 'movie') {
          const d = await api.searchMovie(q, 1);
          searchState.totalPages = d.total_pages;
          movies = d.results;
        } else {
          const p = await api.searchPerson(q);
          if (!p.results.length) throw new Error('No person found');
          const personId = p.results[0].id;
          searchState.personId = personId;
          const credits = await api.credits(personId);

          if (type === 'actor') movies = credits.cast;
          if (type === 'director') movies = credits.crew.filter(m => m.job === 'Director');
          if (type === 'producer') movies = credits.crew.filter(m => m.job === 'Producer');

          searchState.totalPages = 1;
        }

        const map = new Map();
        movies.forEach(m => {
          map.set(m.id, {
            id: m.id,
            title: m.title,
            poster: m.poster_path,
            rating: m.vote_average
          });
        });

        const list = [...map.values()];
        searchState.cachedMovies = list;

        statusEl.textContent = list.length ? '' : 'No results found';
        renderResults(list);

        if (type === 'movie' && searchState.page < searchState.totalPages) {
          loadMoreBtn.style.display = 'block';
        }
      } catch (e) {
        statusEl.textContent = e.message;
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
        rating: m.vote_average
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

    renderLibrary();