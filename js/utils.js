/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Si hay usuario logado muestra sus datos en el navbar y oculta los botones de login.
 * Si no hay usuario logado, deshabilita visualmente el enlace "Mi perfil"
 * y muestra un alert al intentar acceder.
 */
document.addEventListener("DOMContentLoaded", () => {
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuario) {
    // Ocultamos los botones de login/registro y mostramos el bloque del usuario logado
    let divBotones = document.getElementById("divBotonesLogin");
    if (divBotones) {
      divBotones.hidden = true;
    }
    let divLogado = document.getElementById("divUsuario");
    divLogado.hidden = false;
    let spanNombre = document.getElementById("spanNombre");
    let spanRol = document.getElementById("spanRol");
    spanNombre.innerHTML = `Usuario: ${usuario.email}`;
    spanRol.innerHTML = `Rol: ${usuario.rol}`;
  }

  // Si no hay usuario logado, deshabilitamos "Mi perfil" visualmente y bloqueamos la navegación
  const perfil = document.getElementsByClassName("perfil")[0];
  if (perfil && !usuario) {
    perfil.style.opacity = "0.4";
    perfil.style.cursor = "not-allowed";

    perfil.addEventListener("click", (e) => {
      e.preventDefault(); // Evitamos que navegue al href
      alert('Debes iniciar sesión para acceder a "Mi perfil"');
    });
  }
});

/**
 * Elimina la cuenta del usuario logado.
 * Pide confirmación antes de proceder.
 * Llama a DELETE /eliminarCuenta?idUsuario={id}.
 * Si se elimina correctamente limpia el localStorage y redirige a principal.html.
 * CSS incluido en nav.css para no repetirlo en dos archivos
 */
async function eliminarCuenta() {
  if (
    !confirm(
      "¿Seguro que quieres eliminar tu cuenta? Se eliminarán todos los registros guardados. Esta acción no se puede deshacer.",
    )
  )
    return;

  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!usuario) return;

  try {
    await fetch(`${urlApi}eliminarCuenta?idUsuario=${usuario.idUsuario}`, {
      method: "DELETE",
    });
    localStorage.clear();
    alert("Cuenta eliminada correctamente.");
    window.location.href = "principal.html";
  } catch (e) {
    console.error("Error eliminando cuenta:", e);
    alert("No se ha podido eliminar la cuenta.");
  }
}

/**
 * Cierra la sesión del usuario limpiando el localStorage y redirigiendo a principal.html.
 * Muestra un alert de confirmación antes de redirigir.
 */
function cerrarSesion() {
  localStorage.clear();
  alert("Sesión cerrada correctamente.");
  // Esperamos 1 segundo para que el usuario vea el mensaje antes de redirigir
  setTimeout(() => {
    window.location.href = "principal.html";
  }, 1000);
}

/**
 * Abre o cierra el menú hamburguesa desplegable.
 * Ajusta el href de "Mi perfil" según el rol del usuario logado:
 * - USUARIO → perfilUsuario.html
 * - PRODUCTOR → perfilProductor.html
 * Oculta el enlace "Subir track" si el usuario no tiene rol PRODUCTOR.
 */
function toggleMenu() {
  let botonHambur = document.getElementById("menuDesplegable");
  let subirArchivo = document.getElementsByClassName("productores")[0];
  let perfil = document.getElementsByClassName("perfil")[0];
  let usuario = localStorage.getItem("usuarioLogado");
  let productor = usuario ? JSON.parse(usuario) : null;

  // Ajustamos el href de "Mi perfil" según el rol del usuario logado
  if (perfil) {
    if (productor?.rol === "USUARIO") {
      perfil.setAttribute("href", "perfilUsuario.html");
    } else if (productor) {
      perfil.setAttribute("href", "perfilProductor.html");
    }
  }

  // "Subir track" solo es visible para productores
  if (subirArchivo) {
    subirArchivo.hidden = productor?.rol !== "PRODUCTOR";
  }

  botonHambur.toggleAttribute("hidden");
}

/**
 * Cierra el menú hamburguesa al hacer click fuera de él.
 * Solo actúa si el menú está visible y el click no fue dentro del menú ni en el botón hamburguesa.
 */
document.addEventListener("click", (e) => {
  const menu = document.getElementById("menuDesplegable");
  const boton = document.querySelector(".btn-hamburguesa");

  if (!menu.hidden && !menu.contains(e.target) && !boton.contains(e.target)) {
    menu.hidden = true;
  }
});

// ==================================================================================
// CONTROL DE SESIÓN — cierre automático tras 15 minutos de inactividad
// ==================================================================================

/**
 * Registra el timestamp actual en localStorage cuando el usuario deja de ver la página.
 * El evento visibilitychange se dispara al cambiar de pestaña, minimizar la ventana
 * o bloquear la pantalla sin cerrar la página.
 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Guardamos el momento exacto en que el usuario dejó de ver la página
    localStorage.setItem("ultimaVezActivo", Date.now());
  }
});

/**
 * Registra el timestamp actual en localStorage cuando el navegador descarga la página.
 * El evento pagehide se dispara al cerrar la pestaña, cerrar el navegador,
 * recargar la página o navegar a otro sitio.
 * Es una capa extra de seguridad por si visibilitychange no se dispara
 * en algunos navegadores móviles al cerrar.
 */
window.addEventListener("pagehide", () => {
  localStorage.setItem("ultimaVezActivo", Date.now());
});

/**
 * Comprueba si la sesión ha expirado por inactividad.
 * Si han pasado más de 15 minutos desde la última vez que el usuario vio la página,
 * cierra la sesión automáticamente.
 * Se llama al cargar la página y al volver a enfocar la pestaña.
 */
function checkSesionExpirada() {
  const ultimaVez = localStorage.getItem("ultimaVezActivo");
  const cuartoHora = 15 * 60 * 1000; // 15 minutos en milisegundos

  if (ultimaVez && Date.now() - Number(ultimaVez) > cuartoHora) {
    alert("La sesión ha expirado.");
    cerrarSesion();
  }
}

// Comprobamos al cargar la página por si había una sesión expirada de antes
document.addEventListener("DOMContentLoaded", checkSesionExpirada);

/**
 * Comprueba si la sesión ha expirado al volver a enfocar la pestaña.
 * Se combina con el listener de visibilitychange de arriba para cubrir
 * tanto la salida (hidden) como el regreso (visible) a la página.
 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkSesionExpirada();
  }
});
// ==================================================================================
