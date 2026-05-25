// CONFIG.API_URL se usa directamente — no hace falta renombrarlo a urlApi en este archivo

/**
 * Se ejecuta cuando el DOM está completamente cargado.
 * Registra el evento click del botón "Publicar", inicializa los iconos Feather
 * y muestra los datos del usuario logado en el navbar.
 */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnPublicar").addEventListener("click", () => {
    uploadTrack();
  });

  // Mostramos email y rol del usuario logado en el navbar
  const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (usuario) {
    feather.replace();
    let spanNombre = document.getElementById("spanNombre");
    let spanRol = document.getElementById("spanRol");
    spanNombre.innerHTML = `Usuario: ${usuario.email}`;
    spanRol.innerHTML = `Rol: ${usuario.rol}`;
  }

  /**
   * Obtiene la duración de un archivo de audio y la devuelve en formato HH:MM:SS.
   * Crea una URL temporal en memoria con URL.createObjectURL() para que el elemento
   * <audio> pueda leer los metadatos del archivo sin subirlo al servidor.
   * La URL se libera con revokeObjectURL() en cuanto se obtiene la duración
   * para no desperdiciar memoria.
   *
   * @param {File} file - Archivo de audio seleccionado por el usuario
   * @returns {Promise<string>} Duración en formato HH:MM:SS (ej.: "00:03:45")
   */
  async function obtenerDuracionAudio(file) {
    return new Promise((resolve, reject) => {
      const audio = document.createElement("audio");

      // Creamos una URL temporal en memoria que apunta al archivo local
      const url = URL.createObjectURL(file);

      audio.addEventListener("loadedmetadata", () => {
        // Liberamos la URL temporal en cuanto ya no la necesitamos
        URL.revokeObjectURL(url);
        // audio.duration devuelve segundos en decimal — redondeamos al entero más cercano
        const totalSegundos = Math.round(audio.duration);

        // Convertimos los segundos totales a formato HH:MM:SS que espera el backend
        const horas = String(Math.floor(totalSegundos / 3600)).padStart(2, "0");
        const minutos = String(
          Math.floor((totalSegundos % 3600) / 60),
        ).padStart(2, "0");
        const segundos = String(totalSegundos % 60).padStart(2, "0");

        resolve(`${horas}:${minutos}:${segundos}`);
      });

      audio.addEventListener("error", () => {
        reject(new Error("No se pudo leer el archivo de audio."));
      });

      // Asignar el src dispara la carga del archivo y eventualmente el evento loadedmetadata
      audio.src = url;
    });
  }

  /**
   * Recoge los datos del formulario, calcula la duración del audio en el cliente
   * y envía el track al backend mediante POST como multipart/form-data.
   * Valida que el usuario esté logado y que los campos obligatorios estén rellenos.
   *
   * Se usa FormData en lugar de JSON para poder incluir el archivo de audio.
   * El Content-Type no se pone manualmente — si se pone, el navegador no añade
   * el boundary necesario para multipart y la petición falla.
   */
  async function uploadTrack() {
    const usuario = JSON.parse(localStorage.getItem("usuarioLogado"));
    const titulo = document.getElementById("titulo").value.trim();
    const descripcion = document.getElementById("descripcion").value.trim();
    const genero = document.getElementById("genero").value;

    // Validaciones básicas antes de enviar
    if (!usuario) {
      alert("No hay ningún usuario logado.");
      return;
    }
    if (!titulo) {
      alert("El título es obligatorio.");
      return;
    }
    if (!genero) {
      alert("El género es obligatorio.");
      return;
    }

    // La portada es opcional — si no se selecciona el backend asigna una por defecto
    let portada = document.getElementById("imagenInput").files[0];
    if (!portada) {
      alert("No has seleccionado portada, se seleccionará una por defecto.");
    }

    const audioFile = document.getElementById("audioInput").files[0];
    if (!audioFile) {
      alert("Selecciona un archivo de audio.");
      return;
    }

    // Calculamos la duración en el cliente para no tener que procesarla en el servidor
    const duracion = await obtenerDuracionAudio(audioFile);

    // Construimos el FormData con todos los campos — el navegador gestiona el Content-Type
    const formData = new FormData();
    formData.append("idUsuario", usuario.idUsuario);
    formData.append("titulo", titulo);
    formData.append("genero", genero);
    formData.append("descripcion", descripcion);
    formData.append("duracion", duracion);
    formData.append("instrumental", audioFile);
    if (portada) {
      formData.append("portada", portada);
    }

    try {
      const response = await fetch(`${CONFIG.API_URL}tracks/uploadTrack`, {
        method: "POST",
        body: formData, // Sin Content-Type manual — el navegador añade el boundary automáticamente
      });

      // Si el servidor responde con un código de error HTTP, avisamos y cancelamos
      if (!response.ok) {
        alert("Error en el servidor: " + response.status);
        return;
      }

      // El backend devuelve true si el track se guardó correctamente, false en caso contrario
      const exito = await response.json();

      if (exito) {
        alert("Instrumental subida correctamente.");
        // window.location.href = "principal.html"; // Descomentar cuando esté lista la página
      } else {
        alert("Se ha producido un error al subir la instrumental.");
      }
    } catch (error) {
      // Capturamos errores de red o fallos en el fetch (servidor caído, sin conexión, etc.)
      console.error("Error al subir la instrumental:", error);
      alert("No se ha podido conectar con el servidor.");
    }
  }
});
