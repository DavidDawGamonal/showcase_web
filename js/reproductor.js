// URL base de la API, definida en config.js
const urlApi = CONFIG.API_URL;

// ── Variables globales ──

// Referencia al elemento <audio> principal del reproductor
let audio = null;

// Objeto con los datos del track que está sonando actualmente (título, productor, género, etc.)
let track = null;

// Referencia al elemento <audio> de las recomendaciones que está sonando (si hay alguno)
// Se usa para parar el audio anterior cuando se pulsa play en otro track de la lista
let audioActual = null;

// Referencia al botón de play de las recomendaciones que está activo
// Se usa para resetear su icono cuando se cambia de track en la lista
let btnPlayActual = null;

// Volumen actual del reproductor. Se inicializa a 0.5 (50%) y se actualiza
// al mover el slider o al hacer mute, para poder restaurarlo después
let volumenActual = 0.5;

// Array con todos los tracks de la lista de recomendaciones
// Se rellena en cargarRecomendaciones() y lo usan siguiente() y anterior()
let trackActual = null;

// Índice del track activo dentro del array trackActual
// Permite saber en qué posición estamos para avanzar o retroceder
let trackIndex = null;

// Indica si el modo aleatorio está activado (true) o desactivado (false)
// Lo controla la función aleatorio() y lo usa siguiente() para decidir
// si avanzar en orden o elegir un índice al azar
let trackAleatorio = false;

// true cuando se está reproduciendo una playlist — siguiente/anterior usan trackActual (playlist)
// false cuando se navega por recomendaciones
let modoPlaylist = false;

// ==================================================================================
// CONTROLES DEL REPRODUCTOR PRINCIPAL
// ==================================================================================

/**
 * Alterna entre play y pausa en el reproductor principal.
 * Añade o quita la clase "playing" en btnPlay para cambiar el icono visualmente.
 */
function togglePlay() {
  const btn = document.getElementById("btnPlay");
  if (audio.paused) {
    audio.play();
    btn.classList.add("playing");
  } else {
    audio.pause();
    btn.classList.remove("playing");
  }
}

/**
 * Para la reproducción y reinicia el audio al principio.
 * Quita la clase "playing" de btnPlay para volver al icono de play.
 */
function stop() {
  const btn = document.getElementById("btnPlay");
  audio.pause();
  audio.currentTime = 0;
  btn.classList.remove("playing");
}

/**
 * Activa o desactiva la repetición del track actual.
 * Usa la propiedad nativa audio.loop del elemento <audio>.
 * Añade o quita las clases "playing" y "activo" en btnRepit para el feedback visual.
 * La clase "activo" está definida en el CSS con color: var(--rojo).
 */
function repit() {
  const btnRepit = document.getElementById("btnRepit");
  if (audio.loop !== true) {
    audio.loop = true;
    btnRepit.classList.add("playing");
    btnRepit.classList.add("activo");
  } else {
    audio.loop = false;
    btnRepit.classList.remove("playing");
    btnRepit.classList.remove("activo");
  }
}

/**
 * Alterna entre silencio y el volumen anterior.
 * Si el audio está silenciado (volume === 0), restaura el volumen guardado en volumenActual
 * y devuelve el slider a su posición anterior.
 * Si no, guarda el volumen actual en volumenActual antes de silenciar y pone el slider a 0.
 * Añade o quita la clase "activo" en btnMute para el feedback visual.
 */
function toggleMute() {
  const btnMute = document.getElementById("btnMute");
  const slider = document.getElementById("volumen");
  if (audio.volume === 0) {
    audio.volume = volumenActual;
    slider.value = volumenActual; // restaura el slider al volumen anterior
    btnMute.classList.remove("activo");
  } else {
    volumenActual = audio.volume;
    audio.volume = 0;
    slider.value = 0; // pone el slider a 0
    btnMute.classList.add("activo");
  }
}

/**
 * Activa o desactiva el modo aleatorio.
 * Invierte el valor booleano de trackAleatorio con el operador !.
 * Añade o quita la clase "activo" en btnAleatorio para el feedback visual.
 * La lógica de elegir un índice aleatorio está en siguiente().
 */
function aleatorio() {
  const btnAleatorio = document.getElementById("btnAleatorio");
  trackAleatorio = !trackAleatorio;
  if (trackAleatorio) {
    btnAleatorio.classList.add("activo");
  } else {
    btnAleatorio.classList.remove("activo");
  }
}

/**
 * Avanza al siguiente track de la lista de recomendaciones.
 * Si el modo aleatorio está activo, elige un índice al azar con Math.random().
 * Si no, incrementa trackIndex en 1 y vuelve al principio si llega al final del array.
 * Carga el nuevo track, lo reproduce y actualiza el botón de play.
 */
async function siguiente() {
  if (trackAleatorio) {
    // Genera un índice aleatorio entre 0 y la longitud del array - 1
    trackIndex = Math.floor(Math.random() * trackActual.length);
  } else {
    trackIndex++;
    // Si superamos el último elemento, volvemos al primero
    if (trackIndex >= trackActual.length) {
      trackIndex = 0;
    }
  }
  await cargarTrack(trackActual[trackIndex].idTrack);
  const btnPlay = document.getElementById("btnPlay");
  audio.play();
  btnPlay.classList.add("playing");
}

/**
 * Retrocede al track anterior de la lista de recomendaciones.
 * Decrementa trackIndex en 1 y salta al último elemento si llegamos por debajo de 0.
 * Carga el nuevo track, lo reproduce y actualiza el botón de play.
 */
async function anterior() {
  trackIndex--;
  // Si bajamos por debajo del primer elemento, saltamos al último
  if (trackIndex < 0) {
    trackIndex = trackActual.length - 1;
  }
  await cargarTrack(trackActual[trackIndex].idTrack);
  const btnPlay = document.getElementById("btnPlay");
  audio.play();
  btnPlay.classList.add("playing");
}

// ==================================================================================
// CARGA DE DATOS
// ==================================================================================

/**
 * Carga los datos de un track desde el backend y actualiza el reproductor.
 * Si no se pasa id como parámetro lo lee de la URL (?id=XX).
 * Si tampoco hay id pero hay ?playlist=XX, delega en cargarPlaylist() para
 * cargar el primer track de la playlist y configurar trackActual para siguiente/anterior.
 *
 * Actualiza en el DOM: portada, título, productor, género y src del <audio>.
 * Guarda el track en la variable global "track" para que otras funciones puedan usarlo.
 * Si el backend devuelve un error (res.ok === false), resetea track a null y sale.
 * Al terminar recarga los likes, el estado del botón like y los comentarios del track.
 * Si no estamos en modo playlist oculta el banner de playlist.
 *
 * @param {number} id - ID del track a cargar. Si no se pasa, lo lee de la URL.
 */
async function cargarTrack(id) {
  // Si no se pasó un id como parámetro, lo leemos de la URL
  if (!id) {
    const params = new URLSearchParams(window.location.search);
    id = params.get("id");

    // Si no hay id pero hay playlist, cargamos el primer track de la playlist
    if (!id) {
      const idPlaylist = params.get("playlist");
      if (idPlaylist) {
        await cargarPlaylist(idPlaylist);
        return;
      }
    }
  }
  // Si tampoco hay id en la URL, salimos sin hacer nada
  if (!id) return;

  try {
    const res = await fetch(`${urlApi}tracks/getTrack/${id}`);
    // Si el backend devuelve un error (ej. 404), reseteamos track y salimos
    if (!res.ok) {
      track = null;
      return;
    }
    track = await res.json();

    const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
    const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;

    // Actualiza la imagen de portada
    const portadaEl = document.querySelector(".portada-img");
    portadaEl.innerHTML = `<img src="${urlPortada}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;

    // Actualiza título, productor y badge de género
    document.querySelector(".track-titulo").textContent = track.titulo;
    document.querySelector(".track-productor-sub").innerHTML = `
      prod. ${track.nombreProductor}
      <span class="track-genero-badge">${track.genero}</span>
    `;

    // Asigna el src del audio — el navegador lo cargará automáticamente
    audio.src = urlAudio;
    await actualizarLikes(); // Número de likes
    await actualizarEstadoLike(); // Botón de like marcado/desmarcado
    cargarComentarios(track.idTrack); // Comentarios del track actual

    // Si no estamos en modo playlist ocultamos el banner
    if (!modoPlaylist) {
      const banner = document.getElementById("playlistBanner");
      if (banner) banner.hidden = true;
    }
  } catch (e) {
    console.error("Error cargando track:", e);
  }
}

// =============================================================================
// ZONA DE LIKES
// =============================================================================

/**
 * Alterna el like del usuario logado sobre el track actual.
 * Si no hay track cargado o no hay usuario logado, no hace nada.
 * Tras el toggle actualiza el contador y el estado visual del botón.
 */
async function toggleLike() {
  if (!track) return;
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) return; // Solo usuarios logados pueden dar like

  await fetch(
    `${urlApi}likes/toggleLike?idUsuario=${usuarioLogado.idUsuario}&idTrack=${track.idTrack}`,
    { method: "POST" },
  );

  await actualizarLikes();
  await actualizarEstadoLike();
}

/**
 * Obtiene el número total de likes del track actual y actualiza el contador en el DOM.
 * Llama a GET /likes/contarLikes?idTrack={id} y actualiza el texto del span contadorLikes.
 */
async function actualizarLikes() {
  const res = await fetch(
    `${urlApi}likes/contarLikes?idTrack=${track.idTrack}`,
  );
  const total = await res.json();
  const div = document.getElementById("contadorLikes");
  div.lastChild.textContent = ` ${total} likes`;
}

/**
 * Comprueba si el usuario logado ya ha dado like al track actual y actualiza el botón.
 * Llama a GET /likes/tieneLike y añade o quita la clase "activo" en btnLike
 * para pintar el corazón relleno o vacío.
 * Si no hay usuario logado o no hay track, no hace nada.
 */
async function actualizarEstadoLike() {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado || !track) return;

  const res = await fetch(
    `${urlApi}likes/tieneLike?idUsuario=${usuarioLogado.idUsuario}&idTrack=${track.idTrack}`,
  );
  const tieneLike = await res.json();

  // Rellenamos o vaciamos el corazón según si el usuario ya ha dado like
  const btnLike = document.getElementById("btnLike");
  if (tieneLike) {
    btnLike.classList.add("activo");
    btnLike.classList.remove("inactivo");
  } else {
    btnLike.classList.remove("activo");
    btnLike.classList.add("inactivo");
  }
}
// FIN ZONA LIKES

// ==================================================================================
// COMENTARIOS
// ==================================================================================

/**
 * Carga los comentarios principales de un track desde el backend y los renderiza en el DOM.
 * Actualiza también el contador de comentarios del título de la sección.
 * Cada comentario muestra sus respuestas anidadas con sangría.
 * Si no hay track cargado, muestra un mensaje y sale sin hacer la petición.
 * Por defecto muestra solo los 5 primeros comentarios. Al pasar limite=null muestra todos.
 * @param {number} idTrack - ID del track del que se quieren cargar los comentarios.
 * @param {number|null} limite - Número máximo de comentarios a mostrar. null para mostrar todos.
 */
/**
 * Carga los comentarios principales de un track desde el backend y los renderiza en el DOM.
 * Actualiza también el contador de comentarios del título de la sección.
 * Cada comentario muestra sus respuestas anidadas con sangría y un corazón con contador de likes.
 * Si no hay track cargado, muestra un mensaje y sale sin hacer la petición.
 * Por defecto muestra solo los 5 primeros comentarios. Al pasar limite=null muestra todos.
 * @param {number} idTrack - ID del track del que se quieren cargar los comentarios.
 * @param {number|null} limite - Número máximo de comentarios a mostrar. null para mostrar todos.
 */
async function cargarComentarios(idTrack, limite = 5) {
  const contenedor = document.getElementById("listaComentarios");

  if (!track) {
    if (contenedor)
      contenedor.innerHTML = "<p>No hay comentarios disponibles.</p>";
    return;
  }

  try {
    const res = await fetch(
      `${urlApi}comentarios/getComentariosTrack?idTrack=${idTrack}`,
    );
    const comentarios = await res.json();

    // Limpiamos el contenedor antes de renderizar para evitar duplicados
    if (contenedor) contenedor.innerHTML = "";

    // Actualizamos el contador del título: "Comentarios (3)"
    actualizarContadorComentarios(comentarios.length);

    // Si limite es null mostramos todos, si no solo los primeros N
    const comentariosMostrados = limite
      ? comentarios.slice(0, limite)
      : comentarios;

    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));

    comentariosMostrados.forEach((comentario) => {
      const div = document.createElement("div");
      div.className = "comment-item";
      div.innerHTML = `
        <div class="comment-header">
          <span class="comment-user">${comentario.usuario.nombre}</span>
          <span class="comment-fecha">${new Date(comentario.fecha).toLocaleDateString("es-ES")}</span>
        </div>
        <p class="comment-texto">${comentario.contenido}</p>
        <div class="comment-footer">
          <!-- Botón ver respuestas — izquierda -->
          ${
            comentario.respuestas && comentario.respuestas.length
              ? `
            <button class="comment-btn-respuestas" onclick="toggleRespuestas(event, ${comentario.idComentario})">
              ↩ ${comentario.respuestas.length} ${comentario.respuestas.length === 1 ? "respuesta" : "respuestas"}
            </button>`
              : "<span></span>"
          }
          <!-- Likes y responder — derecha -->
          <div style="display:flex; align-items:center; gap:10px;">
            <!-- Corazón con contador de likes -->
            <button class="comment-btn-like ${usuarioLogado ? "" : "comment-btn-like-disabled"}"
                    id="btn-like-coment-${comentario.idComentario}"
                    onclick="${usuarioLogado ? `toggleLikeComentario(${comentario.idComentario})` : ""}">
              <svg width="12" height="11" viewBox="0 0 24 22" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span id="likes-coment-${comentario.idComentario}">0</span>
            </button>
            <!-- Botón responder -->
            ${
              usuarioLogado
                ? `
              <button class="comment-btn-responder" onclick="toggleFormRespuesta(${comentario.idComentario})">
                Responder
              </button>`
                : ""
            }
          </div>
        </div>
        ${
          usuarioLogado
            ? `
          <div id="form-respuesta-${comentario.idComentario}" hidden>
            <textarea id="input-respuesta-${comentario.idComentario}"
              class="comment-textarea-respuesta"
              placeholder="Escribe tu respuesta..."
              maxlength="500"></textarea>
            <button class="comment-btn-enviar-respuesta"
              onclick="enviarRespuesta(${comentario.idComentario})">
              Enviar
            </button>
          </div>`
            : ""
        }
        ${
          comentario.respuestas && comentario.respuestas.length
            ? `
          <div id="respuestas-${comentario.idComentario}" class="comment-respuestas" hidden>
            ${comentario.respuestas
              .map(
                (r) => `
              <div class="comment-item comment-respuesta">
                <div class="comment-header">
                  <span class="comment-user">↳ ${r.usuario.nombre}</span>
                  <span class="comment-fecha">${new Date(r.fecha).toLocaleDateString("es-ES")}</span>
                </div>
                <p class="comment-texto">${r.contenido}</p>
              </div>`,
              )
              .join("")}
          </div>`
            : ""
        }
      `;
      contenedor.appendChild(div);

      // Cargamos el estado y contador de likes del comentario
      actualizarLikeComentario(comentario.idComentario, usuarioLogado);
    });
  } catch (e) {
    console.error("Error cargando comentarios:", e);
  }
}

/**
 * Carga el contador de likes, el estado activo/inactivo del corazón y el tooltip
 * con los nombres de los usuarios que han dado like a un comentario.
 * Si no hay usuario logado solo carga el contador y el tooltip.
 * @param {number} idComentario - ID del comentario
 * @param {Object|null} usuarioLogado - Usuario logado o null si no hay sesión activa
 */
async function actualizarLikeComentario(idComentario, usuarioLogado) {
  try {
    // Cargamos el contador
    const resContar = await fetch(
      `${urlApi}likesComentarios/contarLikes?idComent=${idComentario}`,
    );
    const total = await resContar.json();
    const spanLikes = document.getElementById(`likes-coment-${idComentario}`);
    if (spanLikes) spanLikes.textContent = total;

    // Cargamos los nombres para el tooltip
    const resUsuarios = await fetch(
      `${urlApi}likesComentarios/usuarios?idComent=${idComentario}`,
    );
    const nombres = await resUsuarios.json();
    const btn = document.getElementById(`btn-like-coment-${idComentario}`);
    if (btn) {
      // Si hay likes mostramos los nombres, si no un mensaje
      btn.title = nombres.length
        ? `❤️ ${nombres.join(", ")}`
        : "Sé el primero en dar like";
    }

    // Si hay usuario logado comprobamos si ya dio like
    if (usuarioLogado) {
      const resTiene = await fetch(
        `${urlApi}likesComentarios/tieneLike?idUsuario=${usuarioLogado.idUsuario}&idComent=${idComentario}`,
      );
      const tieneLike = await resTiene.json();
      if (btn) btn.classList.toggle("activo", tieneLike);
    }
  } catch (e) {
    console.error("Error cargando like comentario:", e);
  }
}

/**
 * Alterna el like de un comentario y actualiza el estado del botón y el contador.
 * Solo disponible para usuarios logados.
 * @param {number} idComentario - ID del comentario
 */
async function toggleLikeComentario(idComentario) {
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) return;

  try {
    await fetch(
      `${urlApi}likesComentarios/toggleLike?idUsuario=${usuarioLogado.idUsuario}&idComent=${idComentario}`,
      { method: "POST" },
    );
    // Recargamos el estado del like y el contador
    actualizarLikeComentario(idComentario, usuarioLogado);
  } catch (e) {
    console.error("Error toggleando like comentario:", e);
  }
}

/**
 * Muestra u oculta el formulario de respuesta a un comentario.
 * @param {number} idComentario - ID del comentario al que se responde
 */
function toggleFormRespuesta(idComentario) {
  const form = document.getElementById(`form-respuesta-${idComentario}`);
  form.hidden = !form.hidden;
}

/**
 * Envía una respuesta a un comentario y recarga la lista de comentarios.
 * @param {number} idComentPadre - ID del comentario al que se responde
 */
async function enviarRespuesta(idComentPadre) {
  const textarea = document.getElementById(`input-respuesta-${idComentPadre}`);
  const contenido = textarea.value.trim();
  if (!contenido) return;

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) return;

  const params = new URLSearchParams(window.location.search);
  const idTrack = params.get("id") || track?.idTrack;

  try {
    const res = await fetch(
      `${urlApi}comentarios/responder?idComentPadre=${idComentPadre}&idUsuario=${usuarioLogado.idUsuario}&contenido=${encodeURIComponent(contenido)}`,
      { method: "POST" },
    );
    const ok = await res.json();
    if (ok) {
      textarea.value = "";
      cargarComentarios(idTrack);
    }
  } catch (e) {
    console.error("Error enviando respuesta:", e);
  }
}

/**
 * Muestra u oculta el formulario para escribir un nuevo comentario.
 * Alterna el atributo hidden del elemento formComentario.
 * Solo es accesible si hay usuario logado (el botón está hidden por defecto).
 */
function toggleFormComentario() {
  const form = document.getElementById("formComentario");
  form.hidden = !form.hidden;
}

/**
 * Envía un nuevo comentario al backend y recarga la lista de comentarios.
 * Lee el contenido del textarea, el idUsuario del localStorage y el idTrack
 * de la variable global track. Si el backend devuelve false, sale sin recargar.
 */
async function enviarComentario() {
  const textArea = document.getElementById("inputComentario");
  const comentarioNuevo = textArea.value;
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  const usuario = usuarioLogado.idUsuario;
  const idTrack = track.idTrack;

  const res = await fetch(
    `${urlApi}comentarios/crear?idTrack=${idTrack}&idUsuario=${usuario}&contenido=${comentarioNuevo}`,
    { method: "POST" },
  );

  const ok = await res.json();

  if (!ok) {
    console.error("Error al enviar el comentario");
    return;
  }

  // Limpiamos el textarea y recargamos los comentarios para mostrar el nuevo
  textArea.value = "";
  cargarComentarios(track.idTrack);
}

/**
 * Alterna entre mostrar todos los comentarios del track y mostrar solo los 5 primeros.
 * Cambia el texto del botón según el estado actual y, al expandir,
 * hace scroll suave hasta la sección de comentarios.
 * Lee el id del track desde la URL (?id=XX) para pasárselo a cargarComentarios().
 */
function toggleComentarios() {
  const btn = document.getElementById("btnVerTodos");
  const params = new URLSearchParams(window.location.search);
  const idTrack = params.get("id");

  if (btn.textContent.includes("Ver todos")) {
    cargarComentarios(idTrack, null);
    btn.textContent = "Ver menos ↑";
    document
      .getElementById("seccionComentarios")
      .scrollIntoView({ behavior: "smooth" });
  } else {
    cargarComentarios(idTrack, 5);
    btn.textContent = "Ver todos →";
  }
}

function actualizarContadorComentarios(total) {
  document.getElementById("contadorComentarios").textContent = `(${total})`;
  document.getElementById("statComentarios").lastChild.textContent =
    ` ${total} comentarios`;
}

/**
 * Muestra u oculta las respuestas de un comentario.
 * El evento se detiene para no propagarse al listener de cierre global.
 * @param {Event} e - El evento click
 * @param {number} idComentario - ID del comentario
 */
function toggleRespuestas(e, idComentario) {
  e.stopPropagation();
  const div = document.getElementById(`respuestas-${idComentario}`);
  div.hidden = !div.hidden;
}

/**
 * Cierra todas las respuestas abiertas al hacer click fuera de ellas.
 */
document.addEventListener("click", () => {
  document.querySelectorAll(".comment-respuestas").forEach((div) => {
    div.hidden = true;
  });
});

// ==================================================================================
// RECOMENDACIONES
// ==================================================================================

/**
 * Carga la lista de recomendaciones desde el backend y la renderiza en el DOM.
 *
 * Lógica de filtrado:
 * - Carga los 5 tracks del mismo productor ordenados por likes.
 * - Si el track tiene género, filtra también por ese género.
 * - Si no llega a 5 con ese productor y género, el backend completa con
 *   tracks del mismo género de otros productores.
 *
 * Solo actualiza trackActual y trackIndex si modoPlaylist es false.
 * Si se está reproduciendo una playlist, las recomendaciones se muestran
 * visualmente pero no afectan a la navegación con siguiente/anterior.
 *
 * Usa createElement + appendChild en lugar de innerHTML += para no
 * reconstruir el DOM en cada iteración (lo que rompería los elementos <audio>).
 */
async function cargarRecomendaciones() {
  const contenedor = document.getElementById("recomendaciones");

  // Si no hay track cargado, mostramos un mensaje y salimos
  if (!track) {
    if (contenedor)
      contenedor.innerHTML =
        "<p style='padding: 16px 28px; font-family: Space Mono, monospace; font-size: 1rem; color: var(--blanco-dim); letter-spacing: 0.06em;'>No hay recomendaciones disponibles.</p>";
    return;
  }

  try {
    // Construimos el filtro saneado: nunca pasamos null ni undefined a URLSearchParams
    const filtro = new URLSearchParams({ idUsuario: track.idProductor ?? 0 });
    if (track.genero) filtro.append("genero", track.genero);

    const res = await fetch(`${urlApi}tracks/getListadoTracks?${filtro}`);
    const tracks = await res.json();

    // Solo actualizamos trackActual si no estamos reproduciendo una playlist
    // En modo playlist, siguiente/anterior siguen usando los tracks de la playlist
    if (!modoPlaylist) {
      trackActual = [...tracks];
      trackIndex = 0;
    }

    // Limpiamos el contenedor antes de renderizar
    if (contenedor) {
      contenedor.innerHTML = "";
    }

    // Usamos for...of para poder usar await dentro del bucle
    for (const [index, track] of tracks.entries()) {
      const urlPortada = `${urlApi}tracks/getPortada/${track.portada}`;
      const urlAudio = `${urlApi}tracks/getInstrumental/${track.idTrack}`;
      // Si el backend no devuelve duración, mostramos un placeholder
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
                <span class="track-genre">${track.genero}</span>
                <span class="track-producer">prod. ${track.nombreProductor}</span>
              </div>
            </div>
          </div>
          <div class="track-meta">
            <button class="btn-play" title="Reproducir" onclick="togglePlayRec(this)">
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
            <span class="track-meta-item" id="rec-comentarios-${track.idTrack}"
                  title="Comentarios" style="cursor:pointer"
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

      // Cargamos el contador de comentarios real para este track
      const resComentarios = await fetch(
        `${urlApi}comentarios/contarComentarios?idTrack=${track.idTrack}`,
      );
      const numComentarios = await resComentarios.json();
      document.getElementById(`rec-comentarios-${track.idTrack}`).innerHTML = `
        <svg width="13" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        ${numComentarios}
      `;
    }
  } catch (e) {
    console.error("Error cargando recomendaciones:", e);
  }
}

// ==================================================================================
// REPRODUCCION DE RECOMENDACIONES
// ==================================================================================

/**
 * Controla el play/pausa de los tracks de la lista de recomendaciones.
 * @param {HTMLElement} btn - El botón de play pulsado, pasado con onclick="togglePlayRec(this)".
 *
 * Solo puede sonar un track de la lista a la vez:
 * si hay otro sonando (audioActual), lo para y resetea su icono antes de reproducir el nuevo.
 * Actualiza audioActual y btnPlayActual para poder controlar el track activo desde fuera.
 */
function togglePlayRec(btn) {
  const trackItem = btn.closest(".track-item");
  // Cada track-item tiene su propio elemento <audio> oculto con el src ya asignado
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

  // Cuando el track termina, reseteamos el icono y las referencias globales
  audio.onended = () => {
    iconoPlay.style.display = "block";
    iconoPausa.style.display = "none";
    audioActual = null;
    btnPlayActual = null;
  };
}

// ==================================================================================
// UTILIDADES
// ==================================================================================

/**
 * Convierte segundos a formato m:ss.
 * @param {number} s - Segundos totales a formatear.
 * @returns {string} Tiempo en formato "m:ss" (ej. 3:07, 1:45).
 * padStart(2, "0") asegura que los segundos siempre tengan dos dígitos (ej. 3:07 en lugar de 3:7).
 */
function formatTiempo(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ":" + String(sec).padStart(2, "0");
}

// =====================================================================
// DESCARGAR TRACK
// =====================================================================
/**
 * Registra la descarga en BD y descarga el archivo de audio en el dispositivo del usuario.
 * Solo disponible para usuarios logados. Si no hay usuario logado, no hace nada.
 */
async function descargarTrack() {
  if (!track) return;
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado) return;

  const url = `${urlApi}descargas/descargar/${track.idTrack}?idUsuario=${usuarioLogado.idUsuario}`;

  // Creamos un enlace temporal para forzar la descarga
  const a = document.createElement("a");
  a.href = url;
  a.click();
}

// ==================================================================================
// PLAYLISTS
// ==================================================================================

// ID de la playlist seleccionada actualmente en el menú
let playlistSeleccionada = null;

/**
 * Muestra u oculta el menú desplegable de playlists.
 * Si se abre carga las playlists del usuario y resetea la selección.
 */
async function toggleMenuPlaylist() {
  const menu = document.getElementById("menuPlaylist");
  const btn = document.getElementById("btnPlaylist");

  if (!menu.hidden) {
    menu.hidden = true;
    playlistSeleccionada = null;
    return;
  }

  // Posicionamos el menú justo debajo del botón
  const rect = btn.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = rect.bottom + 6 + "px";
  menu.style.left = rect.left + "px";

  menu.hidden = false;
  playlistSeleccionada = null;
  await cargarPlaylistsEnMenu();
}

/**
 * Carga las playlists del usuario en el menú desplegable.
 * Las playlists que ya contienen el track aparecen deshabilitadas con ✓.
 * Las disponibles se pueden seleccionar — solo una a la vez.
 */
async function cargarPlaylistsEnMenu() {
  const contenedor = document.getElementById("listaPlaylists");
  contenedor.innerHTML = "";

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado || !track) return;

  try {
    const res = await fetch(
      `${urlApi}playlists/byUsuario?idUsuario=${usuarioLogado.idUsuario}`,
    );
    const playlists = await res.json();

    if (!playlists.length) {
      contenedor.innerHTML = `<div class="playlist-vacia">No tienes playlists aún</div>`;
      return;
    }

    playlists.forEach((playlist) => {
      // Comprobamos si el track actual ya está en esta playlist
      const yaEsta = playlist.tracks.some((t) => t.idTrack === track.idTrack);

      const div = document.createElement("div");
      div.className = "playlist-lista-item" + (yaEsta ? " deshabilitada" : "");
      div.dataset.idPlaylist = playlist.idPlaylist;
      div.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
        </svg>
        ${playlist.nombre}
        ${yaEsta ? '<span class="check yaEsta">✓</span>' : '<span class="check seleccion" style="display:none">✓</span>'}
      `;

      // Solo las playlists disponibles son seleccionables
      if (!yaEsta) {
        div.addEventListener("click", () =>
          seleccionarPlaylist(playlist.idPlaylist, div),
        );
      }
      contenedor.appendChild(div);
    });
  } catch (e) {
    console.error("Error cargando playlists:", e);
  }
}

/**
 * Selecciona o deselecciona una playlist del menú.
 * Si se pulsa una playlist no seleccionada mueve el ✓ a ella.
 * Si se pulsa la playlist que ya está seleccionada la deselecciona.
 * Las playlists que ya contienen el track no son seleccionables.
 * @param {number} idPlaylist - ID de la playlist pulsada
 * @param {HTMLElement} div - El elemento div de la playlist pulsada
 */
function seleccionarPlaylist(idPlaylist, div) {
  // Si pulsas la misma que ya está seleccionada, la deseleccionas
  if (playlistSeleccionada === idPlaylist) {
    playlistSeleccionada = null;
    div.classList.remove("seleccionada");
    div.querySelector(".seleccion").style.display = "none";
    return;
  }

  // Quitamos la selección anterior
  document.querySelectorAll(".playlist-lista-item .seleccion").forEach((el) => {
    el.style.display = "none";
  });
  document.querySelectorAll(".playlist-lista-item").forEach((el) => {
    el.classList.remove("seleccionada");
  });

  // Marcamos la nueva selección
  playlistSeleccionada = idPlaylist;
  div.classList.add("seleccionada");
  div.querySelector(".seleccion").style.display = "inline";
}

/**
 * Confirma la adición del track a la playlist seleccionada.
 * Si no hay ninguna seleccionada muestra un aviso.
 */
async function confirmarAñadirAPlaylist() {
  if (!playlistSeleccionada) {
    alert("Selecciona una playlist primero.");
    return;
  }
  if (!track) return;

  try {
    const res = await fetch(
      `${urlApi}playlists/añadirTrack?idPlaylist=${playlistSeleccionada}&idTrack=${track.idTrack}`,
      { method: "POST" },
    );
    const ok = await res.json();
    if (ok) {
      document.getElementById("menuPlaylist").hidden = true;
      playlistSeleccionada = null;
      alert("Track añadido a la playlist.");
    }
  } catch (e) {
    console.error("Error añadiendo track a playlist:", e);
  }
}

/**
 * Crea una nueva playlist y añade el track actual a ella.
 */
async function crearYAnadir() {
  const input = document.getElementById("inputNuevaPlaylist");
  const nombre = input.value.trim();

  if (!nombre) {
    alert("Escribe un nombre para la playlist.");
    return;
  }

  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuarioLogado || !track) return;

  try {
    const res = await fetch(
      `${urlApi}playlists/crear?idUsuario=${usuarioLogado.idUsuario}&nombre=${encodeURIComponent(nombre)}`,
      { method: "POST" },
    );
    const ok = await res.json();

    if (!ok) {
      alert("Ya tienes una playlist con ese nombre.");
      return;
    }

    // Obtenemos el id de la playlist recién creada
    const resPlaylists = await fetch(
      `${urlApi}playlists/byUsuario?idUsuario=${usuarioLogado.idUsuario}`,
    );
    const playlists = await resPlaylists.json();
    const nueva = playlists.find((p) => p.nombre === nombre);

    if (nueva) {
      playlistSeleccionada = nueva.idPlaylist;
      await confirmarAñadirAPlaylist();
      input.value = "";
    }
  } catch (e) {
    console.error("Error creando playlist:", e);
  }
}

/**
 * Carga una playlist en el reproductor y prepara la reproducción del primer track.
 * Activa modoPlaylist para que siguiente/anterior naveguen por los tracks de la
 * playlist en lugar de por las recomendaciones.
 * Guarda todos los tracks de la playlist en trackActual para poder
 * avanzar y retroceder con los botones siguiente/anterior.
 * Muestra el banner con el nombre de la playlist y reproduce automáticamente
 * gracias al click previo del usuario en el perfil.
 *
 * @param {number} idPlaylist - ID de la playlist a cargar
 */
async function cargarPlaylist(idPlaylist) {
  try {
    // Activamos el modo playlist — siguiente/anterior usarán trackActual en lugar de recomendaciones
    modoPlaylist = true;

    // Necesitamos el idUsuario para obtener las playlists del usuario
    const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (!usuarioLogado) return;

    const resPlaylist = await fetch(
      `${urlApi}playlists/byUsuario?idUsuario=${usuarioLogado.idUsuario}`,
    );
    const playlists = await resPlaylist.json();

    // Buscamos la playlist por id
    const playlist = playlists.find(
      (p) => p.idPlaylist === parseInt(idPlaylist),
    );

    if (!playlist || !playlist.tracks.length) return;

    document.getElementById("bannerNombrePlaylist").textContent =
      `Reproduciendo lista: ${playlist.nombre}`;
    document.getElementById("playlistBanner").hidden = false;

    // Guardamos los tracks de la playlist en trackActual para siguiente/anterior
    trackActual = playlist.tracks;
    trackIndex = 0;

    // Cargamos el primer track y sus comentarios
    await cargarTrack(playlist.tracks[0].idTrack);
    cargarComentarios(playlist.tracks[0].idTrack);

    // Iniciamos la reproducción — el overlay garantiza que hay interacción previa del usuario
    const btnPlay = document.getElementById("btnPlay");
    audio.play();
    btnPlay.classList.add("playing");
  } catch (e) {
    console.error("Error cargando playlist:", e);
  }
}

// ==================================================================================
// INICIALIZACIÓN
// ==================================================================================

/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Obtiene las referencias a los elementos del DOM, configura el volumen inicial,
 * registra todos los event listeners del reproductor y carga el track y las recomendaciones.
 *
 * Gestiona también la visibilidad de elementos que solo deben mostrarse a usuarios logados:
 * - Botón "+ Comentar"
 * - Botón "Descargar"
 * - Botón "Añadir a playlist"
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Obtenemos referencias a los elementos del DOM que usaremos en los listeners
  audio = document.getElementById("audioReproductor");
  const progressTrack = document.getElementById("progressTrack");
  const progressFill = document.getElementById("progressFill");
  const tiempoActual = document.getElementById("tiempoActual");
  const volumen = document.getElementById("volumen");

  // =================================================================================
  // LÓGICA DEL BUSCADOR PARA QUE ENCUENTRE POR TÍTULO Y AL SELECCIONAR UN RESULTADO
  // NAVEGUE AL REPRODUCTOR PARA REPRODUCIRLA EN EL
  // ==================================================================================
  let searchTimeout = null;

  document.getElementById("searchInput").addEventListener("input", (e) => {
    const texto = e.target.value.trim();
    clearTimeout(searchTimeout);

    if (texto.length < 2) {
      document.getElementById("searchResultados").hidden = true;
      return;
    }

    searchTimeout = setTimeout(() => buscarTracks(texto), 300);
  });

  /**
   * Incrementa el contador de reproducciones del track actual cada vez que el audio empieza.
   * Cubre todos los casos: play manual, siguiente, anterior y repetición.
   * Si no hay track cargado, no hace nada.
   */
  audio.addEventListener("play", () => {
    if (track) {
      fetch(`${urlApi}tracks/reproducir/${track.idTrack}`, {
        method: "POST",
      });
    }
  });

  /**
   * Busca tracks por título en el backend y muestra los resultados en el desplegable.
   * Se llama con un debounce de 300ms desde el listener del input de búsqueda.
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

  // Sincronizamos el volumen del audio con el valor inicial del slider
  // parseFloat convierte el string del input a número decimal
  volumenActual = parseFloat(volumen.value);
  audio.volume = volumenActual;

  // Actualiza la barra de progreso y el tiempo actual mientras suena el audio
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + "%";
    tiempoActual.textContent = formatTiempo(Math.floor(audio.currentTime));
  });

  // Muestra la duración total del track cuando el navegador la conoce.
  // loadedmetadata se dispara cuando el audio ha cargado sus metadatos (duración, etc.)
  // Antes de este evento, audio.duration devuelve NaN
  audio.addEventListener("loadedmetadata", () => {
    document.getElementById("tiempoTotal").textContent = formatTiempo(
      Math.floor(audio.duration),
    );
  });

  // Permite saltar a cualquier posición del track haciendo click en la barra de progreso
  progressTrack.addEventListener("click", function (e) {
    if (!audio.duration) return;
    // Calculamos el porcentaje de la barra donde se hizo click
    const rect = this.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  // Cuando el track termina, avanza automáticamente al siguiente
  audio.addEventListener("ended", () => {
    siguiente();
  });

  // Actualiza el volumen del audio y guarda el valor en volumenActual al mover el slider
  // Se guarda en volumenActual para que toggleMute() pueda restaurarlo correctamente
  volumen.addEventListener("input", function () {
    audio.volume = this.value;
    volumenActual = parseFloat(this.value);
  });

  // Cargamos el track cuyo id viene en la URL y luego las recomendaciones.
  // cargarTrack debe ser await porque cargarRecomendaciones necesita que "track" esté asignado
  await cargarTrack();

  // Mostramos los botones que solo son accesibles para usuarios logados
  const usuarioLogado = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuarioLogado) {
    document.getElementById("btnNuevoComentario").hidden = false;
    document.getElementById("btnDescargar").hidden = false;
    document.getElementById("btnPlaylist").hidden = false;
    document.getElementById("btnLike").hidden = false;
  }

  cargarRecomendaciones();

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (id) cargarComentarios(id);

  // Inicializa los iconos de Feather Icons definidos con data-feather en el HTML
  feather.replace();

  // Si la URL tiene ?scroll=comentarios, hacemos scroll suave hasta la sección
  if (window.location.search.includes("scroll=comentarios")) {
    setTimeout(() => {
      document
        .getElementById("seccionComentarios")
        .scrollIntoView({ behavior: "smooth" });
    }, 800);
  }

  /**
   * Cierra el menú de playlists al hacer click fuera de él o del botón.
   */
  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("playlistWrapper");
    const menu = document.getElementById("menuPlaylist");
    if (
      menu &&
      !menu.hidden &&
      wrapper &&
      !wrapper.contains(e.target) &&
      !menu.contains(e.target)
    ) {
      menu.hidden = true;
      playlistSeleccionada = null;
    }
  });
});

/**
 * Cierra el formulario de comentarios al hacer click fuera de él.
 */
document.addEventListener("click", (e) => {
  const form = document.getElementById("formComentario");
  const btnNuevoComentario = document.getElementById("btnNuevoComentario");
  if (
    form &&
    !form.hidden &&
    !form.contains(e.target) &&
    !btnNuevoComentario.contains(e.target)
  ) {
    form.hidden = true;
  }
});
