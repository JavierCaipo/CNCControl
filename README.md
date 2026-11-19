# CNC · Control previo al uso

Sitio privado de IMAD-3D para revisión preventiva de la Senfeng SF3015HM (6 kW). Interfaz HTML/CSS/JS conservada sobre Vinext y almacenamiento compartido D1.

## Alcance

- 14 verificaciones previas, con estados Conforme, Anomalía y Pendiente y observaciones por punto.
- 9 problemas comunes derivados del Manual de corte láser V1, p. 28. No se presentan como códigos oficiales de alarma.
- Fallo del eje Z y otras alarmas no documentadas: registro y derivación a mantenimiento.
- Registro y cierre de incidencias con responsable y comprobación.
- Estado pendiente, bloqueado, por validar o validado; cualquier modificación invalida la confirmación y las revisiones de días anteriores caducan usando America/Lima.
- Guardado automático en la nube privada, historial compartido de hasta 50 registros y descarga JSON. Las incidencias abiertas se conservan al iniciar una revisión nueva.
- Acceso autenticado mediante Sites; la audiencia autorizada comparte el mismo registro de la CNC.
- Revisión optimista en cada escritura para evitar sobrescrituras entre operadores. Copia local y recuperación de cambios pendientes en caso de desconexión o conflicto.
- La versión anterior conservada en localStorage se puede incorporar al historial compartido con una acción explícita; no se migra automáticamente.
- Logo de IMAD 3D conservado desde el recurso gráfico del manual y presentado con colores de marca mediante CSS.

## Fuentes

Manual de corte láser SENFENG SF3015HM, Santiago Javier Caipo Nuñez, IMAD-3D, V1, 23/02/2026, pp. 4, 7–11, 21–24, 27–28. Observación sobre cerramiento y polvo: 09/10/2026. Contexto del checklist y fallo del eje Z: 12/10/2026.

No se automatizan el encendido, los resets ni las intervenciones de la máquina. La validación es un registro del operador, no una señal de control del equipo.

## Validación

`node --test tests/model.test.mjs tests/cloud.test.mjs`

`node --check public/app.mjs`

`python tests/static-check.py`

Las pruebas de nube ejercitan las mismas consultas SQL con SQLite y verifican autenticación, acceso compartido, persistencia, conflicto entre revisiones, incidencias abiertas, reintento tras desconexión y cambios durante un guardado en curso.

La tabla `shared_reviews` es compartida por los usuarios autorizados en la política privada de Sites; no tiene endpoints públicos de escritura. Las peticiones de escritura requieren identidad, JSON y origen coincidente.

El acceso sigue restringido al propietario hasta que el usuario facilite el correo del operador y se le añada como visitante autorizado. La prueba en navegador no está disponible en este entorno.

## Actualización de planta · 17/11/2026

Protección ocular y respirador; revisión semanal de mangueras; limpieza de tapas y cambio de agua del chiller cada 3 meses; limpieza diaria de filtros y purga diaria del compresor al cierre; purga semanal de filtros sin goteo posterior; centrado del láser obligatorio. Frecuencias indicadas por planta. Confirmar compatibilidad del agua destilada con el requisito de agua desionizada del manual. Las gafas requieren longitud de onda y OD apropiadas, certificado y aprobación del responsable de seguridad; referencias ANSI Z136.1-2022 e ISO 19818-1:2021.
