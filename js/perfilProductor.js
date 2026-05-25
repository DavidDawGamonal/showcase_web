const urlApi = CONFIG.API_URL;

/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Inicializa los iconos Feather, muestra los datos del usuario logado en el navbar
 * y llama a las funciones de carga de datos de la página.
 */
document.addEventListener("DOMContentLoaded", () => {
  feather.replace();
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuario) {
    let divLogado = document.getElementById("divUsuario");
    divLogado.hidden = false;
    let spanNombre = document.getElementById("spanNombre");
    let spanRol = document.getElementById("spanRol");
    spanNombre.innerHTML = `Usuario: ${usuario.email}`;
    spanRol.innerHTML = `Rol: ${usuario.rol}`;
  }
  estadisticas();
  perfilProductor();
  cargarMisInstrumentales();
  cargarMisFavoritos();
  cargarMisDescargas();
  cargarMisPlaylists();
});

// Variables globales para controlar el audio activo en "Mis instrumentales"
let audioInstrumentalActual = null;
let btnInstrumentalActual = null;

/**
 * Carga y renderiza los tracks del productor logado en la sección "Mis instrumentales".
 * Llama a GET /tracks/getListadoTracks?idUsuario={id} filtrando por el productor logado.
 * Por defecto muestra los 5 primeros. toggleInstrumentales() para expandir/replegar.
 * Al hacer click en el track navega al reproductor — excepto si se pulsa el botón de play.
 * @param {number|null} limite - Número máximo de instrumentales a mostrar. null para mostrar todas.
 */
async function cargarMisInstrumentales(limite = 5) {
  const contenedor = document.getElementById("mis-instrumentales");
  if (contenedor) {
    contenedor.innerHTML = "";
  }
  try {
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) {
      if (contenedor) contenedor.innerHTML = "<p>No hay usuario logado</p>";
      return;
    }
    let filtro = new URLSearchParams({ idUsuario: usuarioLogado.idUsuario });
    const res = await fetch(`${urlApi}tracks/getListadoTracks?${filtro}`);
    const tracks = await res.json();

    if (!tracks.length) {
      contenedor.innerHTML = "<p>Aún no has subido ninguna instrumental.</p>";
      return;
    }

    const tracksMostrados = limite ? tracks.slice(0, limite) : tracks;

    tracksMostrados.forEach((track, index) => {
      const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;
      const duracion = track.duracion ?? "--:--:--";

      const div = document.createElement("div");
      div.className = "track-item-popular";
      div.style.cursor = "pointer";
      div.addEventListener("click", (e) => {
        if (e.target.closest(".btn-play-sm")) return;
        window.location.href = `reproductor.html?id=${track.idTrack}`;
      });
      div.innerHTML = `
        <span class="track-rank-popular">#${index + 1}</span>
        <img src="${urlPortada}" alt="portada"
             style="width:38px;height:38px;object-fit:cover;border-radius:4px;flex-shrink:0;">
        <div class="track-info">
          <div class="track-nombre">${track.titulo}</div>
          <div class="track-meta-row">
            <span class="track-genero">${track.genero ?? ""}</span>
          </div>
        </div>
        <div class="pop-meta">
          <button class="btn-play-sm" title="Reproducir" onclick="togglePlayInstrumental(this)">
            <svg class="icono-play" width="10" height="12" viewBox="0 0 12 14" fill="white">
              <path d="M1 1l10 6L1 13V1z"/>
            </svg>
            <svg class="icono-pausa" width="10" height="12" viewBox="0 0 12 14" fill="white" style="display:none">
              <path d="M2 1h3v12H2zm5 0h3v12H7z"/>
            </svg>
          </button>
          <audio src="${urlAudio}" preload="none"></audio>
          <span class="pop-likes">
            <svg width="12" height="11" viewBox="0 0 24 22" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${track.likes}
          </span>
          <span class="pop-dur">${duracion}</span>
        </div>`;
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error cargando mis instrumentales:", e);
  }
}

/**
 * Controla el play/pausa de los tracks de "Mis instrumentales".
 * Solo puede sonar un track a la vez — si hay otro sonando lo para antes.
 * @param {HTMLElement} btn - El botón de play pulsado
 */
function togglePlayInstrumental(btn) {
  const trackItem = btn.closest(".track-item-popular");
  const audio = trackItem.querySelector("audio");
  const iconoPlay = btn.querySelector(".icono-play");
  const iconoPausa = btn.querySelector(".icono-pausa");

  // Si hay otro track sonando y es distinto al actual, lo paramos y reseteamos su botón
  if (audioInstrumentalActual && audioInstrumentalActual !== audio) {
    audioInstrumentalActual.pause();
    audioInstrumentalActual.currentTime = 0;
    btnInstrumentalActual.querySelector(".icono-play").style.display = "block";
    btnInstrumentalActual.querySelector(".icono-pausa").style.display = "none";
  }

  if (audio.paused) {
    audio.play();
    iconoPlay.style.display = "none";
    iconoPausa.style.display = "block";
    audioInstrumentalActual = audio;
    btnInstrumentalActual = btn;
  } else {
    audio.pause();
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioInstrumentalActual = null;
    btnInstrumentalActual = null;
  }

  audio.onended = () => {
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioInstrumentalActual = null;
    btnInstrumentalActual = null;
  };
}

/**
 * Alterna entre mostrar todas las instrumentales y mostrar solo las 5 primeras.
 * Cambia el texto del botón según el estado actual.
 */
function toggleInstrumentales() {
  const btn = document.getElementById("btnVerInstrumentales");
  if (btn.textContent.trim() === "Ver todas →") {
    cargarMisInstrumentales(null);
    btn.textContent = "Ver menos ↑";
  } else {
    cargarMisInstrumentales(5);
    btn.textContent = "Ver todas →";
  }
}

/**
 * Carga y renderiza la tarjeta de información del productor logado.
 * Muestra nombre, email y fecha de alta. Lee los datos del localStorage.
 * Si no hay usuario logado no renderiza nada.
 */
async function perfilProductor() {
  const contenedor = document.getElementById("perfil-productor");
  // Limpiamos el contenedor antes de renderizar para evitar duplicados
  if (contenedor) {
    contenedor.innerHTML = "";
  }
  try {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (usuario && contenedor) {
      const nombre = usuario.nombre;
      const email = usuario.email;
      // Formateamos la fecha de alta al formato español dd/mm/aaaa
      const miembro = new Date(usuario.fecAlta).toLocaleDateString("es-ES");

      contenedor.innerHTML = `
        <div class="perfil-nombre">${nombre}</div>
        <div class="perfil-email">${email}</div>
        <div class="perfil-miembro">
          <!-- Icono de reloj para indicar antigüedad -->
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          miembro desde ${miembro}
        </div>`;
    }
  } catch (e) {
    console.error("Error cargando datos del productor:", e);
  }
}

/*
prueba a hacerlo con objeto para hacer una sola llamada
*/

/**
 * Carga y renderiza las estadísticas globales del productor logado.
 * Hace cuatro llamadas en paralelo con Promise.all para obtener:
 * likes recibidos, comentarios recibidos, tracks subidos y reproducciones totales.
 * Los seguidores muestran "--" hasta que se implemente esa funcionalidad.
 */
async function estadisticas() {
  const contenedor = document.getElementById("estadisticas");
  // Limpiamos el contenedor antes de renderizar para evitar duplicados
  if (contenedor) {
    contenedor.innerHTML = "";
  }
  try {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    const idUsuario = usuario.idUsuario;

    // Lanzamos las cuatro peticiones en paralelo para no esperar una por una
    /*Hacer un DTO cuando crezcan las estadísicas*/
    const [
      resLikes,
      resComentarios,
      resTracks,
      resReproducciones,
      resDescargas,
    ] = await Promise.all([
      fetch(`${urlApi}likes/contarLikesByProductor?idUsuario=${idUsuario}`),
      fetch(
        `${urlApi}comentarios/contarComentariosByProductor?idUsuario=${idUsuario}`,
      ),
      fetch(`${urlApi}tracks/contarTracksByProductor?idUsuario=${idUsuario}`),
      fetch(
        `${urlApi}tracks/sumReproduccionesByProductor?idUsuario=${idUsuario}`,
      ),
      fetch(`${urlApi}descargas/contarByUsuario?idUsuario=${idUsuario}`),
    ]);

    const tracks = await resTracks.json();
    const likes = await resLikes.json();
    const comentarios = await resComentarios.json();
    const reproducciones = await resReproducciones.json();
    const descargas = await resDescargas.json();

    contenedor.innerHTML = `
      <div class="stat-item">
        <span class="stat-icon">🎵</span>
        <div class="stat-numero">${tracks}</div>
        <div class="stat-label">Subidas</div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">⬇️</span>
        <div class="stat-numero">${descargas}</div>
        <div class="stat-label">Descargas</div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">👥</span>
        <div class="stat-numero">--</div>
        <div class="stat-label">Seguidores</div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">❤️</span>
        <div class="stat-numero">${likes}</div>
        <div class="stat-label">Likes</div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">💬</span>
        <div class="stat-numero">${comentarios}</div>
        <div class="stat-label">Comentarios</div>
      </div>
      <div class="stat-item">
        <span class="stat-icon">▶️</span>
        <div class="stat-numero">${reproducciones}</div>
        <div class="stat-label">Reproducciones</div>
      </div>`;
  } catch (e) {
    console.error("Error cargando las estadísticas:", e);
  }
}

// ======================================================
// MIS FAVORITOS
// ======================================================

/**
 * Carga y renderiza los tracks favoritos del productor logado.
 * Por defecto muestra solo los 5 más recientes. Al pasar limite=null muestra todos.
 * Llama a GET /likes/favoritos?idUsuario={id} que devuelve List<FavoritoData>.
 * fechaLike viene como string ISO desde Jackson — se parsea con new Date().
 * @param {number|null} limite - Número máximo de favoritos a mostrar. null para mostrar todos.
 */
async function cargarMisFavoritos(limite = 5) {
  const contenedor = document.getElementById("track-list-favoritos");
  // Limpiamos el contenedor antes de renderizar para evitar duplicados
  if (contenedor) {
    contenedor.innerHTML = "";
  }

  try {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuario) {
      if (contenedor) contenedor.innerHTML = "<p>No hay usuario logado</p>";
      return;
    }

    const res = await fetch(
      `${urlApi}tracks/favoritos?idUsuario=${usuario.idUsuario}`,
    );
    const tracks = await res.json();

    // Si no hay favoritos mostramos un mensaje informativo
    if (!tracks.length) {
      contenedor.innerHTML = "<p>Aún no tienes favoritos.</p>";
      return;
    }

    // Si limite es null mostramos todos, si no solo los primeros N
    const tracksMostrados = limite ? tracks.slice(0, limite) : tracks;

    // Creamos un track-item por cada FavoritoData recibido del backend
    tracksMostrados.forEach((track, index) => {
      const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;

      // Formateamos la fecha con dos dígitos en día y mes — ej: 05/05/2026
      const fechaFormateada = new Date(track.fechaLike).toLocaleDateString(
        "es-ES",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
      );

      const div = document.createElement("div");
      div.className = "track-item";
      div.style.cursor = "pointer";
      div.addEventListener("click", (e) => {
        // Si el click fue en el botón de play o dentro de él, no navegamos
        if (e.target.closest(".btn-play-sm")) return;
        window.location.href = `reproductor.html?id=${track.idTrack}`;
      });
      div.innerHTML = `
        <span class="track-num">#${index + 1}</span>
        <div class="track-info">
          <div class="track-nombre">${track.titulo}</div>
          <div class="track-productor">prod. ${track.nombreProductor}</div>
        </div>
        <div class="track-meta">
          <button class="btn-play-sm" onclick="togglePlayFav(this)">
            <svg class="icono-play" width="10" height="12" viewBox="0 0 12 14" fill="white">
              <path d="M1 1l10 6L1 13V1z"/>
            </svg>
            <svg class="icono-pausa" width="10" height="12" viewBox="0 0 12 14" fill="white" style="display:none">
              <path d="M2 1h3v12H2zm5 0h3v12H7z"/>
            </svg>
          </button>
          <audio src="${urlAudio}" preload="none"></audio>
          <span class="track-meta-likes">
            <svg width="12" height="11" viewBox="0 0 24 22" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${track.likes}
          </span>
          <span class="track-duracion">${track.duracion ?? "--:--:--"}</span>
          <!-- Fecha en que el usuario añadió este track a favoritos -->
          <span class="track-fecha-like">${fechaFormateada}</span>
        </div>`;
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error cargando favoritos:", e);
  }
}

// Variables globales para controlar el audio activo en la lista de favoritos
let audioFavActual = null;
let btnFavActual = null;

/**
 * Controla el play/pausa de los tracks de la lista de favoritos.
 * Solo puede sonar un track a la vez — si hay otro sonando lo para antes.
 * @param {HTMLElement} btn - El botón de play pulsado
 */
function togglePlayFav(btn) {
  const trackItem = btn.closest(".track-item");
  // Cada track-item tiene su propio elemento <audio> con el src ya asignado
  const audio = trackItem.querySelector("audio");
  const iconoPlay = btn.querySelector(".icono-play");
  const iconoPausa = btn.querySelector(".icono-pausa");

  // Si hay otro track sonando y es distinto al actual, lo paramos y reseteamos su botón
  if (audioFavActual && audioFavActual !== audio) {
    audioFavActual.pause();
    audioFavActual.currentTime = 0;
    btnFavActual.querySelector(".icono-play").style.display = "block";
    btnFavActual.querySelector(".icono-pausa").style.display = "none";
  }

  if (audio.paused) {
    audio.play();
    iconoPlay.style.display = "none";
    iconoPausa.style.display = "block";
    // Guardamos referencias al audio y botón activos para poder pararlos después
    audioFavActual = audio;
    btnFavActual = btn;
  } else {
    audio.pause();
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioFavActual = null;
    btnFavActual = null;
  }

  // Cuando el track termina reseteamos el icono y las referencias globales
  audio.onended = () => {
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioFavActual = null;
    btnFavActual = null;
  };
}

/**
 * Alterna entre mostrar todos los favoritos y mostrar solo los 5 primeros.
 * Cambia el texto del botón según el estado actual.
 */
function toggleFavoritos() {
  const btn = document.getElementById("btnVerFavoritos");
  if (btn.textContent.trim() === "Ver todas →") {
    cargarMisFavoritos(null);
    btn.textContent = "Ver menos ↑";
  } else {
    cargarMisFavoritos(5);
    btn.textContent = "Ver todas →";
  }
}

// ======================================================
// MIS DESCARGAS
// ======================================================

/**
 * Carga y renderiza el historial de descargas del productor logado.
 * Por defecto muestra solo las 5 más recientes. Al pasar limite=null muestra todas.
 * Llama a GET /descargas/historial?idUsuario={id} que devuelve List<DescargaData>.
 * fechaDescarga viene como string ISO desde Jackson — se parsea con new Date().
 * @param {number|null} limite - Número máximo de descargas a mostrar. null para mostrar todas.
 */
async function cargarMisDescargas(limite = 5) {
  const contenedor = document.getElementById("track-list-descargas");
  // Limpiamos el contenedor antes de renderizar para evitar duplicados
  if (contenedor) {
    contenedor.innerHTML = "";
  }

  try {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuario) {
      if (contenedor) contenedor.innerHTML = "<p>No hay usuario logado</p>";
      return;
    }

    const res = await fetch(
      `${urlApi}descargas/historial?idUsuario=${usuario.idUsuario}`,
    );
    const descargas = await res.json();

    // Si no hay descargas mostramos un mensaje informativo
    if (!descargas.length) {
      contenedor.innerHTML = "<p>Aún no has descargado ningún track.</p>";
      return;
    }

    // Si limite es null mostramos todas, si no solo las primeras N
    const descargasMostradas = limite ? descargas.slice(0, limite) : descargas;

    // Creamos un track-item por cada DescargaData recibido del backend
    descargasMostradas.forEach((descarga, index) => {
      const urlPortada = `${urlApi}tracks/getPortada/${descarga.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${descarga.idTrack}`;
      const fechaFormateada = new Date(
        descarga.fechaDescarga,
      ).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const div = document.createElement("div");
      div.className = "track-item";
      div.style.cursor = "pointer";
      div.addEventListener("click", (e) => {
        // Si el click fue en el botón de play o dentro de él, no navegamos
        if (e.target.closest(".btn-play-sm")) return;
        window.location.href = `reproductor.html?id=${descarga.idTrack}`;
      });
      div.innerHTML = `
        <span class="track-num">#${index + 1}</span>
        <div class="track-info">
          <div class="track-nombre">${descarga.titulo}</div>
          <div class="track-productor">prod. ${descarga.nombreProductor}</div>
        </div>
        <div class="track-meta">
          <button class="btn-play-sm" onclick="togglePlayDescarga(this)">
            <svg class="icono-play" width="10" height="12" viewBox="0 0 12 14" fill="white">
              <path d="M1 1l10 6L1 13V1z"/>
            </svg>
            <svg class="icono-pausa" width="10" height="12" viewBox="0 0 12 14" fill="white" style="display:none">
              <path d="M2 1h3v12H2zm5 0h3v12H7z"/>
            </svg>
          </button>
          <audio src="${urlAudio}" preload="none"></audio>
          <span class="track-meta-likes">
            <svg width="12" height="11" viewBox="0 0 24 22" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${descarga.likes}
          </span>
          <span class="track-duracion">${descarga.duracion ?? "--:--:--"}</span>
          <!-- Fecha en que el usuario descargó este track -->
          <span class="track-fecha-like">${fechaFormateada}</span>
        </div>`;
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error cargando descargas:", e);
  }
}

// Variables globales para controlar el audio activo en la lista de descargas
let audioDescargaActual = null;
let btnDescargaActual = null;

/**
 * Controla el play/pausa de los tracks de la lista de descargas.
 * Solo puede sonar un track a la vez — si hay otro sonando lo para antes.
 * @param {HTMLElement} btn - El botón de play pulsado
 */
function togglePlayDescarga(btn) {
  const trackItem = btn.closest(".track-item");
  const audio = trackItem.querySelector("audio");
  const iconoPlay = btn.querySelector(".icono-play");
  const iconoPausa = btn.querySelector(".icono-pausa");

  // Si hay otro track sonando y es distinto al actual, lo paramos y reseteamos su botón
  if (audioDescargaActual && audioDescargaActual !== audio) {
    audioDescargaActual.pause();
    audioDescargaActual.currentTime = 0;
    btnDescargaActual.querySelector(".icono-play").style.display = "block";
    btnDescargaActual.querySelector(".icono-pausa").style.display = "none";
  }

  if (audio.paused) {
    audio.play();
    iconoPlay.style.display = "none";
    iconoPausa.style.display = "block";
    audioDescargaActual = audio;
    btnDescargaActual = btn;
  } else {
    audio.pause();
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioDescargaActual = null;
    btnDescargaActual = null;
  }

  // Cuando el track termina reseteamos el icono y las referencias globales
  audio.onended = () => {
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioDescargaActual = null;
    btnDescargaActual = null;
  };
}

/**
 * Alterna entre mostrar todas las descargas y mostrar solo las 5 primeras.
 * Cambia el texto del botón según el estado actual.
 */
function toggleDescargas() {
  const btn = document.getElementById("btnVerDescargas");
  if (btn.textContent.trim() === "Ver todas →") {
    cargarMisDescargas(null);
    btn.textContent = "Ver menos ↑";
  } else {
    cargarMisDescargas(5);
    btn.textContent = "Ver todas →";
  }
}

// ======================================================
// MIS PLAYLISTS
// ======================================================

/**
 * Carga y renderiza las playlists del productor logado.
 * Por defecto muestra solo las 5 más recientes. Al pasar limite=null muestra todas.
 * Llama a GET /playlists/byUsuario?idUsuario={id} que devuelve List<PlaylistData>.
 * Cada playlist muestra nombre, número de tracks, fecha de creación,
 * botón para expandir los tracks, botón para reproducir y botón para eliminar.
 * @param {number|null} limite - Número máximo de playlists a mostrar. null para mostrar todas.
 */
async function cargarMisPlaylists(limite = 5) {
  const contenedor = document.getElementById("lista-playlists-perfil");
  if (contenedor) {
    contenedor.innerHTML = "";
  }

  try {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuario) {
      if (contenedor) contenedor.innerHTML = "<p>No hay usuario logado</p>";
      return;
    }

    const res = await fetch(
      `${urlApi}playlists/byUsuario?idUsuario=${usuario.idUsuario}`,
    );
    const playlists = await res.json();

    if (!playlists.length) {
      contenedor.innerHTML = "<p>Aún no tienes playlists.</p>";
      return;
    }

    // Si limite es null mostramos todas, si no solo las primeras N
    const playlistsMostradas = limite ? playlists.slice(0, limite) : playlists;

    playlistsMostradas.forEach((playlist) => {
      const fechaFormateada = new Date(playlist.fecCreacion).toLocaleDateString(
        "es-ES",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        },
      );

      const div = document.createElement("div");
      div.className = "playlist-item";
      div.innerHTML = `
        <div class="playlist-item-header">
          <div class="playlist-item-info">
            <div class="playlist-item-nombre">${playlist.nombre}</div>
            <div class="playlist-item-meta">
              <span>${playlist.tracks.length} tracks</span>
              <span>${fechaFormateada}</span>
            </div>
          </div>
          <div class="playlist-item-acciones">
            <button class="playlist-item-btn" title="Ver tracks"
                    onclick="toggleTracksPlaylist(this, ${playlist.idPlaylist})">▾</button>
            <button class="playlist-item-btn reproducir" title="Reproducir"
                    onclick="reproducirPlaylist(${playlist.idPlaylist})">▶</button>
            <button class="playlist-item-btn eliminar" title="Eliminar"
                    onclick="eliminarPlaylist(${playlist.idPlaylist}, this)">✕</button>
          </div>
        </div>
        <!-- Tracks de la playlist — ocultos por defecto -->
        <div class="playlist-tracks" id="tracks-playlist-${playlist.idPlaylist}" hidden>
          ${
            playlist.tracks.length
              ? playlist.tracks
                  .map(
                    (t) => `
            <div class="playlist-track-item">
              <img src="${urlApi}tracks/getPortada/${t.portada}"
                   style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;">
              <div class="playlist-track-info">
                <div class="playlist-track-nombre">${t.titulo}</div>
                <div class="playlist-track-productor">prod. ${t.nombreProductor}</div>
              </div>
              <span class="playlist-track-duracion">${t.duracion ?? "--:--:--"}</span>
            </div>`,
                  )
                  .join("")
              : '<p class="playlist-vacia-msg">Esta playlist está vacía.</p>'
          }
        </div>
      `;
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error cargando playlists:", e);
  }
}

/**
 * Muestra u oculta los tracks de una playlist.
 * Rota la flecha del botón según el estado.
 * @param {HTMLElement} btn - El botón pulsado
 * @param {number} idPlaylist - ID de la playlist
 */
function toggleTracksPlaylist(btn, idPlaylist) {
  const tracksDiv = document.getElementById(`tracks-playlist-${idPlaylist}`);
  tracksDiv.hidden = !tracksDiv.hidden;
  // Rotamos la flecha según el estado
  btn.textContent = tracksDiv.hidden ? "▾" : "▴";
}

/**
 * Elimina una playlist y recarga la lista.
 * Pide confirmación antes de eliminar.
 * @param {number} idPlaylist - ID de la playlist a eliminar
 */
async function eliminarPlaylist(idPlaylist) {
  if (!confirm("¿Seguro que quieres eliminar esta playlist?")) return;

  try {
    await fetch(`${urlApi}playlists/eliminar?idPlaylist=${idPlaylist}`, {
      method: "DELETE",
    });
    // Recargamos la lista completa
    await cargarMisPlaylists();
  } catch (e) {
    console.error("Error eliminando playlist:", e);
  }
}

/**
 * Navega al reproductor cargando la playlist seleccionada.
 * Pasa idPlaylist como parámetro en la URL.
 * El click del botón ▶ en el perfil cuenta como interacción del usuario,
 * lo que permite al navegador reproducir audio automáticamente al llegar al reproductor.
 * @param {number} idPlaylist - ID de la playlist a reproducir
 */
function reproducirPlaylist(idPlaylist) {
  window.location.href = `reproductor.html?playlist=${idPlaylist}`;
}

/**
 * Alterna entre mostrar todas las playlists y mostrar solo las 5 primeras.
 * Cambia el texto del botón según el estado actual.
 */
function togglePlaylists() {
  const btn = document.getElementById("btnVerPlaylists");
  if (btn.textContent.trim() === "Ver todas →") {
    cargarMisPlaylists(null);
    btn.textContent = "Ver menos ↑";
  } else {
    cargarMisPlaylists(5);
    btn.textContent = "Ver todas →";
  }
}
