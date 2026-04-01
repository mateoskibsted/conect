# Bitácora Conect

## Día 1 — Martes 25 de Marzo
Definimos la idea completa de Conect: plataforma deportiva para crear partidos y conectar jugadores, inspirada en el LFG de World of Warcraft. Descartamos las fiestas como categoría y decidimos enfocarnos solo en deportes, arrancando con fútbol. Creamos el PRD v2 con las 5 features del MVP, el stack tecnológico y los criterios de éxito.

Construimos el MVP completo con Claude Code: instalamos Node.js, Git Bash y Claude Code, creamos las cuentas en GitHub, Supabase y Vercel, y construimos los 8 pasos del MVP: setup, base de datos, autenticación, panel del partido, crear partido, link compartible, home, perfil y notificación por email. Publicamos la app en conect-app.vercel.app.

## Día 2 — Miércoles 26 de Marzo
Resolvimos el problema de acceso de Vercel que bloqueaba a los usuarios. Cambiamos la URL a conect-app.vercel.app. Actualizamos el tagline a "Conecta con tus amigos para hacer deporte más fácil y rápido que nunca". Agregamos fondo de estadio en el login. Agregamos navbar verde con letras blancas. Agregamos tríptico de imágenes deportivas en el home. Corregimos legibilidad de textos en el home poniéndolos en blanco. Eliminamos el emoji de pelota azul del estado vacío.

## Día 3 — Viernes 28 de Marzo
Se implementó cancelación de partidos por el host, el creador ahora cuenta como jugador en los cupos, límite de un partido activo por usuario, sistema de solicitudes de unión con aceptar y rechazar, notificación por email al host cuando llega una solicitud, sistema de co-host, opción de eliminar jugadores por host y co-host, y cupos pre-ocupados con jugadores externos sin cuenta en la app.

## Día 4 — Martes 1 de Abril
Se implementó sistema de amistades con buscador en navbar, perfiles públicos, solicitudes mutuas y filtro de amigos en home. Se agregó username único por usuario. Se configuró la app como PWA para iPhone. Se agregó chat en tiempo real por partido. Se implementó barra de navegación inferior para móvil con safe area de iPhone. Se mejoró el fondo del home con slideshow en móvil y tríptico en desktop.
