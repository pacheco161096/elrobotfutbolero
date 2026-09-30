# Marcador

Plantilla de la imagen de resultado. Toda pieza de este tipo sale igual. Solo cambian la foto, las banderas, el marcador y los goles.

La muestra armada está en `docs/marcador-esp-cro.png`. La línea del personaje sigue `docs/personalidad.md`. La cara del bot sale de `docs/bot-cuerpo.png`.

No se inventan goles, minutos ni marcador. Si el dato no está confirmado, la imagen no se arma.

---

## Lienzo

- Vertical, siempre: **1080 × 1350** (4:5).
- PNG.
- La foto entra a sangre, recorte `cover` centrado en la jugada. Sin bandas, sin estirar, sin regenerar la foto.
- Tratamiento de la foto: brillo `0.92`, saturación `1.05`.

---

## Qué no se mueve

- Formato, márgenes y orden de las capas.
- Verde `#c6f135` y texto `#f4f7ea`.
- Tipografía: DIN Condensed Bold.
- El bot, arriba a la derecha, sin camiseta y sin escudo de club.
- El bloque del marcador, pegado al mismo sitio abajo.
- Las listas de goles: local a la izquierda, visita a la derecha, creciendo hacia arriba desde la misma línea base.
- El balón, el minuto en verde y el nombre en blanco.

No entra el nombre de la competición, ni barra, ni rótulo arriba. Tampoco entra banner de descarga, logo ajeno ni firma de otra página.

---

## Qué entra en cada partido

| Dato | Dónde va |
| --- | --- |
| Foto real de ese partido | Fondo |
| Bandera del local y de la visita | Abajo, a los lados del marcador |
| Códigos y tantos | Abajo, al centro: `LOCAL  n - n  VISITA` |
| Goles del local | Izquierda: minuto y nombre, del más temprano al más tardío |
| Goles de la visita | Derecha: nombre, minuto y balón, en el mismo orden |

El local es el de la izquierda. La visita es el de la derecha.

---

## Capas, de abajo hacia arriba

1. Foto recortada.
2. Velos para que el texto se lea.
3. Textos, balones, barra del marcador y banderas.
4. Cara del bot.

### Velos

Color `#070b08`.

- Abajo: desde y = 860 hasta el borde. Opacidad 0 en el inicio, 0.20 al 35 % y 0.84 al final.
- Izquierda, sobre los goles: desde y = 900, 560 × 280. Opacidad 0.55 a la izquierda y 0 a la derecha.
- Derecha, sobre el gol visitante: x = 720, y = 1040, 360 × 150. Opacidad 0.45 a la derecha y 0 a la izquierda.

Todo el texto lleva sombra negra: desplazamiento y = 2, desenfoque 2.4, opacidad 0.9.

---

## Bot

- Recorte de `docs/bot-cuerpo.png`: x = 168, y = 148, 528 × 390.
- Badge de 136 × 136, radio 26, borde verde de 3 px.
- Posición: top = 36, right = 36.

---

## Goles

Tamaño 40. Alto de línea 58. La última línea de cada lado apoya en **y = 1134**. Si hay más goles, la lista sube. El marcador no se mueve para hacerles sitio.

Orden cronológico. Minuto en verde, nombre en blanco y mayúsculas. Un balón de 24 px por línea, con el centro alineado al texto (`y` del texto − 26).

### Local, izquierda

- Balón en x = 48.
- Minuto en x = 84. Todos los minutos comparten ese borde izquierdo.
- Nombre en x = 156. Todos los nombres comparten ese borde, aunque el minuto sea `3'` o `89'`.

### Visita, derecha

El grupo se alinea al borde derecho, con 48 px de margen.

- Balón al extremo derecho.
- Minuto a la izquierda del balón, con 14 px de separación. Los minutos de la visita comparten borde derecho.
- Nombre a la izquierda del minuto, con 14 px de separación. Un nombre largo crece hacia la izquierda.

Si un lado no metió goles, ese lado queda vacío. No se escribe «sin goles» sobre la foto.

---

## Marcador

Las banderas apoyan en **y = 1204**. Miden 112 × 74, radio 8, borde blanco al 55 % de 2 px.

Son la bandera real de cada equipo, con sus colores. Si el escudo es lo que la hace reconocible, entra una versión simple y fiel. No se inventan colores ni se intercambian.

El grupo va centrado en el lienzo, en este orden y con estas separaciones:

`bandera` 20 `código` 26 `tanto` 20 `barra` 20 `tanto` 26 `código` 20 `bandera`

- Código: tamaño 36, tracking 1.5, blanco, línea base en y = 1254.
- Tantos: tamaño 118, blanco, línea base en y = 1282.
- La raya no es un guion de texto. Es un rectángulo verde de 28 × 8, radio 2, en y = 1237, centrado entre los dos tantos.

El código es el de tres letras del partido (`ESP`, `CRO`, `MEX`). El tanto de la izquierda es el del local.

---

## Muestra

España 4-1 Croacia.

Local, de arriba hacia abajo, última línea en y = 1134:

- 3' Lamine Yamal
- 31' Pubill
- 63' Lamine Yamal
- 89' Nico Williams

Visita, en esa misma línea: Beljo 29'.

Abajo: bandera de España, ESP, 4, raya verde, 1, CRO, bandera de Croacia.
