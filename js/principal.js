const urlApi = CONFIG.API_URL;

/**
 * Redirige al usuario a la página de login pasando el id del botón pulsado
 * como parámetro "accion" en la URL (ej: login.html?accion=iniciarSesion).
 * @param {HTMLElement} boton - El botón pulsado cuyo id indica la acción
 */
function redireccionLogin(boton) {
  window.location.href = "login.html?accion=" + boton.id;
}

// Variables globales para controlar el audio activo en el top 5 y las últimas subidas
let audioActual = null;
let btnPlayActual = null;

/**
 * Carga y renderiza el top 5 de tracks más populares de la plataforma.
 * Llama a GET /tracks/getListadoTracks con idUsuario=0 para obtener el top global.
 * Usa for...of en lugar de forEach para poder usar await dentro del bucle
 * y cargar el contador de comentarios de cada track.
 * Al pulsar el icono de comentarios navega al reproductor con scroll suave hasta la sección.
 */
async function cargarTop5() {
  const contenedor = document.getElementById("top5");
  try {
    // idUsuario=0 y genero=null indican que no filtramos — devuelve el top global
    let filtro = new URLSearchParams({ genero: null, idUsuario: 0 });
    const res = await fetch(`${urlApi}tracks/getListadoTracks?${filtro}`);
    const tracks = await res.json();

    // Limpiamos el contenedor antes de renderizar para evitar duplicados
    if (contenedor) {
      contenedor.innerHTML = "";
    }

    // for...of en lugar de forEach para poder usar await dentro del bucle
    for (const [index, track] of tracks.entries()) {
      const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;
      const duracion = track.duracion ? track.duracion : "--:--:--";
      const div = document.createElement("div");

      if (contenedor) {
        div.className = "track-item";
        div.style.cursor = "pointer";
        div.addEventListener("click", (e) => {
          // Si el click fue en el botón de play o dentro de él, no navegamos
          if (e.target.closest(".btn-play")) return;
          window.location.href = `reproductor.html?id=${track.idTrack}`;
        });
        div.innerHTML = `
          <span class="track-rank">#${index + 1}</span>
          <div class="track-info">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${urlPortada}" alt="portada"
                   style="width:38px;height:38px;object-fit:cover;border-radius:4px;flex-shrink:0;">
              <div>
                <span class="track-name">${track.titulo}</span>
                <span class="track-producer">prod. ${track.nombreProductor}</span>
              </div>
            </div>
          </div>
          <div class="track-meta">
            <button class="btn-play" title="Reproducir" onclick="togglePlay(this)">
              <svg class="icono-play" width="12" height="14" viewBox="0 0 12 14" fill="white">
                <path d="M1 1l10 6L1 13V1z"/>
              </svg>
              <svg class="icono-pausa" width="12" height="14" viewBox="0 0 12 14" fill="white" style="display:none">
                <path d="M2 1h3v12H2zm5 0h3v12H7z"/>
              </svg>
            </button>
            <audio src="${urlAudio}" preload="none"></audio>
            <span class="track-meta-item likes">
              <svg width="13" height="12" viewBox="0 0 24 22" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              ${track.likes}
            </span>
            <span class="track-meta-item" title="Comentarios" id="comentarios-${track.idTrack}"
                  style="cursor:pointer"
                  onclick="window.location.href='reproductor.html?id=${track.idTrack}&scroll=comentarios'">
              <svg width="13" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              --
            </span>
            <span class="track-meta-item">${duracion}</span>
          </div>`;
      }
      contenedor.appendChild(div);

      // Cargamos el contador de comentarios real para este track y actualizamos el span
      const resComentarios = await fetch(
        `${urlApi}comentarios/contarComentarios?idTrack=${track.idTrack}`,
      );
      const numComentarios = await resComentarios.json();
      document.getElementById(`comentarios-${track.idTrack}`).innerHTML = `
        <svg width="13" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        ${numComentarios}
      `;
    }
  } catch (e) {
    console.error("Error cargando Top 5:", e);
  }
}

/**
 * Controla el play/pausa de los tracks del top 5 y las últimas subidas.
 * Solo puede sonar un track a la vez — si hay otro sonando lo para antes.
 * Compatible con track-item (top 5) y card-nueva (últimas subidas) gracias al operador ??.
 * Actualiza audioActual y btnPlayActual para poder controlar el track activo desde fuera.
 * @param {HTMLElement} btn - El botón de play pulsado
 */
function togglePlay(btn) {
  // Busca el contenedor del track — puede ser track-item (top 5) o card-nueva (últimas subidas)
  const trackItem = btn.closest(".track-item") ?? btn.closest(".card-nueva");
  const audio = trackItem.querySelector("audio");
  const iconoPlay = btn.querySelector(".icono-play");
  const iconoPausa = btn.querySelector(".icono-pausa");

  // Si hay otro track sonando y es distinto al actual, lo paramos y reseteamos su botón
  if (audioActual && audioActual !== audio) {
    audioActual.pause();
    audioActual.currentTime = 0;
    btnPlayActual.querySelector(".icono-play").style.display = "block";
    btnPlayActual.querySelector(".icono-pausa").style.display = "none";
  }

  if (audio.paused) {
    audio.play();
    iconoPlay.style.display = "none";
    iconoPausa.style.display = "block";
    // Guardamos referencias al audio y botón activos para poder pararlos después
    audioActual = audio;
    btnPlayActual = btn;
  } else {
    audio.pause();
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioActual = null;
    btnPlayActual = null;
  }

  // Cuando el track termina reseteamos el icono y las referencias globales
  audio.onended = () => {
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioActual = null;
    btnPlayActual = null;
  };
}

/**
 * Busca tracks por título en el backend y muestra los resultados en el desplegable.
 * Se llama con debounce de 300ms desde el listener del input de búsqueda.
 * Al hacer click en un resultado navega al reproductor con el id del track.
 * @param {string} texto - Texto de búsqueda introducido por el usuario
 */
async function buscarTracks(texto) {
  const contenedor = document.getElementById("searchResultados");
  try {
    const res = await fetch(
      `${urlApi}tracks/buscar?titulo=${encodeURIComponent(texto)}`,
    );
    const tracks = await res.json();

    contenedor.innerHTML = "";

    if (tracks.length === 0) {
      contenedor.innerHTML = `<div class="search-resultado-vacio">Sin resultados</div>`;
      contenedor.hidden = false;
      return;
    }

    // Creamos un resultado por cada track encontrado
    tracks.forEach((track) => {
      const div = document.createElement("div");
      div.className = "search-resultado-item";
      div.innerHTML = `
        <img src="${urlApi}tracks/getPortada/${track.portada}"
             style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;">
        <div>
          <span class="search-resultado-titulo">${track.titulo}</span>
          <span class="search-resultado-productor">prod. ${track.nombreProductor}</span>
        </div>
      `;
      // Al pulsar un resultado navegamos al reproductor con el id del track
      div.addEventListener("click", () => {
        window.location.href = `reproductor.html?id=${track.idTrack}`;
      });
      contenedor.appendChild(div);
    });

    contenedor.hidden = false;
  } catch (e) {
    console.error("Error buscando tracks:", e);
  }
}

/**
 * Carga y renderiza las últimas subidas en la sección "Nuevas subidas".
 * Llama a GET /tracks/getUltimasSubidas y renderiza cada track como una card
 * con portada, botón de play inline, título, productor, género y duración.
 * Si la portada no carga se oculta con onerror para no romper el layout.
 */
async function cargarUltimasSubidas() {
  const contenedor = document.getElementById("nuevas-grid");
  try {
    const res = await fetch(`${urlApi}tracks/getUltimasSubidas`);
    const tracks = await res.json();

    // Limpiamos el contenedor antes de renderizar para evitar duplicados
    contenedor.innerHTML = "";

    // Creamos una card por cada track recibido del backend
    tracks.forEach((track) => {
      const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;
      const duracion = track.duracion ?? "--:--:--";

      const div = document.createElement("div");
      div.className = "card-nueva";
      div.style.cursor = "pointer";
      div.addEventListener("click", (e) => {
        // Si el click fue en el botón de play o dentro de él, no navegamos
        if (e.target.closest(".btn-play")) return;
        window.location.href = `reproductor.html?id=${track.idTrack}`;
      });
      div.innerHTML = `
        <div class="card-cover" style="background: linear-gradient(135deg, #1a1a2e, #16213e)">
          <img src="${urlPortada}" alt="portada"
               style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"
               onerror="this.style.display='none'">
          <div class="card-cover-overlay">
            <button class="btn-play" onclick="togglePlay(this)">
              <svg class="icono-play" width="12" height="14" viewBox="0 0 12 14" fill="white">
                <path d="M1 1l10 6L1 13V1z"/>
              </svg>
              <svg class="icono-pausa" width="12" height="14" viewBox="0 0 12 14" fill="white" style="display:none">
                <path d="M2 1h3v12H2zm5 0h3v12H7z"/>
              </svg>
            </button>
          </div>
          <audio src="${urlAudio}" preload="none"></audio>
        </div>
        <div class="card-body">
          <div class="card-name">${track.titulo}</div>
          <div class="card-producer">prod. ${track.nombreProductor}</div>
          <div class="card-footer">
            <span class="card-tag">${track.genero ?? "—"}</span>
            <span>${duracion}</span>
          </div>
        </div>
      `;
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error cargando últimas subidas:", e);
  }
}

/**
 * Ejecuta la búsqueda avanzada de tracks con los filtros del formulario.
 * Recoge los valores de todos los inputs, construye los parámetros y llama
 * a GET /tracks/buscarConFiltros. Muestra los resultados en #explorar-resultados.
 */
async function buscarConFiltros() {
  const contenedor = document.getElementById("explorar-resultados");
  const header = document.getElementById("explorar-resultados-header");
  const countEl = document.getElementById("explorar-count");
  const ordenEl = document.getElementById("explorar-orden");

  // Recogemos los valores del formulario
  const genero = document.getElementById("filtroGenero").value;
  const nombreProductor = document
    .getElementById("filtroProductor")
    .value.trim();
  const ordenarPor = document.getElementById("filtroOrden").value;
  const minLikes = document.getElementById("filtroMinLikes").value;
  const minComentarios = document.getElementById("filtroMinComentarios").value;
  const fechaDesde = document.getElementById("filtroFechaDesde").value;
  const fechaHasta = document.getElementById("filtroFechaHasta").value;

  // Construimos los parámetros — solo añadimos los que tienen valor
  const params = new URLSearchParams();
  if (genero) params.append("genero", genero);
  if (nombreProductor) params.append("nombreProductor", nombreProductor);
  if (ordenarPor) params.append("ordenarPor", ordenarPor);
  if (minLikes) params.append("minLikes", minLikes);
  if (minComentarios) params.append("minComentarios", minComentarios);
  if (fechaDesde) params.append("fechaDesde", fechaDesde);
  if (fechaHasta) params.append("fechaHasta", fechaHasta);

  // Mostramos un indicador de carga
  contenedor.innerHTML = `<p class="hero-sub fade-in" style="padding:16px 28px">Buscando...</p>`;
  header.hidden = true;

  try {
    const res = await fetch(`${urlApi}tracks/buscarConFiltros?${params}`);
    const tracks = await res.json();

    contenedor.innerHTML = "";

    if (!tracks.length) {
      contenedor.innerHTML = `<p class="hero-sub fade-in" style="padding:16px 28px">No se han encontrado instrumentales con esos filtros.</p>`;
      header.hidden = true;
      return;
    }

    // Mostramos el header con el número de resultados y el criterio de ordenación
    const ordenTextos = {
      likes: "más likes",
      comentarios: "más comentarios",
      fecha: "más recientes",
      reproducciones: "más reproducidas",
    };
    countEl.innerHTML = `<span style="color:var(--rojo)">${tracks.length}</span> resultado${tracks.length !== 1 ? "s" : ""} encontrado${tracks.length !== 1 ? "s" : ""}`;
    ordenEl.textContent = `ordenados por ${ordenTextos[ordenarPor] || "más likes"}`;
    header.hidden = false;

    // Renderizamos los resultados
    tracks.forEach((track, index) => {
      const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;
      const duracion = track.duracion ?? "--:--:--";

      const div = document.createElement("div");
      div.className = "track-item";
      div.style.cursor = "pointer";
      div.addEventListener("click", (e) => {
        if (e.target.closest(".btn-play")) return;
        window.location.href = `reproductor.html?id=${track.idTrack}`;
      });
      div.innerHTML = `
        <span class="track-rank">#${index + 1}</span>
        <div class="track-info">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${urlPortada}" alt="portada"
                 style="width:38px;height:38px;object-fit:cover;border-radius:4px;flex-shrink:0;">
            <div>
              <span class="track-name">${track.titulo}</span>
              <span class="track-producer">prod. ${track.nombreProductor}</span>
            </div>
          </div>
        </div>
        <div class="track-meta">
          <button class="btn-play" title="Reproducir" onclick="togglePlay(this)">
            <svg class="icono-play" width="12" height="14" viewBox="0 0 12 14" fill="white">
              <path d="M1 1l10 6L1 13V1z"/>
            </svg>
            <svg class="icono-pausa" width="12" height="14" viewBox="0 0 12 14" fill="white" style="display:none">
              <path d="M2 1h3v12H2zm5 0h3v12H7z"/>
            </svg>
          </button>
          <audio src="${urlAudio}" preload="none"></audio>
          <span class="track-meta-item likes">
            <svg width="13" height="12" viewBox="0 0 24 22" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${track.likes}
          </span>
          <span class="track-meta-item">
            <svg width="13" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            ${track.comentarios}
          </span>
          <span class="track-meta-item">${duracion}</span>
        </div>`;
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error buscando con filtros:", e);
    contenedor.innerHTML = `<p class="hero-sub fade-in" style="padding:16px 28px">Error al conectar con el servidor.</p>`;
  }
}

/**
 * Limpia todos los campos del formulario de filtros y vacía los resultados.
 */
function limpiarFiltros() {
  document.getElementById("filtroGenero").value = "";
  document.getElementById("filtroProductor").value = "";
  document.getElementById("filtroOrden").value = "likes";
  document.getElementById("filtroMinLikes").value = "";
  document.getElementById("filtroMinComentarios").value = "";
  document.getElementById("filtroFechaDesde").value = "";
  document.getElementById("filtroFechaHasta").value = "";
  document.getElementById("explorar-resultados").innerHTML = "";
  document.getElementById("explorar-resultados-header").hidden = true;
}

// ==================================================================================
// BUSCADOR — encuentra tracks por título y navega al reproductor al seleccionar
// ==================================================================================

// Timeout para el debounce del buscador — evita llamar al backend en cada tecla
let searchTimeout = null;

/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Registra el listener del buscador con debounce de 300ms para no llamar
 * al backend en cada pulsación de tecla, y carga el top 5 y las últimas subidas.
 */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    const texto = e.target.value.trim();
    clearTimeout(searchTimeout);

    // No buscamos si hay menos de 2 caracteres — ocultamos el desplegable
    if (texto.length < 2) {
      document.getElementById("searchResultados").hidden = true;
      return;
    }

    // Esperamos 300ms desde la última pulsación antes de lanzar la búsqueda
    searchTimeout = setTimeout(() => buscarTracks(texto), 300);
  });
  cargarTop5();
  cargarUltimasSubidas();
});
