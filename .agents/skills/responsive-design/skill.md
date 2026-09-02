---
name: "responsive-design-react-vite"
description: "Optimiza componentes de React 19 creados con Vite para un sistema de agendamiento de citas, asegurando interfaces móviles perfectas con CSS flexible."
triggers:
  - "crear componente"
  - "diseñar vista"
  - "pantalla de agendamiento"
  - "calendario"
  - "formulario de cita"
  - "hacer responsivo"
---

# Reglas de Responsividad para React 19 + Vite (Agendamiento de Citas)

Dado que este proyecto no utiliza frameworks de utilidad (como Tailwind), debes estructurar la responsividad mediante CSS estándar moderno (Flexbox, Grid, CSS Modules) siguiendo estrictamente estas reglas:

## 1. Enfoque Móvil para Agendamiento
- Los usuarios agendan citas mayoritariamente desde teléfonos. La interfaz debe priorizar la experiencia móvil.
- Usa **Media Queries nativas** con enfoque Mobile-First:
  ```css
  /* Estilos base para móviles (pantallas pequeñas) */
  .gridHorarios {
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* 2 columnas en móvil */
    gap: 12px;
  }

  /* Adaptación para tablets y escritorios */
  @media (min-width: 768px) {
    .gridHorarios {
      grid-template-columns: repeat(4, 1fr); /* 4 o más columnas en escritorio */
    }
  }
  ```

## 2. Tipografía y Dimensiones Fluidas
- Prohibido usar anchos fijos de contenedor (`width: 400px`). Usa `width: 100%` y `max-width` para evitar scroll horizontal.
- Utiliza unidades relativas (`rem`, `em`, `%`) y funciones fluidas para que los textos de los calendarios no se desborden:
  * `font-size: clamp(0.875rem, 2vw, 1.25rem);`

## 3. Ergonomía Táctil en Botones e Iconos (Lucide React)
- Los selectores de horas, días del calendario y botones de confirmación deben tener un **área interactiva mínima de 48px x 48px** para evitar clics erróneos en móviles.
- Cuando uses iconos de `lucide-react`, asegúrate de envolverlos en contenedores con suficiente *padding* o definir propiedades de tamaño explícitas adaptables.

## 4. Estructuras de Calendario y Listas Resilientes
- Para las rejillas de días del calendario o bloques de horas disponibles, utiliza `grid-template-columns: repeat(auto-fit, minmax(60px, 1fr))` para que el calendario se acomode solo sin importar el ancho del dispositivo.
- Asegura que los formularios de Express/React rompan las palabras largas usando `overflow-wrap: break-word` en etiquetas de texto.

## 5. Componente de Referencia Esperado (React 19)

Genera componentes con esta estructura limpia y adaptabilidad nativa:

```jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import './SelectorHora.css'; // O estilos en línea equivalentes

export const SelectorHora = ({ horas Disponibles, alSeleccionar }) => {
  return (
    <div className="contenedor-agendamiento">
      <h3 className="titulo-seccion">
        <Calendar size={20} className="icono" />
        Selecciona tu horario
      </h3>
      <div className="grid-horas">
        {horasDisponibles.map((hora) => (
          <button 
            key={hora} 
            className="boton-hora"
            onClick={() => alSeleccionar(hora)}
          >
            {hora}
          </button>
        ))}
      </div>
    </div>
  );
};
```
